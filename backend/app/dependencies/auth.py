from fastapi import Header

from app.core.exceptions import UnauthorizedError
from app.core.security import decode_access_token
from app.database.mongodb import get_db
from app.repositories.user_repository import UserRepository


async def get_current_user(authorization: str = Header(default=None, alias="Authorization")) -> dict:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise UnauthorizedError("Authentication required.", code="MISSING_TOKEN")

    token = authorization.split(" ", 1)[1].strip()
    payload = decode_access_token(token)
    user = await UserRepository(get_db()).get_by_id(payload["sub"])
    if not user:
        raise UnauthorizedError("Your session is no longer valid.", code="INVALID_TOKEN")
    return user
