import time
from collections import defaultdict, deque
from typing import Deque, Dict

from fastapi import Request

from app.config import settings
from app.core.exceptions import TooManyRequestsError


class RateLimiter:
    """In-memory sliding window limiter.

    Fine for a single backend instance. When running several instances, replace the
    storage with Redis so limits are shared.
    """

    def __init__(self) -> None:
        self._hits: Dict[str, Deque[float]] = defaultdict(deque)

    def check(self, key: str, limit: int, window_seconds: int) -> None:
        now = time.monotonic()
        hits = self._hits[key]
        while hits and now - hits[0] > window_seconds:
            hits.popleft()
        if len(hits) >= limit:
            retry_after = int(window_seconds - (now - hits[0])) + 1
            raise TooManyRequestsError(retry_after=retry_after)
        hits.append(now)
        if len(self._hits) > 10000:
            self._prune(now, window_seconds)

    def _prune(self, now: float, window_seconds: int) -> None:
        stale = [k for k, q in self._hits.items() if not q or now - q[-1] > window_seconds]
        for key in stale:
            del self._hits[key]

    def reset(self) -> None:
        self._hits.clear()


limiter = RateLimiter()


def rate_limit(name: str, limit: int, window_seconds: int):
    """FastAPI dependency factory limiting requests per client IP."""

    async def dependency(request: Request) -> None:
        if not settings.rate_limit_enabled:
            return
        ip = request.client.host if request.client else "unknown"
        limiter.check(f"{name}:{ip}", limit, window_seconds)

    return dependency
