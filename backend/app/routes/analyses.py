import re
from collections import Counter

from fastapi import APIRouter, Depends

from app.core.exceptions import BadRequestError, NotFoundError
from app.database.collections import RESUME_ANALYSES, RESUMES, JOB_DESCRIPTIONS
from app.database.mongodb import get_db
from app.dependencies.auth import get_current_user
from app.schemas.common import ok, page_meta, get_pagination
from app.utils.mongo import serialize, to_object_id

router = APIRouter(prefix="/analyses", tags=["analyses"])


STOP_WORDS = {
    "with", "from", "that", "this", "have", "will", "your", "into", "over", "they",
    "them", "their", "about", "should", "could", "would", "been", "also", "using",
    "used", "made", "role", "team", "work", "job", "resume", "experience", "skills",
    "responsibilities", "requirements", "description", "candidate", "strong", "excellent",
    "preferred", "ability", "and", "are", "hiring", "years", "year", "need", "needs",
    "we", "our", "us", "want", "looking", "join", "interested", "across", "within"
}


def _keywords(text: str):
    tokens = re.findall(r"[a-z0-9+#]+(?:\.[a-z0-9+#]+)?", (text or "").lower())
    return [token for token in tokens if token not in STOP_WORDS and len(token) > 2]


def _build_analysis(resume_text: str, job_text: str):
    resume_kw = Counter(_keywords(resume_text))
    job_kw = Counter(_keywords(job_text))

    if not job_kw:
        return {
            "overallScore": 0,
            "matchedSkills": [],
            "missingSkills": [],
            "partialMatches": [],
            "recommendations": ["Add job requirements to improve the match analysis."],
            "analysisDetails": {
                "matchedKeywordCount": 0,
                "totalJobKeywords": 0,
                "resumeKeywordCount": len(resume_kw),
                "coverage": 0,
            },
        }

    matched = sorted((kw for kw in job_kw if resume_kw.get(kw, 0) > 0), key=lambda x: job_kw[x], reverse=True)
    missing = [kw for kw in sorted(job_kw, key=job_kw.get, reverse=True) if kw not in resume_kw]
    partial = [kw for kw in sorted(job_kw, key=job_kw.get, reverse=True) if kw in resume_kw and kw not in matched[:10]]

    keyword_coverage = len(matched) / len(job_kw)
    score = round(keyword_coverage * 100)

    if resume_text and "experience" in resume_text.lower() and "experience" in job_text.lower():
        score += 5
    if resume_text and any(token in resume_text.lower() for token in ["python", "sql", "aws", "docker", "react"]) and any(token in job_text.lower() for token in ["python", "sql", "aws", "docker", "react"]):
        score += 5

    overall_score = max(0, min(100, score))
    recommendations = []
    if missing:
        recommendations.append(f"Add more evidence for: {', '.join(missing[:5])}.")
    if overall_score < 70:
        recommendations.append("Highlight the key responsibilities, tools, and metrics that map directly to the job description.")
    else:
        recommendations.append("Your resume aligns well with the role. Keep the strongest keywords and add a few role-specific wins.")

    if "leadership" in job_text.lower() and "leadership" not in resume_text.lower():
        recommendations.append("Show leadership outcomes, mentoring, or cross-functional ownership in a relevant experience bullet.")

    return {
        "overallScore": overall_score,
        "matchedSkills": matched[:10],
        "missingSkills": missing[:10],
        "partialMatches": partial[:10],
        "recommendations": recommendations[:4],
        "analysisDetails": {
            "matchedKeywordCount": len(matched),
            "totalJobKeywords": len(job_kw),
            "resumeKeywordCount": len(resume_kw),
            "coverage": round(keyword_coverage * 100),
        },
    }


@router.get("")
async def list_analyses(
    pagination=Depends(get_pagination),
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    query = {"userId": current_user["_id"]}
    total = await db[RESUME_ANALYSES].count_documents(query)
    docs = [
        serialize(doc)
        async for doc in db[RESUME_ANALYSES]
        .find(query)
        .sort("createdAt", -1)
        .skip(pagination.skip)
        .limit(pagination.page_size)
    ]
    return ok(docs, meta=page_meta(total, pagination))


@router.post("")
async def create_analysis(payload: dict, current_user: dict = Depends(get_current_user)):
    resume_id = (payload or {}).get("resumeId")
    job_id = (payload or {}).get("jobDescriptionId")
    if not resume_id or not job_id:
        raise BadRequestError("resumeId and jobDescriptionId are required.")

    resume = await get_db()[RESUMES].find_one({"_id": to_object_id(resume_id), "userId": current_user["_id"]})
    job = await get_db()[JOB_DESCRIPTIONS].find_one({"_id": to_object_id(job_id), "userId": current_user["_id"]})
    if not resume or not job:
        raise NotFoundError("Selected resume or job description not found.")

    result = _build_analysis(resume.get("parsedText", "") or "", job.get("description") or job.get("content") or "")
    doc = {
        "userId": current_user["_id"],
        "resumeId": str(resume["_id"]),
        "jobDescriptionId": str(job["_id"]),
        "status": "completed",
        "overallScore": result["overallScore"],
        "matchedSkills": result["matchedSkills"],
        "missingSkills": result["missingSkills"],
        "partialMatches": result["partialMatches"],
        "recommendations": result["recommendations"],
        "analysisDetails": result["analysisDetails"],
        "createdAt": __import__("datetime").datetime.utcnow(),
        "updatedAt": __import__("datetime").datetime.utcnow(),
    }
    inserted = await get_db()[RESUME_ANALYSES].insert_one(doc)
    doc["_id"] = inserted.inserted_id
    return ok(serialize(doc))


@router.get("/{analysis_id}")
async def get_analysis(analysis_id: str, current_user: dict = Depends(get_current_user)):
    doc = await get_db()[RESUME_ANALYSES].find_one({"_id": to_object_id(analysis_id), "userId": current_user["_id"]})
    if not doc:
        raise NotFoundError("Analysis not found.")
    return ok(serialize(doc))


@router.delete("/{analysis_id}")
async def delete_analysis(analysis_id: str, current_user: dict = Depends(get_current_user)):
    doc = await get_db()[RESUME_ANALYSES].find_one({"_id": to_object_id(analysis_id), "userId": current_user["_id"]})
    if not doc:
        raise NotFoundError("Analysis not found.")
    await get_db()[RESUME_ANALYSES].delete_one({"_id": doc["_id"]})
    return ok({"deleted": True, "id": str(doc["_id"])})
