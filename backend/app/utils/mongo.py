from datetime import datetime, timezone
from typing import Any, Optional

from bson import ObjectId
from bson.errors import InvalidId

from app.core.exceptions import NotFoundError


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def ensure_aware(value: datetime) -> datetime:
    """Mongo can return naive datetimes depending on client settings; treat them as UTC."""
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value


def parse_object_id(value: Any) -> Optional[ObjectId]:
    if isinstance(value, ObjectId):
        return value
    try:
        return ObjectId(str(value))
    except (InvalidId, TypeError):
        return None


def to_object_id(value: Any, label: str = "Resource") -> ObjectId:
    """For ids coming from URLs. An invalid id is reported as not found."""
    oid = parse_object_id(value)
    if oid is None:
        raise NotFoundError(f"{label} not found.")
    return oid


def _convert(value: Any) -> Any:
    if isinstance(value, ObjectId):
        return str(value)
    if isinstance(value, dict):
        return {k: _convert(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_convert(v) for v in value]
    return value


def serialize(doc: Optional[dict]) -> Optional[dict]:
    """Mongo document -> JSON-friendly dict with `id` instead of `_id`."""
    if doc is None:
        return None
    out = _convert(doc)
    if "_id" in out:
        out["id"] = out.pop("_id")
    return out
