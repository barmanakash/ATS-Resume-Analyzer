from dataclasses import dataclass
from math import ceil
from typing import Any, Dict, Optional

from fastapi import Query


def ok(data: Any = None, meta: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Standard success envelope: { success, data, meta? }"""
    body: Dict[str, Any] = {"success": True, "data": data}
    if meta is not None:
        body["meta"] = meta
    return body


@dataclass
class Pagination:
    page: int
    page_size: int

    @property
    def skip(self) -> int:
        return (self.page - 1) * self.page_size


def get_pagination(
    page: int = Query(1, ge=1, le=100000),
    pageSize: int = Query(10, ge=1, le=100),
) -> Pagination:
    return Pagination(page=page, page_size=pageSize)


def page_meta(total: int, pagination: Pagination) -> Dict[str, int]:
    return {
        "total": total,
        "page": pagination.page,
        "pageSize": pagination.page_size,
        "totalPages": max(1, ceil(total / pagination.page_size)),
    }
