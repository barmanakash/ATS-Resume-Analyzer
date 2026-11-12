"""Runs an ATS analysis of one of the user's resumes against one of the user's job descriptions.

The score itself is computed by the deterministic engine in app.scoring.engine. This service only loads the
documents (enforcing ownership), records the lifecycle (PROCESSING -> COMPLETED or FAILED) and stores the result.
"""
import logging
from datetime import timedelta
from typing import Any, Dict, Optional

from starlette.concurrency import run_in_threadpool

from app.config import settings
from app.core.exceptions import AppError, BadRequestError, NotFoundError
from app.database.collections import JOB_DESCRIPTIONS, RESUME_ANALYSES
from app.repositories.document_repositories import (
    AnalysisRepository,
    JobDescriptionRepository,
    ResumeRepository,
)
from app.schemas.analysis import present_analysis_summary
from app.schemas.common import Pagination
from app.scoring.engine import analyze
from app.utils.mongo import parse_object_id, serialize, utcnow

logger = logging.getLogger(__name__)

PENDING = "PENDING"
PROCESSING = "PROCESSING"
COMPLETED = "COMPLETED"
FAILED = "FAILED"

# Stored as their own fields on the analysis document. Everything else the engine returns goes in analysisDetails.
_TOP_LEVEL_RESULT_KEYS = {"engineVersion", "analysisMode", "overallScore", "recommendation", "categoryScores"}
_REPORT_HEADER_KEYS = (
    "id", "resumeId", "jobDescriptionId", "resumeName", "jobTitle", "companyName", "status", "overallScore",
    "recommendation", "mandatoryGapCount", "engineVersion", "analysisMode", "createdAt", "completedAt",
)
_NOT_READY_RESUME_STATES = {PENDING, PROCESSING, FAILED}


def summarize(doc: Dict[str, Any]) -> Dict[str, Any]:
    """Compact view used by lists and by the status of a single analysis."""
    data = serialize(doc)
    out = present_analysis_summary(data)
    out["status"] = str(data.get("status") or "").upper() or None
    out["completedAt"] = data.get("completedAt")
    if out["status"] == FAILED:
        out["errorMessage"] = data.get("errorMessage")
    return out


def build_report(doc: Dict[str, Any]) -> Dict[str, Any]:
    """Flat report for the frontend: header fields + category scores + everything in analysisDetails."""
    data = serialize(doc)
    report = {key: data.get(key) for key in _REPORT_HEADER_KEYS}
    report["status"] = str(report.get("status") or "").upper() or None
    report["categoryScores"] = data.get("scoreBreakdown") or []
    report.update(data.get("analysisDetails") or {})
    return report


