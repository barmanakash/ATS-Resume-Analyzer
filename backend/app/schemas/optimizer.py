from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field, field_validator, model_validator

from app.schemas.resume import clean_single_line

VERSION_SUMMARY_FIELDS = (
    "id", "resumeId", "analysisId", "jobDescriptionId", "versionNumber", "name", "kind", "mode", "resumeName",
    "jobTitle", "companyName", "pendingCount", "createdAt", "updatedAt",
)


class OptimizePayload(BaseModel):
    # auto: AI when it is configured, otherwise rules. rules: never AI. ai: AI only (an error if it is not available).
    mode: Literal["auto", "rules", "ai"] = "auto"


class VersionUpdatePayload(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    content: Optional[Dict[str, Any]] = None

    @field_validator("name", mode="before")
    @classmethod
    def _name(cls, value: Any) -> Any:
        return clean_single_line(value) if isinstance(value, str) else value

    @model_validator(mode="after")
    def _something_to_change(self):
        if self.name is None and self.content is None:
            raise ValueError("Send a name or content to update.")
        return self


class RestorePayload(BaseModel):
    source: str = Field(min_length=1, max_length=40)  # "original", or the id of a history entry


class SuggestionStatusPayload(BaseModel):
    status: Literal["ACCEPTED", "REJECTED", "PENDING"]


def present_suggestion(doc: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "id": doc.get("id"),
        "resumeVersionId": str(doc.get("resumeVersionId") or ""),
        "category": doc.get("category"),
        "itemId": doc.get("itemId"),
        "sectionKey": doc.get("sectionKey"),
        "original": doc.get("original"),
        "proposed": doc.get("proposed"),
        "reason": doc.get("reason"),
        "relatedRequirement": doc.get("relatedRequirement"),
        "evidenceStatus": doc.get("evidenceStatus"),
        "confidence": doc.get("confidence"),
        "source": doc.get("source"),
        "status": doc.get("status"),
        # Notes about gaps describe a problem; they have no text to apply.
        "applicable": doc.get("proposed") is not None,
    }


def present_version(doc: Dict[str, Any], suggestions: Optional[List[Dict[str, Any]]] = None) -> Dict[str, Any]:
    out = {key: doc.get(key) for key in (
        "id", "resumeId", "analysisId", "jobDescriptionId", "versionNumber", "name", "kind", "mode", "resumeName",
        "jobTitle", "companyName", "content", "baseline", "warnings", "createdAt", "updatedAt",
    )}
    out["history"] = [{"id": h["id"], "savedAt": h["savedAt"], "label": h["label"]} for h in doc.get("history", [])]
    if suggestions is not None:
        out["suggestions"] = [present_suggestion(s) for s in suggestions]
    return out


def present_version_summary(doc: Dict[str, Any]) -> Dict[str, Any]:
    return {key: doc.get(key) for key in VERSION_SUMMARY_FIELDS if key in doc}
