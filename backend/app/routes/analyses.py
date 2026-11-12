from fastapi import APIRouter, Depends

from app.core.rate_limit import rate_limit
from app.database.mongodb import get_db
from app.dependencies.auth import get_current_user
from app.schemas.analysis import AnalysisCreatePayload
from app.schemas.common import Pagination, get_pagination, ok, page_meta
from app.services.analysis_service import AnalysisService

router = APIRouter(prefix="/analyses", tags=["analyses"])


def _service() -> AnalysisService:
    return AnalysisService(get_db())


@router.get("")
async def list_analyses(pagination: Pagination = Depends(get_pagination), current_user: dict = Depends(get_current_user)):
    items, total = await _service().list(current_user["_id"], pagination)
    return ok(items, meta=page_meta(total, pagination))


@router.post("", status_code=201, dependencies=[Depends(rate_limit("analysis-create", 30, 3600))])
async def create_analysis(payload: AnalysisCreatePayload, current_user: dict = Depends(get_current_user)):
    return ok(await _service().create(current_user["_id"], payload))


@router.get("/{analysis_id}")
async def get_analysis(analysis_id: str, current_user: dict = Depends(get_current_user)):
    return ok(await _service().get(current_user["_id"], analysis_id))


@router.get("/{analysis_id}/report")
async def get_analysis_report(analysis_id: str, current_user: dict = Depends(get_current_user)):
    """The full report. Same content as GET /analyses/{id}; kept as its own path to match the API spec."""
    return ok(await _service().get(current_user["_id"], analysis_id))


@router.delete("/{analysis_id}")
async def delete_analysis(analysis_id: str, current_user: dict = Depends(get_current_user)):
    await _service().delete(current_user["_id"], analysis_id)
    return ok({"deleted": True, "id": analysis_id})
