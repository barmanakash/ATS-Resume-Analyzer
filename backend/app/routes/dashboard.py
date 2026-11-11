from fastapi import APIRouter, Depends

from app.database.collections import RESUME_ANALYSES, RESUMES
from app.database.mongodb import get_db
from app.dependencies.auth import get_current_user
from app.schemas.common import ok
from app.utils.mongo import serialize

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/summary")
async def dashboard_summary(current_user: dict = Depends(get_current_user)):
    db = get_db()
    total_resumes = await db[RESUMES].count_documents({"userId": current_user["_id"]})
    total_analyses = await db[RESUME_ANALYSES].count_documents({"userId": current_user["_id"]})

    cursor = db[RESUME_ANALYSES].find({"userId": current_user["_id"]}, {"overallScore": 1})
    scores = [doc.get("overallScore", 0) async for doc in cursor]
    average_score = round(sum(scores) / len(scores), 2) if scores else 0

    recent_resumes = [
        serialize(doc)
        async for doc in db[RESUMES].find({"userId": current_user["_id"]}, {"storagePath": 0, "parsedText": 0, "parsedData": 0}).sort("createdAt", -1).limit(5)
    ]
    recent_analyses = [
        serialize(doc)
        async for doc in db[RESUME_ANALYSES].find({"userId": current_user["_id"]}).sort("createdAt", -1).limit(5)
    ]

    return ok({
        "totalResumes": total_resumes,
        "totalAnalyses": total_analyses,
        "averageCompatibilityScore": average_score,
        "recentResumes": recent_resumes,
        "recentAnalyses": recent_analyses,
    })
