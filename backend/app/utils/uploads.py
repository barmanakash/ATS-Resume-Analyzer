from fastapi import UploadFile

from app.config import settings
from app.core.exceptions import BadRequestError

_CHUNK = 64 * 1024


async def read_upload_limited(file: UploadFile, max_bytes: int | None = None) -> bytes:
    """Reads an upload in chunks and stops as soon as the size limit is exceeded."""
    limit = max_bytes or settings.max_upload_bytes
    chunks = []
    total = 0
    while True:
        chunk = await file.read(_CHUNK)
        if not chunk:
            break
        total += len(chunk)
        if total > limit:
            raise BadRequestError(
                f"The file is too large. The limit is {settings.max_upload_mb} MB.", code="FILE_TOO_LARGE"
            )
        chunks.append(chunk)
    return b"".join(chunks)
