from typing import Any, Dict, List, Optional, Tuple

from pymongo import ReturnDocument

from app.schemas.common import Pagination
from app.utils.mongo import parse_object_id, serialize, utcnow


class UserOwnedRepository:
    """Base for collections where every document has a `userId`.

    Every query is scoped by userId, which enforces ownership at the data layer:
    a user can never read, change or delete another user's document, even with a valid id.
    """

    collection_name: str = ""
    # Fields excluded from list responses (large or internal)
    list_projection: Optional[dict] = None

    def __init__(self, db):
        self.col = db[self.collection_name]

    async def list_for_user(
        self, user_id: Any, pagination: Pagination, extra_filter: Optional[Dict[str, Any]] = None
    ) -> Tuple[List[dict], int]:
        query: Dict[str, Any] = {"userId": parse_object_id(user_id)}
        if extra_filter:
            query.update(extra_filter)
        total = await self.col.count_documents(query)
        cursor = (
            self.col.find(query, self.list_projection)
            .sort("createdAt", -1)
            .skip(pagination.skip)
            .limit(pagination.page_size)
        )
        items = [serialize(doc) async for doc in cursor]
        return items, total

    async def count_for_user(self, user_id: Any) -> int:
        return await self.col.count_documents({"userId": parse_object_id(user_id)})

    async def get_for_user(self, user_id: Any, doc_id: Any, projection: Optional[dict] = None) -> Optional[dict]:
        oid = parse_object_id(doc_id)
        if oid is None:
            return None
        return await self.col.find_one({"_id": oid, "userId": parse_object_id(user_id)}, projection)

    async def insert(self, doc: dict) -> dict:
        now = utcnow()
        doc.setdefault("createdAt", now)
        doc.setdefault("updatedAt", now)
        result = await self.col.insert_one(doc)
        doc["_id"] = result.inserted_id
        return doc

    async def update_for_user(self, user_id: Any, doc_id: Any, fields: Dict[str, Any]) -> Optional[dict]:
        oid = parse_object_id(doc_id)
        if oid is None:
            return None
        return await self.col.find_one_and_update(
            {"_id": oid, "userId": parse_object_id(user_id)},
            {"$set": {**fields, "updatedAt": utcnow()}},
            return_document=ReturnDocument.AFTER,
        )

    async def delete_for_user(self, user_id: Any, doc_id: Any) -> bool:
        oid = parse_object_id(doc_id)
        if oid is None:
            return False
        result = await self.col.delete_one({"_id": oid, "userId": parse_object_id(user_id)})
        return result.deleted_count == 1

    async def delete_all_for_user(self, user_id: Any) -> int:
        result = await self.col.delete_many({"userId": parse_object_id(user_id)})
        return result.deleted_count
