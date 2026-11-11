from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, field_validator


class JobDescriptionCreatePayload(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    company: str = Field(min_length=1, max_length=200)
    content: str = Field(min_length=10, max_length=20000)
    sourceType: str = "manual"

    @field_validator("title", "company", mode="before")
    @classmethod
    def _strip_value(cls, value):
        return value.strip() if isinstance(value, str) else value


class JobDescriptionUpdatePayload(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    company: Optional[str] = Field(default=None, min_length=1, max_length=200)
    content: Optional[str] = Field(default=None, min_length=10, max_length=20000)
    sourceType: Optional[str] = None


class JobDescriptionPublic(BaseModel):
    id: str
    userId: str
    title: str
    company: str
    content: str
    sourceType: str
    createdAt: datetime
    updatedAt: datetime
