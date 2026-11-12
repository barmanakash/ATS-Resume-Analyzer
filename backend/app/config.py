from functools import lru_cache
from typing import List, Optional

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """All configuration comes from environment variables (or a local .env file)."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "ATS Resume Analyzer API"
    app_env: str = "development"  # development | staging | production | test
    api_prefix: str = "/api/v1"
    log_level: str = "INFO"

    # Database
    mongodb_uri: str = "mongodb://localhost:27017/ats_resume_analyzer"
    mongodb_db_name: str = "ats_resume_analyzer"

    # Auth
    jwt_secret_key: str = "development-secret-key-at-least-32-characters!"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7
    email_verification_expire_hours: int = 24
    password_reset_expire_minutes: int = 30
    require_email_verification: bool = True

    # Web
    cors_origins: str = "http://localhost:3000"
    frontend_url: str = "http://localhost:3000"
    cookie_secure: bool = False
    cookie_samesite: str = "lax"
    cookie_domain: Optional[str] = None

    rate_limit_enabled: bool = True

    # Email
    smtp_host: Optional[str] = None
    smtp_port: int = 587
    smtp_username: Optional[str] = None
    smtp_password: Optional[str] = None
    smtp_starttls: bool = True
    smtp_use_ssl: bool = False
    email_from: str = "ATS Resume Analyzer <no-reply@example.com>"

    # AI provider (OpenAI by default; the provider layer is pluggable)
    ai_provider: str = "openai"
    openai_api_key: Optional[str] = None
    openai_model: str = "gpt-4o-mini"
    openai_base_url: Optional[str] = None  # for OpenAI-compatible gateways
    ai_timeout_seconds: float = 60.0
    ai_max_retries: int = 3
    ai_retry_base_delay_seconds: float = 1.0
    ai_max_input_chars: int = 30000  # resume / job text sent to the model is truncated to this

    # ATS scoring. Weights are relative and are normalised to add up to 100.
    ats_weight_technical_skills: float = 30
    ats_weight_experience: float = 20
    ats_weight_responsibilities: float = 15
    ats_weight_keywords: float = 15
    ats_weight_education: float = 10
    ats_weight_structure: float = 10
    ats_ready_threshold: int = 75  # score at or above this -> READY_TO_APPLY
    ats_improve_threshold: int = 50  # score at or above this -> IMPROVE_BEFORE_APPLYING, below -> LOW_COMPATIBILITY
    ats_block_ready_on_mandatory_gaps: bool = True  # a missing mandatory requirement prevents READY_TO_APPLY

    # File storage
    storage_backend: str = "local"  # local | s3
    local_storage_dir: str = "storage"
    s3_bucket: Optional[str] = None
    s3_region: Optional[str] = None
    s3_endpoint_url: Optional[str] = None
    s3_signed_url_expire_seconds: int = 300

    # Uploads, quotas and OCR
    max_upload_mb: int = 5
    max_resumes_per_user: int = 50
    max_jobs_per_user: int = 200
    ocr_enabled: bool = True
    ocr_max_pages: int = 5
    ocr_language: str = "eng"
    tesseract_cmd: Optional[str] = None  # full path to tesseract.exe if it is not on PATH
    stale_job_minutes: int = 15  # PENDING/PROCESSING records older than this are marked FAILED on startup

    @field_validator("jwt_secret_key")
    @classmethod
    def _validate_secret(cls, value: str) -> str:
        if len(value) < 32 or value.lower().startswith("change-me"):
            raise ValueError(
                "JWT_SECRET_KEY must be a random string of at least 32 characters. "
                'Generate one with: python -c "import secrets; print(secrets.token_urlsafe(64))"'
            )
        return value

    @field_validator("cookie_samesite")
    @classmethod
    def _validate_samesite(cls, value: str) -> str:
        value = value.lower()
        if value not in {"lax", "strict", "none"}:
            raise ValueError("COOKIE_SAMESITE must be lax, strict or none")
        return value

    @field_validator("storage_backend")
    @classmethod
    def _validate_storage_backend(cls, value: str) -> str:
        value = value.lower()
        if value not in {"local", "s3"}:
            raise ValueError("STORAGE_BACKEND must be local or s3")
        return value

    @field_validator(
        "cookie_domain", "smtp_host", "smtp_username", "smtp_password",
        "openai_api_key", "openai_base_url", "s3_bucket", "s3_region", "s3_endpoint_url", "tesseract_cmd",
        mode="before",
    )
    @classmethod
    def _empty_to_none(cls, value):
        if isinstance(value, str) and not value.strip():
            return None
        return value

    @model_validator(mode="after")
    def _validate_cookie_rules(self):
        if self.cookie_samesite == "none" and not self.cookie_secure:
            raise ValueError("COOKIE_SAMESITE=none requires COOKIE_SECURE=true")
        if self.app_env == "production" and not self.cookie_secure:
            raise ValueError("COOKIE_SECURE must be true when APP_ENV=production")
        if self.storage_backend == "s3" and not self.s3_bucket:
            raise ValueError("S3_BUCKET is required when STORAGE_BACKEND=s3")
        return self

    @model_validator(mode="after")
    def _validate_ats_scoring(self):
        weights = [
            self.ats_weight_technical_skills, self.ats_weight_experience, self.ats_weight_responsibilities,
            self.ats_weight_keywords, self.ats_weight_education, self.ats_weight_structure,
        ]
        if any(w < 0 for w in weights) or sum(weights) <= 0:
            raise ValueError("ATS_WEIGHT_* values must not be negative and at least one must be above zero")
        if not (0 <= self.ats_improve_threshold < self.ats_ready_threshold <= 100):
            raise ValueError("ATS thresholds must satisfy 0 <= ATS_IMPROVE_THRESHOLD < ATS_READY_THRESHOLD <= 100")
        return self

    @property
    def cors_origin_list(self) -> List[str]:
        return [o.strip().rstrip("/") for o in self.cors_origins.split(",") if o.strip()]

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"

    @property
    def max_upload_bytes(self) -> int:
        return self.max_upload_mb * 1024 * 1024

    @property
    def max_request_body_bytes(self) -> int:
        # Upload limit plus headroom for multipart overhead. Also bounds JSON bodies.
        return self.max_upload_bytes + 1024 * 1024


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
