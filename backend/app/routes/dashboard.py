from datetime import datetime
from typing import Any, Dict, List

from fastapi import APIRouter, Depends

from app.config import settings
from app.database.collections import JOB_DESCRIPTIONS, RESUME_ANALYSES, RESUMES
from app.database.mongodb import get_db
from app.dependencies.auth import get_current_user
from app.schemas.common import ok
from app.schemas.resume import present_resume
from app.utils.mongo import parse_object_id, serialize

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

RECENT_LIMIT = 5
TREND_LIMIT = 10

# Overall scores are 0-100 numbers. `$gte: 0` only matches numeric values, so malformed records are ignored.
_HAS_SCORE = {"$gte": 0}


def _month_start_utc() -> datetime:
    """First instant of the current UTC month as a naive UTC datetime (how MongoDB stores dates)."""
    now = datetime.utcnow()
    return now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)


async def _names_by_id(db, collection: str, user_id, raw_ids, fields: Dict[str, int]) -> Dict[str, dict]:
    """Loads a few fields for the given ids. Ownership is enforced in the query, never assumed."""
    object_ids = [oid for oid in (parse_object_id(i) for i in raw_ids if i) if oid is not None]
    if not object_ids:
        return {}
    cursor = db[collection].find({"_id": {"$in": object_ids}, "userId": user_id}, fields)
    return {str(doc["_id"]): doc async for doc in cursor}


async def _present_recent_analyses(db, user_id, docs: List[dict]) -> List[Dict[str, Any]]:
    """Adds the resume and job names the dashboard shows. Only a safe subset of fields is returned."""
    resumes = await _names_by_id(
        db, RESUMES, user_id, {d.get("resumeId") for d in docs},
        {"displayName": 1, "originalFileName": 1, "fileName": 1, "name": 1},
    )
    jobs = await _names_by_id(
        db, JOB_DESCRIPTIONS, user_id, {d.get("jobDescriptionId") for d in docs},
        {"jobTitle": 1, "title": 1, "companyName": 1, "company": 1},
    )

    items = []
    for doc in docs:
        resume = resumes.get(str(doc.get("resumeId"))) or {}
        job = jobs.get(str(doc.get("jobDescriptionId"))) or {}
        score = doc.get("overallScore")
        items.append({
            "id": str(doc["_id"]),
            "resumeId": str(doc.get("resumeId") or ""),
            "jobDescriptionId": str(doc.get("jobDescriptionId") or ""),
            "status": str(doc.get("status") or "").upper() or None,
            "overallScore": score if isinstance(score, (int, float)) and not isinstance(score, bool) else None,
            # None (not a placeholder string) when the record was deleted; the UI decides how to word it.
            "resumeName": resume.get("displayName") or resume.get("name") or resume.get("originalFileName") or resume.get("fileName"),
            "jobTitle": job.get("jobTitle") or job.get("title"),
            "companyName": job.get("companyName") or job.get("company") or "",
            "createdAt": doc.get("createdAt"),
        })
    return items


@router.get("/summary")
async def dashboard_summary(current_user: dict = Depends(get_current_user)):
    db = get_db()
    user_id = current_user["_id"]
    owned = {"userId": user_id}

    total_resumes = await db[RESUMES].count_documents(owned)
    total_jobs = await db[JOB_DESCRIPTIONS].count_documents(owned)
    total_analyses = await db[RESUME_ANALYSES].count_documents(owned)
    analyses_this_month = await db[RESUME_ANALYSES].count_documents({**owned, "createdAt": {"$gte": _month_start_utc()}})

    # The average covers every scored analysis, not only the recent ones shown in the list.
    stats = await db[RESUME_ANALYSES].aggregate([
        {"$match": {**owned, "overallScore": _HAS_SCORE}},
        {"$group": {"_id": None, "average": {"$avg": "$overallScore"}}},
    ]).to_list(length=1)
    average_score = round(stats[0]["average"], 1) if stats and stats[0].get("average") is not None else None

    recent_resumes = [
        present_resume(serialize(doc))
        async for doc in db[RESUMES]
        .find(owned, {"storagePath": 0, "parsedText": 0, "parsedData": 0, "extractedData": 0})
        .sort("createdAt", -1)
        .limit(RECENT_LIMIT)
    ]

    recent_docs = [doc async for doc in db[RESUME_ANALYSES].find(owned).sort("createdAt", -1).limit(RECENT_LIMIT)]
    recent_analyses = await _present_recent_analyses(db, user_id, recent_docs)

    trend_docs = [
        doc
        async for doc in db[RESUME_ANALYSES]
        .find({**owned, "overallScore": _HAS_SCORE}, {"overallScore": 1, "createdAt": 1})
        .sort("createdAt", -1)
        .limit(TREND_LIMIT)
    ]
    score_trend = [
        {"id": str(doc["_id"]), "score": doc["overallScore"], "createdAt": doc.get("createdAt")}
        for doc in reversed(trend_docs)  # oldest first so charts read left to right
    ]

    return ok({
        "totalResumes": total_resumes,
        "totalJobDescriptions": total_jobs,
        "totalAnalyses": total_analyses,
        # None when the user has no scored analysis yet, so the UI can tell "no data" from a real 0.
        "averageCompatibilityScore": average_score,
        "recentResumes": recent_resumes,
        "recentAnalyses": recent_analyses,
        "scoreTrend": score_trend,
        "usage": {
            "analysesThisMonth": analyses_this_month,
            "resumes": {"used": total_resumes, "limit": settings.max_resumes_per_user},
            "jobDescriptions": {"used": total_jobs, "limit": settings.max_jobs_per_user},
        },
    })
