from typing import Any, Optional

from app.database.collections import USERS
from app.utils.mongo import parse_object_id, utcnow


class UserRepository:
    def __init__(self, db):
        self.col = db[USERS]

    async def get_by_email(self, email: str) -> Optional[dict]:
        return await self.col.find_one({"email": email.strip().lower()})

    async def get_by_id(self, user_id: Any) -> Optional[dict]:
        oid = parse_object_id(user_id)
        if oid is None:
            return None
        return await self.col.find_one({"_id": oid})

    async def create(self, *, full_name: str, email: str, password_hash: str, is_email_verified: bool = False) -> dict:
        now = utcnow()
        doc = {
            "fullName": full_name,
            "email": email.strip().lower(),
            "passwordHash": password_hash,
            "profileImage": None,
            "isEmailVerified": is_email_verified,
            "createdAt": now,
            "updatedAt": now,
        }
        result = await self.col.insert_one(doc)
        doc["_id"] = result.inserted_id
        return doc

    async def mark_email_verified(self, user_id: Any) -> None:
        await self.col.update_one(
            {"_id": parse_object_id(user_id)},
            {"$set": {"isEmailVerified": True, "updatedAt": utcnow()}},
        )

    async def update_password(self, user_id: Any, password_hash: str) -> None:
        await self.col.update_one(
            {"_id": parse_object_id(user_id)},
            {"$set": {"passwordHash": password_hash, "updatedAt": utcnow()}},
        )

    async def update_profile(self, user_id: Any, fields: dict) -> Optional[dict]:
        await self.col.update_one(
            {"_id": parse_object_id(user_id)},
            {"$set": {**fields, "updatedAt": utcnow()}},
        )
        return await self.get_by_id(user_id)

    async def delete(self, user_id: Any) -> None:
        await self.col.delete_one({"_id": parse_object_id(user_id)})
