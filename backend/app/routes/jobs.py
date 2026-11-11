import re
from typing import Optional

from fastapi import APIRouter, Depends

from app.core.exceptions import BadRequestError, NotFoundError
from app.database.collections import JOB_DESCRIPTIONS
from app.database.mongodb import get_db
from app.dependencies.auth import get_current_user
from app.schemas.common import ok, page_meta, get_pagination
from app.utils.mongo import serialize, to_object_id

router = APIRouter(prefix="/jobs", tags=["job-descriptions"])


@router.get("")
async def list_jobs(
    pagination=Depends(get_pagination),
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    query = {"userId": current_user["_id"]}
    total = await db[JOB_DESCRIPTIONS].count_documents(query)
    docs = [
        serialize(doc)
        async for doc in db[JOB_DESCRIPTIONS]
        .find(query)
        .sort("createdAt", -1)
        .skip(pagination.skip)
        .limit(pagination.page_size)
    ]
    return ok(docs, meta=page_meta(total, pagination))


@router.post("")
async def create_job(payload: dict, current_user: dict = Depends(get_current_user)):
    title = (payload or {}).get("title")
    company = (payload or {}).get("company")
    content = (payload or {}).get("content")
    if not title or not company or not content:
        raise BadRequestError("Title, company and content are required.")
    doc = {
        "userId": current_user["_id"],
        "title": str(title).strip(),
        "company": str(company).strip(),
        "content": str(content).strip(),
        "sourceType": (payload or {}).get("sourceType") or "manual",
        "createdAt": __import__("datetime").datetime.utcnow(),
        "updatedAt": __import__("datetime").datetime.utcnow(),
    }
    result = await get_db()[JOB_DESCRIPTIONS].insert_one(doc)
    doc["_id"] = result.inserted_id
    return ok(serialize(doc))


@router.get("/{job_id}")
async def get_job(job_id: str, current_user: dict = Depends(get_current_user)):
    doc = await get_db()[JOB_DESCRIPTIONS].find_one({"_id": to_object_id(job_id), "userId": current_user["_id"]})
    if not doc:
        raise NotFoundError("Job description not found.")
    return ok(serialize(doc))


@router.patch("/{job_id}")
async def update_job(job_id: str, payload: dict, current_user: dict = Depends(get_current_user)):
    updates = {k: v for k, v in (payload or {}).items() if v is not None and k in {"title", "company", "content", "sourceType"}}
    if not updates:
        raise BadRequestError("No valid fields provided.")
    for k in ["title", "company", "content"]:
        if k in updates:
            updates[k] = str(updates[k]).strip()
    updated = await get_db()[JOB_DESCRIPTIONS].find_one_and_update(
        {"_id": to_object_id(job_id), "userId": current_user["_id"]},
        {"$set": {**updates, "updatedAt": __import__("datetime").datetime.utcnow()}},
        return_document=True,
    )
    if not updated:
        raise NotFoundError("Job description not found.")
    return ok(serialize(updated))


@router.delete("/{job_id}")
async def delete_job(job_id: str, current_user: dict = Depends(get_current_user)):
    doc = await get_db()[JOB_DESCRIPTIONS].find_one({"_id": to_object_id(job_id), "userId": current_user["_id"]})
    if not doc:
        raise NotFoundError("Job description not found.")
    await get_db()[JOB_DESCRIPTIONS].delete_one({"_id": doc["_id"]})
    return ok({"deleted": True, "id": str(doc["_id"])})
