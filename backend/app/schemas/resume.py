from __future__ import annotations

import re
from typing import Any, Dict, Optional

from pydantic import BaseModel, Field, field_validator

_CONTROL_CHARS = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")


def clean_single_line(value: Any) -> Any:
    if not isinstance(value, str):
        return value
    return re.sub(r"\s+", " ", _CONTROL_CHARS.sub("", value)).strip()


class ResumeUpdatePayload(BaseModel):
    """Rename a resume. The original uploaded file name is never changed."""

    displayName: str = Field(min_length=1, max_length=200)

    @field_validator("displayName", mode="before")
    @classmethod
    def _clean(cls, value):
        return clean_single_line(value)


# Older documents (created before the schema matched the spec) used different field names.
_LEGACY_STATUS = {"PROCESSED": "COMPLETED"}


def present_resume(doc: dict, detail: bool = False) -> Dict[str, Any]:
    """Public view of a resume. Takes an already-serialized document (`id`, string ids).

    Deliberately omits userId and storagePath: clients never see where a file lives on the server.
    """
    original = doc.get("originalFileName") or doc.get("fileName") or ""
    status = str(doc.get("processingStatus") or doc.get("status") or "COMPLETED").upper()
    out: Dict[str, Any] = {
        "id": doc["id"],
        "originalFileName": original,
        "displayName": doc.get("displayName") or doc.get("name") or original,
        "fileType": doc.get("fileType"),
        "fileSize": doc.get("fileSize"),
        "processingStatus": _LEGACY_STATUS.get(status, status),
        "processingError": doc.get("processingError"),
        "createdAt": doc.get("createdAt"),
        "updatedAt": doc.get("updatedAt"),
    }
    if detail:
        out["parsedText"] = doc.get("parsedText") or ""
        out["parsedData"] = doc.get("parsedData") or doc.get("extractedData") or {}
    return out
