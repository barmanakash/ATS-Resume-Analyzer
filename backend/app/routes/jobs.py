from fastapi import APIRouter, Depends, File, UploadFile

from app.core.rate_limit import rate_limit
from app.database.mongodb import get_db
from app.dependencies.auth import get_current_user
from app.schemas.common import get_pagination, ok, page_meta
from app.schemas.job_description import JobCreatePayload, JobUpdatePayload
from app.services.job_service import JobService
from app.utils.uploads import read_upload_limited

router = APIRouter(prefix="/jobs", tags=["job-descriptions"])


def get_job_service() -> JobService:
    return JobService(get_db())


@router.get("")
async def list_jobs(
    pagination=Depends(get_pagination),
    current_user: dict = Depends(get_current_user),
    service: JobService = Depends(get_job_service),
):
    items, total = await service.list(current_user["_id"], pagination)
    return ok(items, meta=page_meta(total, pagination))


@router.post("", status_code=201)
async def create_job(
    payload: JobCreatePayload,
    current_user: dict = Depends(get_current_user),
    service: JobService = Depends(get_job_service),
):
    return ok(await service.create(current_user["_id"], payload))


# Declared before "/{job_id}" so "extract-text" is not read as an id.
@router.post("/extract-text", dependencies=[Depends(rate_limit("job-extract-text", 30, 3600))])
async def extract_job_text(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    """Reads a PDF, DOCX or TXT job description so the form can be pre-filled. Nothing is stored."""
    content = await read_upload_limited(file)
    return ok(await JobService.extract_text_from_file(file.filename or "", file.content_type, content))


@router.get("/{job_id}")
async def get_job(
    job_id: str,
    current_user: dict = Depends(get_current_user),
    service: JobService = Depends(get_job_service),
):
    return ok(await service.get(current_user["_id"], job_id))


@router.patch("/{job_id}")
async def update_job(
    job_id: str,
    payload: JobUpdatePayload,
    current_user: dict = Depends(get_current_user),
    service: JobService = Depends(get_job_service),
):
    return ok(await service.update(current_user["_id"], job_id, payload))


@router.delete("/{job_id}")
async def delete_job(
    job_id: str,
    current_user: dict = Depends(get_current_user),
    service: JobService = Depends(get_job_service),
):
    await service.delete(current_user["_id"], job_id)
    return ok({"deleted": True, "id": job_id})
