import logging
from typing import Optional

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from app.config import settings

logger = logging.getLogger(__name__)

_client: Optional[AsyncIOMotorClient] = None
_db: Optional[AsyncIOMotorDatabase] = None


async def connect_to_mongo() -> None:
    global _client, _db
    _client = AsyncIOMotorClient(
        settings.mongodb_uri,
        serverSelectionTimeoutMS=8000,
        tz_aware=True,  # datetimes come back timezone-aware (UTC)
        uuidRepresentation="standard",
    )
    _db = _client[settings.mongodb_db_name]
    await _client.admin.command("ping")  # fail fast if the database is unreachable
    logger.info("Connected to MongoDB database '%s'", settings.mongodb_db_name)


async def close_mongo_connection() -> None:
    global _client, _db
    if _client is not None:
        _client.close()
    _client = None
    _db = None


def get_db() -> AsyncIOMotorDatabase:
    if _db is None:
        raise RuntimeError("Database is not connected")
    return _db


def set_database(database) -> None:
    """Used by tests to inject an in-memory database."""
    global _db
    _db = database
