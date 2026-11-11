from datetime import datetime
from typing import Any, Optional

from app.database.collections import AUTH_TOKENS, REFRESH_TOKENS
from app.utils.mongo import parse_object_id, utcnow


class RefreshTokenRepository:
    """Refresh tokens are stored hashed and rotated on every use.

    All tokens issued from one login share a `familyId`, so reuse of an old token
    can revoke the whole session.
    """

    def __init__(self, db):
        self.col = db[REFRESH_TOKENS]

    async def create(self, *, user_id: Any, token_hash: str, family_id: str, expires_at: datetime,
                     user_agent: Optional[str] = None) -> dict:
        doc = {
            "userId": parse_object_id(user_id),
            "tokenHash": token_hash,
            "familyId": family_id,
            "expiresAt": expires_at,
            "createdAt": utcnow(),
            "revokedAt": None,
            "userAgent": (user_agent or "")[:200] or None,
        }
        await self.col.insert_one(doc)
        return doc

    async def get_by_hash(self, token_hash: str) -> Optional[dict]:
        return await self.col.find_one({"tokenHash": token_hash})

    async def revoke_if_active(self, token_id: Any) -> bool:
        """Atomically revokes the token. Returns False if someone else already did."""
        result = await self.col.update_one(
            {"_id": token_id, "revokedAt": None},
            {"$set": {"revokedAt": utcnow()}},
        )
        return result.modified_count == 1

    async def revoke_family(self, family_id: str) -> None:
        await self.col.update_many(
            {"familyId": family_id, "revokedAt": None},
            {"$set": {"revokedAt": utcnow()}},
        )

    async def revoke_all_for_user(self, user_id: Any) -> None:
        await self.col.update_many(
            {"userId": parse_object_id(user_id), "revokedAt": None},
            {"$set": {"revokedAt": utcnow()}},
        )


class AuthTokenRepository:
    """Single-use tokens for email verification and password reset (stored hashed)."""

    EMAIL_VERIFICATION = "email_verification"
    PASSWORD_RESET = "password_reset"

    def __init__(self, db):
        self.col = db[AUTH_TOKENS]

    async def replace(self, *, user_id: Any, token_type: str, token_hash: str, expires_at: datetime) -> None:
        uid = parse_object_id(user_id)
        # Only the newest link works.
        await self.col.delete_many({"userId": uid, "type": token_type})
        await self.col.insert_one(
            {
                "userId": uid,
                "type": token_type,
                "tokenHash": token_hash,
                "expiresAt": expires_at,
                "createdAt": utcnow(),
            }
        )

    async def consume(self, token_hash: str, token_type: str) -> Optional[dict]:
        """Atomically fetches and deletes the token so it can only be used once."""
        return await self.col.find_one_and_delete({"tokenHash": token_hash, "type": token_type})
