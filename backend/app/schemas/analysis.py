from __future__ import annotations

from typing import Any, Dict

from pydantic import BaseModel, Field, field_validator

# Fields shown in the analysis list. The full report (requirements, evidence, recommendations) is large and is
# only sent when a single analysis is opened.
SUMMARY_FIELDS = (
    "id", "resumeId", "jobDescriptionId", "resumeName", "jobTitle", "companyName", "status", "overallScore",
    "recommendation", "mandatoryGapCount", "engineVersion", "createdAt", "updatedAt",
)


class AnalysisCreatePayload(BaseModel):
    resumeId: str = Field(min_length=1, max_length=64)
    jobDescriptionId: str = Field(min_length=1, max_length=64)

    @field_validator("resumeId", "jobDescriptionId", mode="before")
    @classmethod
    def _strip(cls, value: Any) -> Any:
        return value.strip() if isinstance(value, str) else value


def present_analysis(doc: Dict[str, Any]) -> Dict[str, Any]:
    """Full report for the owner. userId is internal and never returned."""
    return {key: value for key, value in doc.items() if key != "userId"}


def present_analysis_summary(doc: Dict[str, Any]) -> Dict[str, Any]:
    return {key: doc.get(key) for key in SUMMARY_FIELDS if key in doc}
