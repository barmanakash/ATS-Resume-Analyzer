import logging
import mimetypes
from typing import Optional, Tuple

from starlette.concurrency import run_in_threadpool

from app.config import settings
from app.core.exceptions import BadRequestError, NotFoundError
from app.database.collections import OPTIMIZATION_SUGGESTIONS, RESUME_ANALYSES, RESUME_VERSIONS
from app.document_processing.resume_parser import extract_basic_info
from app.document_processing.text_extraction import (
    DocumentExtractionError,
    extract_text,
    sanitize_filename,
    validate_upload,
)
from app.repositories.document_repositories import ResumeRepository
from app.schemas.common import Pagination
from app.schemas.resume import clean_single_line, present_resume
from app.storage.local_storage import LocalStorageService
from app.utils.mongo import serialize

logger = logging.getLogger(__name__)

RESUME_FILE_TYPES = ("pdf", "docx")
_DOWNLOAD_TYPES = {
    "pdf": "application/pdf",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}


class ResumeService:
    def __init__(self, db, storage: Optional[LocalStorageService] = None):
        self.db = db
        self.resumes = ResumeRepository(db)
        self.storage = storage or LocalStorageService()

    async def upload(
        self, user: dict, filename: str, content_type: Optional[str], content: bytes, display_name: Optional[str]
    ) -> dict:
        user_id = user["_id"]
        if await self.resumes.count_for_user(user_id) >= settings.max_resumes_per_user:
            raise BadRequestError(
                f"You can store up to {settings.max_resumes_per_user} resumes. Delete one to upload another.",
                code="RESUME_LIMIT_REACHED",
            )

        file_type = validate_upload(filename, content_type, content, RESUME_FILE_TYPES)
        try:
            result = await run_in_threadpool(extract_text, file_type, content)
        except DocumentExtractionError as exc:
            # Nothing is stored for a file we cannot read, so the user can fix it and retry immediately.
            raise BadRequestError(exc.message, code=exc.code)
        except Exception as exc:
            logger.error("Unexpected extraction failure (%s)", type(exc).__name__)
            raise BadRequestError("We could not process this file.", code="UNREADABLE_DOCUMENT")

        safe_name = sanitize_filename(filename, fallback=f"resume.{file_type}")
        label = clean_single_line(display_name or "")[:200] or safe_name.rsplit(".", 1)[0] or safe_name
        key = await run_in_threadpool(self.storage.save, str(user_id), file_type, content)
        try:
            doc = await self.resumes.insert(
                {
                    "userId": user_id,
                    "originalFileName": safe_name,
                    "displayName": label,
                    "storagePath": key,
                    "fileType": file_type,
                    "fileSize": len(content),
                    "parsedText": result.text,
                    "parsedData": extract_basic_info(result.text, result.page_count),
                    "processingStatus": "COMPLETED",
                    "processingError": None,
                }
            )
        except Exception:
            await run_in_threadpool(self.storage.delete, key)  # never leave an orphaned file behind
            raise
        logger.info("Resume uploaded user_id=%s resume_id=%s type=%s", user_id, doc["_id"], file_type)
        return present_resume(serialize(doc), detail=True)

    async def list(self, user_id, pagination: Pagination):
        items, total = await self.resumes.list_for_user(user_id, pagination)
        return [present_resume(i) for i in items], total

    async def _get_or_404(self, user_id, resume_id) -> dict:
        doc = await self.resumes.get_for_user(user_id, resume_id)
        if not doc:
            raise NotFoundError("Resume not found.")
        return doc

    async def get(self, user_id, resume_id) -> dict:
        return present_resume(serialize(await self._get_or_404(user_id, resume_id)), detail=True)

    async def rename(self, user_id, resume_id, display_name: str) -> dict:
        await self._get_or_404(user_id, resume_id)
        updated = await self.resumes.update_for_user(user_id, resume_id, {"displayName": display_name})
        return present_resume(serialize(updated), detail=False)

    async def read_file(self, user_id, resume_id) -> Tuple[bytes, str, str]:
        doc = await self._get_or_404(user_id, resume_id)
        try:
            data = await run_in_threadpool(self.storage.read, doc.get("storagePath") or "")
        except (FileNotFoundError, ValueError, OSError):
            raise NotFoundError("The original file is no longer available.")
        file_type = doc.get("fileType") or ""
        name = doc.get("originalFileName") or doc.get("fileName") or f"resume.{file_type}"
        media = _DOWNLOAD_TYPES.get(file_type) or mimetypes.guess_type(name)[0] or "application/octet-stream"
        return data, name, media

    async def delete(self, user_id, resume_id) -> None:
        """Deletes the resume, its stored file and every record derived from it."""
        doc = await self._get_or_404(user_id, resume_id)
        rid = doc["_id"]
        ids = [rid, str(rid)]  # older records stored the reference as a string

        version_ids = [
            v["_id"] async for v in self.db[RESUME_VERSIONS].find({"userId": user_id, "resumeId": {"$in": ids}}, {"_id": 1})
        ]
        await self.db[OPTIMIZATION_SUGGESTIONS].delete_many(
            {"userId": user_id, "$or": [{"resumeId": {"$in": ids}}, {"resumeVersionId": {"$in": version_ids}}]}
        )
        await self.db[RESUME_VERSIONS].delete_many({"userId": user_id, "resumeId": {"$in": ids}})
        await self.db[RESUME_ANALYSES].delete_many({"userId": user_id, "resumeId": {"$in": ids}})
        await run_in_threadpool(self.storage.delete, doc.get("storagePath"))
        await self.resumes.delete_for_user(user_id, rid)
        logger.info("Resume deleted user_id=%s resume_id=%s", user_id, rid)
