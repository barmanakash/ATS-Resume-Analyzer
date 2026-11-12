import logging

from starlette.concurrency import run_in_threadpool

from app.core.exceptions import BadRequestError, NotFoundError
from app.repositories.document_repositories import AnalysisRepository, JobDescriptionRepository, ResumeRepository
from app.schemas.analysis import AnalysisCreatePayload, present_analysis, present_analysis_summary
from app.schemas.common import Pagination
from app.scoring.engine import analyze
from app.utils.mongo import serialize

logger = logging.getLogger(__name__)

# Bounds the work done per request. Real resumes and postings are far smaller.
MAX_RESUME_CHARS = 100_000
MAX_JOB_CHARS = 30_000


class AnalysisService:
    def __init__(self, db):
        self.analyses = AnalysisRepository(db)
        self.resumes = ResumeRepository(db)
        self.jobs = JobDescriptionRepository(db)

    async def create(self, user_id, payload: AnalysisCreatePayload) -> dict:
        # Both lookups are scoped to the user, so another user's ids behave exactly like missing ones.
        resume = await self.resumes.get_for_user(user_id, payload.resumeId)
        job = await self.jobs.get_for_user(user_id, payload.jobDescriptionId)
        if not resume or not job:
            raise NotFoundError("Selected resume or job description not found.")

        status = str(resume.get("processingStatus") or "").upper()
        resume_text = (resume.get("parsedText") or "").strip()
        if status in ("PENDING", "PROCESSING"):
            raise BadRequestError("This resume is still being processed. Try again in a moment.", code="RESUME_NOT_READY")
        if status == "FAILED" or not resume_text:
            raise BadRequestError(
                "No text could be read from this resume. Upload a text-based PDF or DOCX file and try again.",
                code="RESUME_UNREADABLE",
            )
        job_text = (job.get("description") or job.get("content") or "").strip()
        if not job_text:
            raise BadRequestError("This job description is empty.", code="JOB_DESCRIPTION_EMPTY")

        parsed = resume.get("parsedData") or {}
        job_title = job.get("jobTitle") or job.get("title") or ""
        result = await run_in_threadpool(
            analyze,
            resume_text[:MAX_RESUME_CHARS],
            job_text[:MAX_JOB_CHARS],
            job_title=job_title,
            contact={"email": parsed.get("email"), "phone": parsed.get("phone")},
        )

        stored = await self.analyses.insert(
            {
                "userId": user_id,
                "resumeId": str(resume["_id"]),
                "jobDescriptionId": str(job["_id"]),
                # Names are copied so the report stays readable after the resume or job is deleted.
                "resumeName": resume.get("displayName") or resume.get("originalFileName") or "Resume",
                "jobTitle": job_title,
                "companyName": job.get("companyName") or job.get("company") or "",
                "status": "completed",
                "mandatoryGapCount": len(result["mandatoryGaps"]),
                **result,
            }
        )
        logger.info("Analysis created user_id=%s analysis_id=%s score=%s", user_id, stored["_id"], result["overallScore"])
        return present_analysis(serialize(stored))

    async def list(self, user_id, pagination: Pagination):
        items, total = await self.analyses.list_for_user(user_id, pagination)
        return [present_analysis_summary(i) for i in items], total

    async def get(self, user_id, analysis_id) -> dict:
        doc = await self.analyses.get_for_user(user_id, analysis_id)
        if not doc:
            raise NotFoundError("Analysis not found.")
        return present_analysis(serialize(doc))

    async def delete(self, user_id, analysis_id) -> None:
        if not await self.analyses.delete_for_user(user_id, analysis_id):
            raise NotFoundError("Analysis not found.")
        logger.info("Analysis deleted user_id=%s analysis_id=%s", user_id, analysis_id)
