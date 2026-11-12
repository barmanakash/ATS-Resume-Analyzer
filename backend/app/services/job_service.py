import logging
from typing import Optional

from starlette.concurrency import run_in_threadpool

from app.config import settings
from app.core.exceptions import BadRequestError, NotFoundError
from app.document_processing.text_extraction import DocumentExtractionError, extract_text, validate_upload
from app.repositories.document_repositories import JobDescriptionRepository
from app.schemas.common import Pagination
from app.schemas.job_description import MAX_DESCRIPTION_CHARS, JobCreatePayload, JobUpdatePayload, present_job
from app.utils.mongo import serialize

logger = logging.getLogger(__name__)

JOB_FILE_TYPES = ("pdf", "docx", "txt")


class JobService:
    def __init__(self, db):
        self.jobs = JobDescriptionRepository(db)

    async def create(self, user_id, payload: JobCreatePayload) -> dict:
        if await self.jobs.count_for_user(user_id) >= settings.max_jobs_per_user:
            raise BadRequestError(
                f"You can store up to {settings.max_jobs_per_user} job descriptions. Delete one to add another.",
                code="JOB_LIMIT_REACHED",
            )
        doc = await self.jobs.insert(
            {
                "userId": user_id,
                "jobTitle": payload.jobTitle,
                "companyName": payload.companyName,
                "description": payload.description,
                # Filled in by the analysis step; kept here so the document shape matches the spec.
                "extractedRequirements": None,
            }
        )
        return present_job(serialize(doc), detail=True)

    async def list(self, user_id, pagination: Pagination):
        items, total = await self.jobs.list_for_user(user_id, pagination)
        return [present_job(i) for i in items], total

    async def get(self, user_id, job_id) -> dict:
        doc = await self.jobs.get_for_user(user_id, job_id)
        if not doc:
            raise NotFoundError("Job description not found.")
        return present_job(serialize(doc), detail=True)

    async def update(self, user_id, job_id, payload: JobUpdatePayload) -> dict:
        existing = await self.jobs.get_for_user(user_id, job_id)
        if not existing:
            raise NotFoundError("Job description not found.")
        fields = payload.model_dump(exclude_none=True)
        if "description" in fields and fields["description"] != (existing.get("description") or existing.get("content")):
            fields["extractedRequirements"] = None  # stale once the text changes
        updated = await self.jobs.update_for_user(user_id, job_id, fields)
        return present_job(serialize(updated), detail=True)

    async def delete(self, user_id, job_id) -> None:
        if not await self.jobs.delete_for_user(user_id, job_id):
            raise NotFoundError("Job description not found.")
        logger.info("Job description deleted user_id=%s job_id=%s", user_id, job_id)

    @staticmethod
    async def extract_text_from_file(filename: str, content_type: Optional[str], content: bytes) -> dict:
        """Reads a job description document so the form can be pre-filled. Nothing is stored."""
        file_type = validate_upload(filename, content_type, content, JOB_FILE_TYPES)
        try:
            result = await run_in_threadpool(extract_text, file_type, content)
        except DocumentExtractionError as exc:
            raise BadRequestError(exc.message, code=exc.code)
        text = result.text
        return {"text": text[:MAX_DESCRIPTION_CHARS], "truncated": len(text) > MAX_DESCRIPTION_CHARS}
