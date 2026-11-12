import logging
from typing import Optional

from starlette.concurrency import run_in_threadpool

from app.core.exceptions import BadRequestError
from app.core.security import verify_password
from app.database.collections import AUTH_TOKENS, REFRESH_TOKENS, USER_OWNED_COLLECTIONS
from app.repositories.user_repository import UserRepository
from app.storage.local_storage import LocalStorageService
from app.utils.mongo import parse_object_id

logger = logging.getLogger(__name__)


class UserService:
    def __init__(self, db, storage: Optional[LocalStorageService] = None):
        self.db = db
        self.users = UserRepository(db)
        self.storage = storage or LocalStorageService()

    async def update_profile(self, user_id, full_name: str) -> dict:
        return await self.users.update_profile(user_id, {"fullName": full_name})

    async def _confirm_password(self, user: dict, password: str) -> None:
        if not await run_in_threadpool(verify_password, password, user["passwordHash"]):
            raise BadRequestError("The password you entered is incorrect.", code="INVALID_PASSWORD")

    async def _purge_user_data(self, user_id) -> None:
        """Removes every uploaded file and every record derived from the user's documents."""
        uid = parse_object_id(user_id)
        await run_in_threadpool(self.storage.delete_user_files, str(uid))
        for collection in USER_OWNED_COLLECTIONS:
            await self.db[collection].delete_many({"userId": uid})

    async def delete_data(self, user: dict, password: str) -> None:
        """Deletes all resumes, job descriptions, analyses and versions but keeps the account."""
        await self._confirm_password(user, password)
        await self._purge_user_data(user["_id"])
        logger.info("User data deleted user_id=%s", user["_id"])

    async def delete_account(self, user: dict, password: str) -> None:
        await self._confirm_password(user, password)
        await self._purge_user_data(user["_id"])
        uid = parse_object_id(user["_id"])
        await self.db[REFRESH_TOKENS].delete_many({"userId": uid})
        await self.db[AUTH_TOKENS].delete_many({"userId": uid})
        await self.users.delete(uid)
        logger.info("Account deleted user_id=%s", uid)
