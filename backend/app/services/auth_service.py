import logging
import uuid
from datetime import timedelta
from typing import Optional, Tuple
from urllib.parse import quote

from pymongo.errors import DuplicateKeyError
from starlette.concurrency import run_in_threadpool

from app.config import settings
from app.core.exceptions import BadRequestError, ForbiddenError, UnauthorizedError
from app.core.security import (
    DUMMY_PASSWORD_HASH,
    create_access_token,
    generate_opaque_token,
    hash_password,
    hash_token,
    password_needs_rehash,
    verify_password,
)
from app.repositories.token_repository import AuthTokenRepository, RefreshTokenRepository
from app.repositories.user_repository import UserRepository
from app.services.email_service import EmailService
from app.utils.mongo import ensure_aware, utcnow

logger = logging.getLogger(__name__)

# If an already-used refresh token is presented again within this many seconds we assume a
# harmless race (for example two browser tabs refreshing at once) and just reject that request.
# After this window, reuse is treated as theft and the whole session family is revoked.
REFRESH_REUSE_GRACE_SECONDS = 10


class AuthService:
    def __init__(self, db, email_service: Optional[EmailService] = None):
        self.users = UserRepository(db)
        self.refresh_tokens = RefreshTokenRepository(db)
        self.auth_tokens = AuthTokenRepository(db)
        self.email = email_service or EmailService()

    # ---------- registration and email verification ----------

    async def register(self, full_name: str, email: str, password: str) -> None:
        """Never reveals whether the email is already registered.

        If the email exists but is unverified, a fresh verification email is sent,
        which also works as "resend verification".
        """
        password_hash = await run_in_threadpool(hash_password, password)  # always hash: equal timing
        existing = await self.users.get_by_email(email)
        if existing:
            if settings.require_email_verification and not existing.get("isEmailVerified"):
                await self._send_verification(existing)
            return

        try:
            user = await self.users.create(
                full_name=full_name,
                email=email,
                password_hash=password_hash,
                is_email_verified=not settings.require_email_verification,
            )
        except DuplicateKeyError:
            return  # lost a race with a parallel registration
        logger.info("User registered user_id=%s", user["_id"])
        if settings.require_email_verification:
            await self._send_verification(user)

    async def verify_email(self, token: str) -> None:
        record = await self.auth_tokens.consume(hash_token(token), AuthTokenRepository.EMAIL_VERIFICATION)
        if not record or ensure_aware(record["expiresAt"]) <= utcnow():
            raise BadRequestError("This verification link is invalid or has expired.", code="INVALID_TOKEN")
        await self.users.mark_email_verified(record["userId"])

    async def _send_verification(self, user: dict) -> None:
        raw = generate_opaque_token()
        await self.auth_tokens.replace(
            user_id=user["_id"],
            token_type=AuthTokenRepository.EMAIL_VERIFICATION,
            token_hash=hash_token(raw),
            expires_at=utcnow() + timedelta(hours=settings.email_verification_expire_hours),
        )
        link = f"{settings.frontend_url.rstrip('/')}/verify-email?token={quote(raw)}"
        await self.email.send_verification_email(user["email"], user["fullName"], link)

    # ---------- login, refresh, logout ----------

    async def login(self, email: str, password: str, user_agent: Optional[str] = None) -> Tuple[dict, str, str]:
        invalid = UnauthorizedError("Invalid email or password.", code="INVALID_CREDENTIALS")
        user = await self.users.get_by_email(email)
        if not user:
            await run_in_threadpool(verify_password, password, DUMMY_PASSWORD_HASH)
            raise invalid
        if not await run_in_threadpool(verify_password, password, user["passwordHash"]):
            raise invalid
        if settings.require_email_verification and not user.get("isEmailVerified"):
            raise ForbiddenError("Please verify your email before logging in.", code="EMAIL_NOT_VERIFIED")

        if password_needs_rehash(user["passwordHash"]):
            await self.users.update_password(user["_id"], await run_in_threadpool(hash_password, password))

        access_token = create_access_token(str(user["_id"]))
        refresh_token = await self._issue_refresh_token(user["_id"], family_id=None, user_agent=user_agent)
        logger.info("User logged in user_id=%s", user["_id"])
        return user, access_token, refresh_token

    async def refresh(self, raw_token: Optional[str], user_agent: Optional[str] = None) -> Tuple[str, str]:
        invalid = UnauthorizedError("Your session has expired. Please log in again.", code="INVALID_REFRESH_TOKEN")
        if not raw_token:
            raise invalid

        record = await self.refresh_tokens.get_by_hash(hash_token(raw_token))
        if not record:
            raise invalid

        now = utcnow()
        if record.get("revokedAt"):
            age = (now - ensure_aware(record["revokedAt"])).total_seconds()
            if age > REFRESH_REUSE_GRACE_SECONDS:
                logger.warning("Refresh token reuse detected; revoking session family user_id=%s", record["userId"])
                await self.refresh_tokens.revoke_family(record["familyId"])
            raise invalid
        if ensure_aware(record["expiresAt"]) <= now:
            raise invalid
        if not await self.refresh_tokens.revoke_if_active(record["_id"]):
            raise invalid  # another request rotated it first

        user = await self.users.get_by_id(record["userId"])
        if not user:
            raise invalid
        access_token = create_access_token(str(user["_id"]))
        new_refresh = await self._issue_refresh_token(user["_id"], family_id=record["familyId"], user_agent=user_agent)
        return access_token, new_refresh

    async def logout(self, raw_token: Optional[str]) -> None:
        if not raw_token:
            return
        record = await self.refresh_tokens.get_by_hash(hash_token(raw_token))
        if record:
            await self.refresh_tokens.revoke_family(record["familyId"])

    async def _issue_refresh_token(self, user_id, family_id: Optional[str], user_agent: Optional[str]) -> str:
        raw = generate_opaque_token()
        await self.refresh_tokens.create(
            user_id=user_id,
            token_hash=hash_token(raw),
            family_id=family_id or uuid.uuid4().hex,
            expires_at=utcnow() + timedelta(days=settings.refresh_token_expire_days),
            user_agent=user_agent,
        )
        return raw

    # ---------- password reset ----------

    async def forgot_password(self, email: str) -> None:
        """Always completes silently so the response never reveals whether an account exists."""
        user = await self.users.get_by_email(email)
        if not user:
            return
        raw = generate_opaque_token()
        await self.auth_tokens.replace(
            user_id=user["_id"],
            token_type=AuthTokenRepository.PASSWORD_RESET,
            token_hash=hash_token(raw),
            expires_at=utcnow() + timedelta(minutes=settings.password_reset_expire_minutes),
        )
        link = f"{settings.frontend_url.rstrip('/')}/reset-password?token={quote(raw)}"
        await self.email.send_password_reset_email(user["email"], user["fullName"], link)

    async def reset_password(self, token: str, new_password: str) -> None:
        record = await self.auth_tokens.consume(hash_token(token), AuthTokenRepository.PASSWORD_RESET)
        if not record or ensure_aware(record["expiresAt"]) <= utcnow():
            raise BadRequestError("This reset link is invalid or has expired.", code="INVALID_TOKEN")
        await self.users.update_password(record["userId"], await run_in_threadpool(hash_password, new_password))
        # A password reset signs the user out everywhere.
        await self.refresh_tokens.revoke_all_for_user(record["userId"])
        logger.info("Password reset user_id=%s", record["userId"])

    # ---------- password change (logged-in user) ----------

    async def change_password(
        self, user: dict, current_password: str, new_password: str, user_agent: Optional[str] = None
    ) -> Tuple[str, str]:
        """Changes the password, signs out every other device and keeps this session alive."""
        if not await run_in_threadpool(verify_password, current_password, user["passwordHash"]):
            raise BadRequestError("Your current password is incorrect.", code="INVALID_CURRENT_PASSWORD")
        if current_password == new_password:
            raise BadRequestError("Your new password must be different from the current one.", code="SAME_PASSWORD")
        await self.users.update_password(user["_id"], await run_in_threadpool(hash_password, new_password))
        await self.refresh_tokens.revoke_all_for_user(user["_id"])
        access_token = create_access_token(str(user["_id"]))
        refresh_token = await self._issue_refresh_token(user["_id"], family_id=None, user_agent=user_agent)
        logger.info("Password changed user_id=%s", user["_id"])
        return access_token, refresh_token