class AnalysisService:
    def __init__(self, db):
        self.db = db
        self.analyses = AnalysisRepository(db)
        self.resumes = ResumeRepository(db)
        self.jobs = JobDescriptionRepository(db)

    async def create(self, user_id, resume_id, job_id) -> Dict[str, Any]:
        resume = await self.resumes.get_for_user(user_id, resume_id)
        if not resume:
            raise NotFoundError("Resume not found.")
        job = await self.jobs.get_for_user(user_id, job_id)
        if not job:
            raise NotFoundError("Job description not found.")

        resume_status = str(resume.get("processingStatus") or resume.get("status") or COMPLETED).upper()
        if resume_status in _NOT_READY_RESUME_STATES:
            raise BadRequestError(
                "This resume has not finished processing. Wait a moment, or upload it again if processing failed.",
                code="RESUME_NOT_READY",
            )
        resume_text = (resume.get("parsedText") or "").strip()
        if not resume_text:
            raise BadRequestError(
                "No readable text was found in this resume, so it cannot be analyzed.", code="RESUME_NOT_READABLE"
            )
        job_text = (job.get("description") or job.get("content") or "").strip()
        if not job_text:
            raise BadRequestError("This job description is empty.", code="JOB_EMPTY")

        job_title = job.get("jobTitle") or job.get("title") or ""
        parsed = resume.get("parsedData") or resume.get("extractedData") or {}
        contact = {"email": parsed.get("email"), "phone": parsed.get("phone")}

        doc = await self.analyses.insert(
            {
                "userId": parse_object_id(user_id),
                "resumeId": resume["_id"],
                "jobDescriptionId": job["_id"],
                # Names are copied so history stays readable even if the resume is renamed later.
                "resumeName": resume.get("displayName") or resume.get("name") or resume.get("originalFileName") or "",
                "jobTitle": job_title,
                "companyName": job.get("companyName") or job.get("company") or "",
                "status": PROCESSING,
                "overallScore": None,
                "recommendation": None,
                "mandatoryGapCount": None,
                "scoreBreakdown": None,
                "analysisDetails": None,
                "completedAt": None,
                "errorMessage": None,
            }
        )

        try:
            result = await run_in_threadpool(analyze, resume_text, job_text, job_title=job_title, contact=contact)
        except Exception as exc:
            # Never log resume or job text; the exception type is enough to investigate.
            logger.error("Analysis failed analysis_id=%s error=%s", doc["_id"], type(exc).__name__)
            await self.analyses.update_for_user(
                user_id, doc["_id"], {"status": FAILED, "errorMessage": "The analysis could not be completed."}
            )
            raise AppError("The analysis could not be completed. Please try again.", code="ANALYSIS_FAILED")

        details = {k: v for k, v in result.items() if k not in _TOP_LEVEL_RESULT_KEYS}
        updated = await self.analyses.update_for_user(
            user_id,
            doc["_id"],
            {
                "status": COMPLETED,
                "overallScore": result["overallScore"],
                "recommendation": result["recommendation"],
                "mandatoryGapCount": len(result["mandatoryGaps"]),
                "engineVersion": result["engineVersion"],
                "analysisMode": result["analysisMode"],
                "scoreBreakdown": result["categoryScores"],
                "analysisDetails": details,
                "completedAt": utcnow(),
                "errorMessage": None,
            },
        )
        if updated is None:  # deleted while it was being processed
            raise NotFoundError("Analysis not found.")
        # Save what was extracted from the job description on the job itself (spec: extractedRequirements).
        await self.db[JOB_DESCRIPTIONS].update_one(
            {"_id": job["_id"], "userId": job["userId"]},
            {"$set": {"extractedRequirements": result["extractedRequirements"]}},
        )
        logger.info(
            "Analysis completed user_id=%s analysis_id=%s score=%s", user_id, doc["_id"], result["overallScore"]
        )
        return build_report(updated)

    async def list(self, user_id, pagination: Pagination, extra_filter: Optional[dict] = None):
        docs, total = await self.analyses.list_for_user(user_id, pagination, extra_filter)
        # list_for_user already serializes; summarize() is safe to call on serialized dicts too.
        return [summarize(d) for d in docs], total

    async def _get_or_404(self, user_id, analysis_id) -> Dict[str, Any]:
        doc = await self.analyses.get_for_user(user_id, analysis_id)
        if not doc:
            raise NotFoundError("Analysis not found.")
        return doc

    async def get(self, user_id, analysis_id) -> Dict[str, Any]:
        return summarize(await self._get_or_404(user_id, analysis_id))

    async def get_report(self, user_id, analysis_id) -> Dict[str, Any]:
        doc = await self._get_or_404(user_id, analysis_id)
        status = str(doc.get("status") or "").upper()
        if status in (PENDING, PROCESSING):
            raise BadRequestError("This analysis is still running.", code="ANALYSIS_NOT_COMPLETED")
        if status == FAILED:
            raise BadRequestError("This analysis failed. Run a new analysis.", code="ANALYSIS_FAILED")
        if not doc.get("engineVersion") or not doc.get("analysisDetails"):
            raise BadRequestError(
                "This analysis was created with an older version and has no detailed report. Run a new analysis.",
                code="LEGACY_ANALYSIS",
            )
        return build_report(doc)

    async def delete(self, user_id, analysis_id) -> None:
        if not await self.analyses.delete_for_user(user_id, analysis_id):
            raise NotFoundError("Analysis not found.")
        logger.info("Analysis deleted user_id=%s analysis_id=%s", user_id, analysis_id)


async def fail_stale_analyses(db) -> int:
    """Marks analyses left PENDING/PROCESSING (for example by a server restart) as FAILED so they do not hang."""
    # Naive UTC is how MongoDB stores dates, and it compares correctly in both MongoDB and the test double.
    cutoff = (utcnow() - timedelta(minutes=settings.stale_job_minutes)).replace(tzinfo=None)
    result = await db[RESUME_ANALYSES].update_many(
        {"status": {"$in": [PENDING, PROCESSING]}, "createdAt": {"$lt": cutoff}},
        {"$set": {"status": FAILED, "errorMessage": "The analysis did not finish. Please run it again."}},
    )
    return result.modified_count
