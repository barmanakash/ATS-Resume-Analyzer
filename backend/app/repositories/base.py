from typing import Any, List, Optional, Tuple

from app.schemas.common import Pagination
from app.utils.mongo import serialize


class UserOwnedRepository:
    """Base for collections where every document has a `userId`.

    Every query is scoped by userId, which enforces ownership at the data layer.
    """

    collection_name: str = ""
    # Fields excluded from list responses (large or internal)
    list_projection: Optional[dict] = None

    def __init__(self, db):
        self.col = db[self.collection_name]

    async def list_for_user(self, user_id: Any, pagination: Pagination) -> Tuple[List[dict], int]:
        query = {"userId": user_id}
        total = await self.col.count_documents(query)
        cursor = (
            self.col.find(query, self.list_projection)
            .sort("createdAt", -1)
            .skip(pagination.skip)
            .limit(pagination.page_size)
        )
        items = [serialize(doc) async for doc in cursor]
        return items, total
