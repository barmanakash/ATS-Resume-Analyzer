from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, field_validator


class UserPublic(BaseModel):
    """What the API returns about a user. Never includes passwordHash."""

    id: str
    fullName: str
    email: str
    profileImage: Optional[str] = None
    isEmailVerified: bool
    createdAt: datetime
    updatedAt: datetime


def to_public_user(doc: dict) -> dict:
    return UserPublic(
        id=str(doc["_id"]),
        fullName=doc["fullName"],
        email=doc["email"],
        profileImage=doc.get("profileImage"),
        isEmailVerified=doc.get("isEmailVerified", False),
        createdAt=doc["createdAt"],
        updatedAt=doc["updatedAt"],
    ).model_dump(mode="json")


class UpdateProfileRequest(BaseModel):
    fullName: str = Field(min_length=2, max_length=100)

    @field_validator("fullName", mode="before")
    @classmethod
    def _strip_name(cls, value):
        return value.strip() if isinstance(value, str) else value


class DeleteAccountRequest(BaseModel):
    password: str = Field(min_length=1, max_length=128)
