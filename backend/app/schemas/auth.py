import re

from pydantic import BaseModel, EmailStr, Field, field_validator


def validate_password_strength(value: str) -> str:
    if not re.search(r"[A-Z]", value):
        raise ValueError("Password must include an uppercase letter")
    if not re.search(r"[a-z]", value):
        raise ValueError("Password must include a lowercase letter")
    if not re.search(r"[0-9]", value):
        raise ValueError("Password must include a number")
    return value


class _EmailMixin(BaseModel):
    email: EmailStr

    @field_validator("email")
    @classmethod
    def _normalize_email(cls, value: str) -> str:
        return value.strip().lower()


class RegisterRequest(_EmailMixin):
    fullName: str = Field(min_length=2, max_length=100)
    password: str = Field(min_length=8, max_length=128)

    @field_validator("fullName", mode="before")
    @classmethod
    def _strip_name(cls, value):
        return value.strip() if isinstance(value, str) else value

    @field_validator("password")
    @classmethod
    def _check_password(cls, value: str) -> str:
        return validate_password_strength(value)


class LoginRequest(_EmailMixin):
    # No strength rules here: only check the password against the stored hash.
    password: str = Field(min_length=1, max_length=128)


class ForgotPasswordRequest(_EmailMixin):
    pass


class ResetPasswordRequest(BaseModel):
    token: str = Field(min_length=20, max_length=200)
    newPassword: str = Field(min_length=8, max_length=128)

    @field_validator("newPassword")
    @classmethod
    def _check_password(cls, value: str) -> str:
        return validate_password_strength(value)


class VerifyEmailRequest(BaseModel):
    token: str = Field(min_length=20, max_length=200)
