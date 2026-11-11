import logging

from pymongo import ASCENDING, DESCENDING

from app.database import collections as c

logger = logging.getLogger(__name__)


async def ensure_indexes(db) -> None:
    """Creates indexes if missing. Safe to run on every startup."""
    await db[c.USERS].create_index("email", unique=True)
    await db[c.USERS].create_index("createdAt")

    await db[c.RESUMES].create_index([("userId", ASCENDING), ("createdAt", DESCENDING)])
    await db[c.RESUMES].create_index("processingStatus")

    await db[c.JOB_DESCRIPTIONS].create_index([("userId", ASCENDING), ("createdAt", DESCENDING)])

    await db[c.RESUME_ANALYSES].create_index([("userId", ASCENDING), ("createdAt", DESCENDING)])
    await db[c.RESUME_ANALYSES].create_index("resumeId")
    await db[c.RESUME_ANALYSES].create_index("jobDescriptionId")
    await db[c.RESUME_ANALYSES].create_index("status")

    await db[c.RESUME_VERSIONS].create_index("userId")
    await db[c.RESUME_VERSIONS].create_index("resumeId")
    await db[c.RESUME_VERSIONS].create_index([("analysisId", ASCENDING), ("versionNumber", DESCENDING)])

    await db[c.OPTIMIZATION_SUGGESTIONS].create_index("userId")
    await db[c.OPTIMIZATION_SUGGESTIONS].create_index("resumeVersionId")
    await db[c.OPTIMIZATION_SUGGESTIONS].create_index("status")

    # Session and email tokens. expiresAt TTL indexes let MongoDB delete expired rows automatically.
    await db[c.REFRESH_TOKENS].create_index("tokenHash", unique=True)
    await db[c.REFRESH_TOKENS].create_index("userId")
    await db[c.REFRESH_TOKENS].create_index("familyId")
    await db[c.REFRESH_TOKENS].create_index("expiresAt", expireAfterSeconds=0)

    await db[c.AUTH_TOKENS].create_index("tokenHash", unique=True)
    await db[c.AUTH_TOKENS].create_index([("userId", ASCENDING), ("type", ASCENDING)])
    await db[c.AUTH_TOKENS].create_index("expiresAt", expireAfterSeconds=0)

    logger.info("MongoDB indexes ensured")
