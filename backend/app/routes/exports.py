from __future__ import annotations

import html

from fastapi import APIRouter, Depends, Query
from fastapi.responses import HTMLResponse, PlainTextResponse

from app.core.exceptions import BadRequestError, NotFoundError
from app.database.collections import RESUME_VERSIONS, RESUMES
from app.database.mongodb import get_db
from app.dependencies.auth import get_current_user
from app.optimizer.document import document_text
from app.schemas.common import ok
from app.utils.mongo import serialize, to_object_id

router = APIRouter(prefix="/exports", tags=["exports"])


@router.get("/resume")
async def export_resume(
    resume_id: str = Query(..., alias="resumeId"),
    format: str = Query("txt"),
    version_id: str | None = Query(None, alias="versionId"),
    current_user: dict = Depends(get_current_user),
):
    resume = await get_db()[RESUMES].find_one({"_id": to_object_id(resume_id), "userId": current_user["_id"]})
    if not resume:
        raise NotFoundError("Resume not found.")

    content = resume.get("parsedText") or ""
    if version_id:
        version = await get_db()[RESUME_VERSIONS].find_one({"_id": to_object_id(version_id), "userId": current_user["_id"]})
        if version:
            stored = version.get("content")
            # Optimized versions hold a structured document; older ones held plain text.
            content = document_text(stored) if isinstance(stored, dict) else (stored or content)

    file_format = (format or "txt").lower()
    if file_format == "txt":
        return PlainTextResponse(content or "No resume text available.")
    if file_format == "html":
        # Resume text is untrusted: escape it, or a resume containing <script> would run in the browser.
        html_content = html.escape(content or "No resume text available.")
        return HTMLResponse(f"<html><body><pre>{html_content}</pre></body></html>")
    if file_format == "json":
        return ok({"resumeId": str(resume["_id"]), "content": content})

    raise BadRequestError("Supported formats are txt, html, and json.")
