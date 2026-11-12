from __future__ import annotations

import re
from typing import Any, Dict, Optional

from pydantic import BaseModel, Field, field_validator, model_validator

from app.schemas.resume import clean_single_line

MAX_DESCRIPTION_CHARS = 20000
_CONTROL_CHARS = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")


def _clean_multiline(value: Any) -> Any:
    if not isinstance(value, str):
        return value
    value = _CONTROL_CHARS.sub("", value).replace("\r\n", "\n").replace("\r", "\n")
    return re.sub(r"\n{3,}", "\n\n", value).strip()


class JobCreatePayload(BaseModel):
    jobTitle: str = Field(min_length=1, max_length=200)
    companyName: str = Field(default="", max_length=200)
    description: str = Field(min_length=30, max_length=MAX_DESCRIPTION_CHARS)

    @field_validator("jobTitle", "companyName", mode="before")
    @classmethod
    def _single_line(cls, value):
        return clean_single_line(value) if value is not None else ""

    @field_validator("description", mode="before")
    @classmethod
    def _multi_line(cls, value):
        return _clean_multiline(value)


class JobUpdatePayload(BaseModel):
    jobTitle: Optional[str] = Field(default=None, min_length=1, max_length=200)
    companyName: Optional[str] = Field(default=None, max_length=200)
    description: Optional[str] = Field(default=None, min_length=30, max_length=MAX_DESCRIPTION_CHARS)

    @field_validator("jobTitle", "companyName", mode="before")
    @classmethod
    def _single_line(cls, value):
        return clean_single_line(value)

    @field_validator("description", mode="before")
    @classmethod
    def _multi_line(cls, value):
        return _clean_multiline(value)

    @model_validator(mode="after")
    def _at_least_one(self):
        if self.jobTitle is None and self.companyName is None and self.description is None:
            raise ValueError("Provide at least one field to update")
        return self


def present_job(doc: dict, detail: bool = False) -> Dict[str, Any]:
    """Public view of a job description. Accepts older documents that used title/company/content."""
    description = doc.get("description") or doc.get("content") or ""
    out: Dict[str, Any] = {
        "id": doc["id"],
        "jobTitle": doc.get("jobTitle") or doc.get("title") or "",
        "companyName": doc.get("companyName") or doc.get("company") or "",
        "descriptionPreview": re.sub(r"\s+", " ", description)[:240],
        "descriptionLength": len(description),
        "createdAt": doc.get("createdAt"),
        "updatedAt": doc.get("updatedAt"),
    }
    if detail:
        out["description"] = description
        out["extractedRequirements"] = doc.get("extractedRequirements")
    return out
