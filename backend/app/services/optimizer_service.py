import logging
import uuid
from copy import deepcopy
from typing import Any, Dict, List, Optional

from app.core.exceptions import BadGatewayError, BadRequestError, ConflictError, NotFoundError, ServiceUnavailableError
from app.optimizer import ai, rules
from app.optimizer.document import build_document, find_item, set_item_text, validate_document
from app.repositories.document_repositories import AnalysisRepository, ResumeRepository
from app.repositories.optimizer_repositories import SuggestionRepository, VersionRepository
from app.schemas.common import Pagination
from app.schemas.optimizer import (
    VersionUpdatePayload, present_suggestion, present_version, present_version_summary,
)
from app.utils.mongo import parse_object_id, serialize, utcnow

logger = logging.getLogger(__name__)

MAX_HISTORY = 20


class OptimizerService:
    def __init__(self, db):
        self.versions = VersionRepository(db)
        self.suggestions = SuggestionRepository(db)
        self.analyses = AnalysisRepository(db)
        self.resumes = ResumeRepository(db)

    # ------------------------------------------------------------------ create

    async def create_from_analysis(self, user_id, analysis_id, mode: str = "auto") -> Dict[str, Any]:
        analysis = await self.analyses.get_for_user(user_id, analysis_id)
        if not analysis:
            raise NotFoundError("Analysis not found.")
        if not analysis.get("engineVersion"):
            raise BadRequestError(
                "This analysis was created by an older version and has no detailed report. Run a new analysis first.",
                code="ANALYSIS_TOO_OLD",
            )
        resume = await self.resumes.get_for_user(user_id, analysis.get("resumeId"))
        if not resume:
            raise NotFoundError("The resume for this analysis no longer exists.")
        resume_text = (resume.get("parsedText") or "").strip()
        if not resume_text:
            raise BadRequestError("No text could be read from this resume.", code="RESUME_UNREADABLE")

        ai_available = ai.ai_configured()
        if mode == "ai" and not ai_available:
            raise ServiceUnavailableError(
                "AI suggestions are not configured on this server (OPENAI_API_KEY is not set). "
                "Use rule-based suggestions instead.",
                code="AI_NOT_CONFIGURED",
            )

        parsed = resume.get("parsedData") or {}
        document = build_document(resume_text, {"email": parsed.get("email"), "phone": parsed.get("phone")})
        suggestions = rules.generate(document, analysis, resume_text)
        used_mode = "rules"
        warnings: List[str] = []

        if mode in ("auto", "ai") and ai_available:
            try:
                ai_items, rejected = await ai.generate(ai.get_ai_client(), document, analysis, resume_text)
            except ai.AIOptimizerError:
                if mode == "ai":
                    raise BadGatewayError(
                        "The AI provider could not produce suggestions right now. Try again, or use rule-based suggestions.",
                        code="AI_PROVIDER_ERROR",
                    )
                warnings.append("AI suggestions were unavailable, so rule-based suggestions are shown.")
            else:
                # One suggestion per line: where the AI proposes a rewrite, it replaces any rule-based change to that line.
                targeted = {s["itemId"] for s in ai_items}
                suggestions = ai_items + [s for s in suggestions if s["itemId"] is None or s["itemId"] not in targeted]
                used_mode = "ai"
                if rejected:
                    warnings.append(
                        f"{len(rejected)} AI suggestion(s) were discarded because they added details that are not on your resume."
                    )

        resume_id = str(resume["_id"])
        number = 1 + await self.versions.col.count_documents(
            {"userId": parse_object_id(user_id), "resumeId": resume_id}
        )
        job_title = analysis.get("jobTitle") or ""
        version = await self.versions.insert({
            "userId": parse_object_id(user_id),
            "resumeId": resume_id,
            "analysisId": str(analysis["_id"]),
            "jobDescriptionId": analysis.get("jobDescriptionId"),
            "versionNumber": number,
            "name": f"{job_title} - optimized" if job_title else f"Optimized resume {number}",
            "kind": "optimized",
            "mode": used_mode,
            "resumeName": resume.get("displayName") or analysis.get("resumeName") or "Resume",
            "jobTitle": job_title,
            "companyName": analysis.get("companyName") or "",
            "content": document,
            "baseline": deepcopy(document),  # the untouched starting point, so "restore original" always works
            "history": [],
            "warnings": warnings,
            "pendingCount": sum(1 for s in suggestions if s["proposed"] is not None),
        })

        now = utcnow()
        if suggestions:
            await self.suggestions.col.insert_many([
                {
                    **s,
                    "userId": parse_object_id(user_id),
                    "resumeVersionId": version["_id"],
                    "resumeId": resume_id,
                    "analysisId": str(analysis["_id"]),
                    "order": index,
                    "status": "PENDING",
                    "createdAt": now,
                    "updatedAt": now,
                }
                for index, s in enumerate(suggestions)
            ])
        logger.info(
            "Optimized version created user_id=%s version_id=%s mode=%s suggestions=%s",
            user_id, version["_id"], used_mode, len(suggestions),
        )
        return await self._detail(user_id, version)

    # ------------------------------------------------------------------ read

    async def _get_or_404(self, user_id, version_id) -> dict:
        doc = await self.versions.get_for_user(user_id, version_id)
        # Versions from the old optimizer stored plain text; they cannot be edited here.
        if not doc or not isinstance(doc.get("content"), dict):
            raise NotFoundError("Version not found.")
        return doc

    async def _detail(self, user_id, version_doc: dict) -> Dict[str, Any]:
        suggestions = await self.suggestions.list_for_version(user_id, version_doc["_id"])
        return present_version(serialize(version_doc), suggestions)

    async def get(self, user_id, version_id) -> Dict[str, Any]:
        return await self._detail(user_id, await self._get_or_404(user_id, version_id))

    async def list(self, user_id, pagination: Pagination, resume_id: Optional[str] = None):
        extra: Dict[str, Any] = {"kind": "optimized"}
        if resume_id:
            extra["resumeId"] = resume_id
        items, total = await self.versions.list_for_user(user_id, pagination, extra_filter=extra)
        return [present_version_summary(i) for i in items], total

    # ------------------------------------------------------------------ edit

    @staticmethod
    def _with_history(doc: dict, label: str) -> List[dict]:
        entries = list(doc.get("history", []))
        entries.append({"id": uuid.uuid4().hex, "savedAt": utcnow(), "label": label, "content": deepcopy(doc["content"])})
        return entries[-MAX_HISTORY:]

    async def _reconcile(self, user_id, version_doc: dict, reset_all: bool = False) -> None:
        """Makes each suggestion's status agree with the text now in the version.

        A suggestion whose proposed text is in place is ACCEPTED. One that was accepted but no longer matches (the
        line was edited or restored) goes back to PENDING. Rejected ones stay rejected unless `reset_all`."""
        for s in await self.suggestions.list_for_version(user_id, version_doc["_id"]):
            if s.get("proposed") is None:
                continue
            found = find_item(version_doc["content"], s.get("itemId"))
            status = s["status"]
            if reset_all:
                status = "PENDING"
            elif found and found[1]["text"] == s["proposed"]:
                status = "ACCEPTED"
            elif status == "ACCEPTED":
                status = "PENDING"
            if status != s["status"]:
                await self.suggestions.update_for_user(user_id, s["id"], {"status": status})
        await self._refresh_pending(user_id, version_doc["_id"])

    async def _refresh_pending(self, user_id, version_oid) -> None:
        pending = await self.suggestions.col.count_documents({
            "userId": parse_object_id(user_id), "resumeVersionId": version_oid,
            "status": "PENDING", "proposed": {"$ne": None},
        })
        await self.versions.col.update_one(
            {"_id": version_oid, "userId": parse_object_id(user_id)}, {"$set": {"pendingCount": pending}}
        )

    async def update(self, user_id, version_id, payload: VersionUpdatePayload) -> Dict[str, Any]:
        doc = await self._get_or_404(user_id, version_id)
        fields: Dict[str, Any] = {}
        if payload.name is not None:
            fields["name"] = payload.name
        content_changed = False
        if payload.content is not None:
            content = validate_document(payload.content)
            if content != doc["content"]:
                fields["history"] = self._with_history(doc, "Saved changes")
                fields["content"] = content
                content_changed = True
        updated = doc
        if fields:
            updated = await self.versions.update_for_user(user_id, version_id, fields)
        if content_changed:
            await self._reconcile(user_id, updated)
            updated = await self._get_or_404(user_id, version_id)
        return await self._detail(user_id, updated)

    async def restore(self, user_id, version_id, source: str) -> Dict[str, Any]:
        doc = await self._get_or_404(user_id, version_id)
        if source == "original":
            target = doc.get("baseline")
        else:
            target = next((h["content"] for h in doc.get("history", []) if h["id"] == source), None)
        if not isinstance(target, dict):
            raise NotFoundError("That saved copy is no longer available.")
        label = "Before restoring the original" if source == "original" else "Before restoring an earlier copy"
        updated = await self.versions.update_for_user(
            user_id, version_id, {"content": deepcopy(target), "history": self._with_history(doc, label)}
        )
        await self._reconcile(user_id, updated, reset_all=(source == "original"))
        return await self._detail(user_id, await self._get_or_404(user_id, version_id))

    async def delete(self, user_id, version_id) -> None:
        doc = await self._get_or_404(user_id, version_id)
        await self.suggestions.col.delete_many({"userId": parse_object_id(user_id), "resumeVersionId": doc["_id"]})
        await self.versions.delete_for_user(user_id, version_id)
        logger.info("Version deleted user_id=%s version_id=%s", user_id, version_id)

    # ------------------------------------------------------------------ suggestions

    async def set_suggestion_status(self, user_id, suggestion_id, status: str) -> Dict[str, Any]:
        suggestion = await self.suggestions.get_for_user(user_id, suggestion_id)
        if not suggestion:
            raise NotFoundError("Suggestion not found.")
        version = await self._get_or_404(user_id, suggestion.get("resumeVersionId"))
        proposed = suggestion.get("proposed")
        item_id = suggestion.get("itemId")
        content = version["content"]
        found = find_item(content, item_id)

        new_content: Optional[dict] = None
        label = ""
        if status == "ACCEPTED":
            if proposed is None:
                raise BadRequestError("This note describes a gap and has no text to apply.", code="SUGGESTION_NOT_APPLICABLE")
            if not found:
                raise ConflictError("That line no longer exists in this version.", code="SUGGESTION_CONFLICT")
            current = found[1]["text"]
            if current != proposed:
                if current != suggestion.get("original"):
                    raise ConflictError(
                        "This line was changed after the suggestion was made. Edit it manually, "
                        "or restore the original text first.",
                        code="SUGGESTION_CONFLICT",
                    )
                new_content, label = deepcopy(content), "Accepted a suggestion"
                set_item_text(new_content, item_id, proposed)
        elif suggestion["status"] == "ACCEPTED" and proposed is not None and found and found[1]["text"] == proposed:
            # Undoing an accepted change puts the original wording back (only if the line was not edited since).
            new_content, label = deepcopy(content), "Undid a suggestion"
            set_item_text(new_content, item_id, suggestion["original"])

        if new_content is not None:
            await self.versions.update_for_user(
                user_id, version["_id"], {"content": new_content, "history": self._with_history(version, label)}
            )
        await self.suggestions.update_for_user(user_id, suggestion_id, {"status": status})
        await self._refresh_pending(user_id, version["_id"])
        return await self._detail(user_id, await self._get_or_404(user_id, version["_id"]))
