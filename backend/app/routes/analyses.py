from fastapi import APIRouter, Depends

from app.core.rate_limit import rate_limit
from app.database.mongodb import get_db
from app.dependencies.auth import get_current_user
from app.schemas.analysis import AnalysisCreatePayload
from app.schemas.common import get_pagination, ok, page_meta
from app.services.analysis_service import AnalysisService

router = APIRouter(prefix="/analyses", tags=["analyses"])


def get_analysis_service() -> AnalysisService:
    return AnalysisService(get_db())


@router.get("")
async def list_analyses(
    pagination=Depends(get_pagination),
    current_user: dict = Depends(get_current_user),
    service: AnalysisService = Depends(get_analysis_service),
):
    items, total = await service.list(current_user["_id"], pagination)
    return ok(items, meta=page_meta(total, pagination))


@router.post("", status_code=201, dependencies=[Depends(rate_limit("create-analysis", 60, 3600))])
async def create_analysis(
    payload: AnalysisCreatePayload,
    current_user: dict = Depends(get_current_user),
    service: AnalysisService = Depends(get_analysis_service),
):
    """Analyzes one of the user's resumes against one of the user's job descriptions.

    The rule-based engine runs in milliseconds, so the finished report is returned directly.
    The record still goes PROCESSING -> COMPLETED/FAILED so the lifecycle is explicit and a future
    AI step can run asynchronously without changing the API.
    """
    report = await service.create(current_user["_id"], payload.resumeId, payload.jobDescriptionId)
    return ok(report)


@router.get("/{analysis_id}")
async def get_analysis(
    analysis_id: str,
    current_user: dict = Depends(get_current_user),
    service: AnalysisService = Depends(get_analysis_service),
):
    return ok(await service.get(current_user["_id"], analysis_id))


@router.get("/{analysis_id}/report")
async def get_analysis_report(
    analysis_id: str,
    current_user: dict = Depends(get_current_user),
    service: AnalysisService = Depends(get_analysis_service),
):
    return ok(await service.get_report(current_user["_id"], analysis_id))


@router.delete("/{analysis_id}")
async def delete_analysis(
    analysis_id: str,
    current_user: dict = Depends(get_current_user),
    service: AnalysisService = Depends(get_analysis_service),
):
    await service.delete(current_user["_id"], analysis_id)
    return ok({"deleted": True, "id": analysis_id})
