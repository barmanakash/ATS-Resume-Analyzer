import logging
from dataclasses import dataclass
from typing import List

from starlette.concurrency import run_in_threadpool

from app.core.exceptions import BadRequestError, NotFoundError
from app.exports.docx_export import render_docx
from app.exports.layout import build_layout, suggest_filename
from app.exports.pdf_export import render_pdf
from app.optimizer.document import validate_document
from app.repositories.optimizer_repositories import VersionRepository
from app.schemas.exports import ExportPayload

logger = logging.getLogger(__name__)

_FORMATS = {
    "pdf": (render_pdf, "application/pdf"),
    "docx": (render_docx, "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
}


@dataclass
class ExportResult:
    content: bytes
    media_type: str
    filename: str
    warnings: List[str]


class ExportService:
    """Renders one of the user's resume versions as a PDF or DOCX file.

    Exports are generated on request and never stored, so there is nothing extra to clean up or protect.
    Rendering takes well under a second, so it is done inside the request instead of as a background job.
    """

    def __init__(self, db):
        self.versions = VersionRepository(db)

    async def export_version(self, user_id, version_id, payload: ExportPayload) -> ExportResult:
        doc = await self.versions.get_for_user(user_id, version_id)  # scoped to the user: others' versions are 404
        if not doc or not isinstance(doc.get("content"), dict):
            raise NotFoundError("Version not found.")

        content = validate_document(doc["content"])
        layout = build_layout(content)
        if layout.is_empty:
            raise BadRequestError("This version has no content to export.", code="EMPTY_RESUME")

        renderer, media_type = _FORMATS[payload.format]
        rendered = await run_in_threadpool(
            renderer, content, template=payload.template, page_size=payload.pageSize, title=doc.get("name") or "Resume"
        )
        logger.info("Version exported user_id=%s version_id=%s format=%s", user_id, version_id, payload.format)
        return ExportResult(rendered.content, media_type, suggest_filename(layout, payload.format), rendered.warnings)
