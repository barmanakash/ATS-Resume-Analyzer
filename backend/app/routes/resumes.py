from typing import Optional
from urllib.parse import quote

from fastapi import APIRouter, Depends, File, Form, Response, UploadFile

from app.core.rate_limit import rate_limit
from app.database.mongodb import get_db
from app.dependencies.auth import get_current_user
from app.schemas.common import get_pagination, ok, page_meta
from app.schemas.resume import ResumeUpdatePayload
from app.services.resume_service import ResumeService
from app.utils.uploads import read_upload_limited

router = APIRouter(prefix="/resumes", tags=["resumes"])


def get_resume_service() -> ResumeService:
    return ResumeService(get_db())


@router.get("")
async def list_resumes(
    pagination=Depends(get_pagination),
    current_user: dict = Depends(get_current_user),
    service: ResumeService = Depends(get_resume_service),
):
    items, total = await service.list(current_user["_id"], pagination)
    return ok(items, meta=page_meta(total, pagination))


@router.post("", status_code=201, dependencies=[Depends(rate_limit("resume-upload", 30, 3600))])
async def upload_resume(
    file: UploadFile = File(...),
    displayName: Optional[str] = Form(default=None),
    current_user: dict = Depends(get_current_user),
    service: ResumeService = Depends(get_resume_service),
):
    content = await read_upload_limited(file)
    resume = await service.upload(current_user, file.filename or "", file.content_type, content, displayName)
    return ok(resume)


@router.get("/{resume_id}")
async def get_resume(
    resume_id: str,
    current_user: dict = Depends(get_current_user),
    service: ResumeService = Depends(get_resume_service),
):
    return ok(await service.get(current_user["_id"], resume_id))


@router.patch("/{resume_id}")
async def rename_resume(
    resume_id: str,
    payload: ResumeUpdatePayload,
    current_user: dict = Depends(get_current_user),
    service: ResumeService = Depends(get_resume_service),
):
    return ok(await service.rename(current_user["_id"], resume_id, payload.displayName))


@router.get("/{resume_id}/file")
async def download_resume_file(
    resume_id: str,
    current_user: dict = Depends(get_current_user),
    service: ResumeService = Depends(get_resume_service),
):
    """Streams the original upload to its owner only. Files are never served from a public URL."""
    data, name, media_type = await service.read_file(current_user["_id"], resume_id)
    ascii_name = "".join(c if 32 <= ord(c) < 127 and c not in '"\\' else "_" for c in name) or "resume"
    return Response(
        content=data,
        media_type=media_type,
        headers={
            "Content-Disposition": f"attachment; filename=\"{ascii_name}\"; filename*=UTF-8''{quote(name)}",
            "X-Content-Type-Options": "nosniff",
        },
    )


@router.delete("/{resume_id}")
async def delete_resume(
    resume_id: str,
    current_user: dict = Depends(get_current_user),
    service: ResumeService = Depends(get_resume_service),
):
    await service.delete(current_user["_id"], resume_id)
    return ok({"deleted": True, "id": resume_id})
