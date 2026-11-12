import re
from datetime import datetime

from fastapi import APIRouter, Depends, Query

from app.core.exceptions import BadRequestError, NotFoundError
from app.database.collections import OPTIMIZATION_SUGGESTIONS, JOB_DESCRIPTIONS, RESUME_VERSIONS, RESUMES
from app.database.mongodb import get_db
from app.dependencies.auth import get_current_user
from app.schemas.common import ok
from app.services.optimizer_service import ResumeOptimizerService
from app.utils.mongo import serialize, to_object_id

router = APIRouter(prefix="/optimizer", tags=["optimizer"])


def _extract_summary(text: str) -> str:
    cleaned = re.sub(r"\s+", " ", text or "").strip()
    if not cleaned:
        return "Results-driven professional with strong execution, communication, and measurable impact aligned to the target role."
    return cleaned[:220]


def _build_optimized_resume(resume_text: str, suggestions: list[dict], job_description: str) -> str:
    summary = _extract_summary(resume_text)
    keywords = sorted({kw for item in suggestions for kw in [item.get("section", ""), item.get("suggested", "")] for kw in re.findall(r"[A-Za-z0-9+#.]{3,}", kw.lower()) if len(kw) > 3}, key=str.lower)[:12]
    selected_keywords = ", ".join(keywords) if keywords else "project delivery, stakeholder communication, measurable outcomes"

    lines = [
        "Professional Summary",
        summary,
        "",
        "Core Skills",
        selected_keywords,
        "",
        "Experience Highlights",
    ]

    resume_chunks = [p.strip() for p in (resume_text or "").splitlines() if p.strip()]
    if resume_chunks:
        lines.extend(resume_chunks[:6])
    else:
        lines.append("Delivered measurable impact across cross-functional projects and business-critical initiatives.")

    if suggestions:
        lines.extend(["", "Recommended ATS Refinements"])
        for item in suggestions[:5]:
            lines.append(f"- {item.get('section', 'Summary')}: {item.get('suggested', '').strip()}")

    return "\n".join(lines)


@router.get("/suggestions")
async def get_suggestions(
    resume_id: str = Query(..., alias="resumeId"),
    job_description_id: str = Query(..., alias="jobDescriptionId"),
    current_user: dict = Depends(get_current_user),
):
    record = await get_db()[OPTIMIZATION_SUGGESTIONS].find_one(
        {
            "userId": current_user["_id"],
            "resumeId": resume_id,
            "jobDescriptionId": job_description_id,
        },
        sort=[("createdAt", -1)],
    )
    if not record:
        raise NotFoundError("No saved optimization suggestions found.")
    return ok(serialize(record))


@router.post("/suggestions")
async def generate_suggestions(payload: dict, current_user: dict = Depends(get_current_user)):
    resume_id = (payload or {}).get("resumeId")
    job_description_id = (payload or {}).get("jobDescriptionId")
    if not resume_id or not job_description_id:
        raise BadRequestError("resumeId and jobDescriptionId are required.")

    resume = await get_db()[RESUMES].find_one({"_id": to_object_id(resume_id), "userId": current_user["_id"]})
    job = await get_db()[JOB_DESCRIPTIONS].find_one({"_id": to_object_id(job_description_id), "userId": current_user["_id"]})
    if not resume or not job:
        raise NotFoundError("Selected resume or job description not found.")

    svc = ResumeOptimizerService()
    suggestions = await svc.generate_suggestions(resume.get("parsedText", "") or "", job.get("description") or job.get("content") or "")

    suggestion_record = {
        "userId": current_user["_id"],
        "resumeId": str(resume["_id"]),
        "jobDescriptionId": str(job["_id"]),
        "status": "generated",
        "suggestions": suggestions,
        "createdAt": datetime.utcnow(),
        "updatedAt": datetime.utcnow(),
    }
    inserted = await get_db()[OPTIMIZATION_SUGGESTIONS].insert_one(suggestion_record)
    suggestion_record["_id"] = inserted.inserted_id

    return ok({"suggestions": suggestions, "record": serialize(suggestion_record)})


@router.post("/optimize")
async def create_optimized_resume(payload: dict, current_user: dict = Depends(get_current_user)):
    resume_id = (payload or {}).get("resumeId")
    job_description_id = (payload or {}).get("jobDescriptionId")
    if not resume_id or not job_description_id:
        raise BadRequestError("resumeId and jobDescriptionId are required.")

    resume = await get_db()[RESUMES].find_one({"_id": to_object_id(resume_id), "userId": current_user["_id"]})
    job = await get_db()[JOB_DESCRIPTIONS].find_one({"_id": to_object_id(job_description_id), "userId": current_user["_id"]})
    if not resume or not job:
        raise NotFoundError("Selected resume or job description not found.")

    svc = ResumeOptimizerService()
    job_text = job.get("description") or job.get("content") or ""
    suggestions = await svc.generate_suggestions(resume.get("parsedText", "") or "", job_text)
    optimized_resume = _build_optimized_resume(resume.get("parsedText", "") or "", suggestions, job_text)

    version_number = 1 + await get_db()[RESUME_VERSIONS].count_documents({"userId": current_user["_id"], "resumeId": str(resume["_id"])})
    version_doc = {
        "userId": current_user["_id"],
        "resumeId": str(resume["_id"]),
        "jobDescriptionId": str(job["_id"]),
        "versionNumber": version_number,
        "content": optimized_resume,
        "createdAt": datetime.utcnow(),
        "updatedAt": datetime.utcnow(),
    }
    inserted = await get_db()[RESUME_VERSIONS].insert_one(version_doc)
    version_doc["_id"] = inserted.inserted_id

    return ok({
        "version": serialize(version_doc),
        "suggestions": suggestions,
        "optimizedResume": optimized_resume,
    })
