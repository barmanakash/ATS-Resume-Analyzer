from fastapi import APIRouter, Depends, Response

from app.core.rate_limit import rate_limit
from app.database.mongodb import get_db
from app.dependencies.auth import get_current_user
from app.schemas.exports import ExportPayload
from app.services.export_service import ExportService

router = APIRouter(prefix="/versions", tags=["exports"])


@router.post("/{version_id}/export", dependencies=[Depends(rate_limit("export", 60, 3600))])
async def export_version(version_id: str, payload: ExportPayload, current_user: dict = Depends(get_current_user)):
    """Downloads a resume version as a PDF or DOCX file."""
    result = await ExportService(get_db()).export_version(current_user["_id"], version_id, payload)
    headers = {
        "Content-Disposition": f'attachment; filename="{result.filename}"',
        "Cache-Control": "no-store",  # a resume is personal data; do not let browsers or proxies keep a copy
    }
    if result.warnings:
        headers["X-Export-Warnings"] = " ".join(result.warnings)
    return Response(content=result.content, media_type=result.media_type, headers=headers)
