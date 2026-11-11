import hashlib
import secrets
import uuid
from datetime import datetime, timedelta, timezone

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError

from app.config import settings
from app.core.exceptions import UnauthorizedError

_hasher = PasswordHasher()

# Verified against when an email is unknown, so login timing does not reveal which emails exist.
DUMMY_PASSWORD_HASH = _hasher.hash("timing-equalizer-not-a-real-password")


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return _hasher.verify(password_hash, password)
    except (VerificationError, InvalidHashError):
        return False


def password_needs_rehash(password_hash: str) -> bool:
    return _hasher.check_needs_rehash(password_hash)


def create_access_token(user_id: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "type": "access",
        "iat": now,
        "exp": now + timedelta(minutes=settings.access_token_expire_minutes),
        "jti": uuid.uuid4().hex,
    }
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> dict:
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm],
            options={"require": ["exp", "iat", "sub"]},
        )
    except jwt.ExpiredSignatureError:
        raise UnauthorizedError("Your session has expired.", code="TOKEN_EXPIRED")
    except jwt.InvalidTokenError:
        raise UnauthorizedError("Invalid authentication token.", code="INVALID_TOKEN")
    if payload.get("type") != "access":
        raise UnauthorizedError("Invalid authentication token.", code="INVALID_TOKEN")
    return payload


def generate_opaque_token() -> str:
    """Random URL-safe token for refresh, email verification and password reset."""
    return secrets.token_urlsafe(48)


def hash_token(token: str) -> str:
    """Only the hash is stored, so a database leak does not expose usable tokens."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()
