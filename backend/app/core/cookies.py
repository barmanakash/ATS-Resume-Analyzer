from fastapi import Request, Response

from app.config import settings
from app.core.exceptions import ForbiddenError

REFRESH_COOKIE_NAME = "refresh_token"


def set_refresh_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        REFRESH_COOKIE_NAME,
        token,
        httponly=True,  # not readable by JavaScript, so XSS cannot steal it
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
        path="/",
        max_age=settings.refresh_token_expire_days * 86400,
        domain=settings.cookie_domain or None,
    )


def clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(REFRESH_COOKIE_NAME, path="/", domain=settings.cookie_domain or None)


async def require_trusted_origin(request: Request) -> None:
    """CSRF defence for endpoints that rely on the refresh cookie.

    Browsers always send an Origin header on cross-site POSTs; if it is present it must be one of ours.
    Requests without an Origin header (curl, server-to-server, same-origin) are allowed.
    """
    origin = request.headers.get("origin")
    if origin and origin.rstrip("/") not in settings.cors_origin_list:
        raise ForbiddenError("This request origin is not allowed.", code="UNTRUSTED_ORIGIN")
