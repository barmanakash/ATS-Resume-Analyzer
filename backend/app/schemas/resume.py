from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, field_validator


class ResumeCreatePayload(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    fileType: str = Field(default="pdf")

    @field_validator("name", mode="before")
    @classmethod
    def _strip_name(cls, value):
        return value.strip() if isinstance(value, str) else value


class ResumeUpdatePayload(BaseModel):
    name: str = Field(min_length=1, max_length=200)

    @field_validator("name", mode="before")
    @classmethod
    def _strip_name(cls, value):
        return value.strip() if isinstance(value, str) else value


class ResumePublic(BaseModel):
    id: str
    userId: str
    name: str
    fileName: str
    fileType: str
    storagePath: Optional[str] = None
    status: str
    parsedText: str = ""
    extractedData: dict = {}
    createdAt: datetime
    updatedAt: datetime
