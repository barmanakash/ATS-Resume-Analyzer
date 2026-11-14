from typing import Optional

from fastapi import APIRouter, Depends, Query

from app.database.mongodb import get_db
from app.dependencies.auth import get_current_user
from app.schemas.common import Pagination, get_pagination, ok, page_meta
from app.schemas.optimizer import RestorePayload, SuggestionStatusPayload, VersionUpdatePayload
from app.services.optimizer_service import OptimizerService

versions_router = APIRouter(prefix="/versions", tags=["versions"])
suggestions_router = APIRouter(prefix="/suggestions", tags=["suggestions"])


def _service() -> OptimizerService:
    return OptimizerService(get_db())


@versions_router.get("")
async def list_versions(
    resume_id: Optional[str] = Query(None, alias="resumeId", max_length=64),
    pagination: Pagination = Depends(get_pagination),
    current_user: dict = Depends(get_current_user),
):
    items, total = await _service().list(current_user["_id"], pagination, resume_id)
    return ok(items, meta=page_meta(total, pagination))


@versions_router.get("/{version_id}")
async def get_version(version_id: str, current_user: dict = Depends(get_current_user)):
    return ok(await _service().get(current_user["_id"], version_id))


@versions_router.patch("/{version_id}")
async def update_version(version_id: str, payload: VersionUpdatePayload, current_user: dict = Depends(get_current_user)):
    return ok(await _service().update(current_user["_id"], version_id, payload))


@versions_router.post("/{version_id}/restore")
async def restore_version(version_id: str, payload: RestorePayload, current_user: dict = Depends(get_current_user)):
    return ok(await _service().restore(current_user["_id"], version_id, payload.source))


@versions_router.delete("/{version_id}")
async def delete_version(version_id: str, current_user: dict = Depends(get_current_user)):
    await _service().delete(current_user["_id"], version_id)
    return ok({"deleted": True, "id": version_id})


@suggestions_router.patch("/{suggestion_id}")
async def update_suggestion(suggestion_id: str, payload: SuggestionStatusPayload, current_user: dict = Depends(get_current_user)):
    """Accept, reject or reset one suggestion. Returns the whole version so the client can refresh in one step."""
    return ok(await _service().set_suggestion_status(current_user["_id"], suggestion_id, payload.status))
