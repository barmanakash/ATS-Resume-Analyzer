import logging
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger(__name__)


class AppError(Exception):
    """Base class for errors that are safe to show to API clients."""

    status_code = 500
    code = "INTERNAL_ERROR"
    message = "An unexpected error occurred."

    def __init__(
        self,
        message: Optional[str] = None,
        *,
        code: Optional[str] = None,
        details: Optional[List[Dict[str, Any]]] = None,
        headers: Optional[Dict[str, str]] = None,
    ):
        self.message = message or self.message
        self.code = code or self.code
        self.details = details
        self.headers = headers or {}
        super().__init__(self.message)


class BadRequestError(AppError):
    status_code = 400
    code = "BAD_REQUEST"
    message = "The request could not be processed."


class UnauthorizedError(AppError):
    status_code = 401
    code = "UNAUTHORIZED"
    message = "Not authenticated."

    def __init__(self, message=None, **kwargs):
        headers = kwargs.pop("headers", None) or {}
        headers.setdefault("WWW-Authenticate", "Bearer")
        super().__init__(message, headers=headers, **kwargs)


class ForbiddenError(AppError):
    status_code = 403
    code = "FORBIDDEN"
    message = "You do not have permission to do that."


class NotFoundError(AppError):
    status_code = 404
    code = "NOT_FOUND"
    message = "Resource not found."


class ConflictError(AppError):
    status_code = 409
    code = "CONFLICT"
    message = "The request conflicts with existing data."


class TooManyRequestsError(AppError):
    status_code = 429
    code = "RATE_LIMITED"
    message = "Too many requests. Please try again later."

    def __init__(self, message=None, retry_after: int = 60, **kwargs):
        super().__init__(message, headers={"Retry-After": str(retry_after)}, **kwargs)


def error_body(code: str, message: str, details: Optional[list] = None) -> Dict[str, Any]:
    body: Dict[str, Any] = {"success": False, "error": {"code": code, "message": message}}
    if details:
        body["error"]["details"] = details
    return body


async def _app_error_handler(_: Request, exc: AppError):
    return JSONResponse(
        status_code=exc.status_code,
        content=error_body(exc.code, exc.message, exc.details),
        headers=exc.headers or None,
    )


async def _validation_error_handler(_: Request, exc: RequestValidationError):
    # Deliberately NOT echoing the submitted input: it may contain passwords.
    details = []
    for err in exc.errors():
        loc = [str(p) for p in err.get("loc", ()) if p not in ("body", "query", "path")]
        message = str(err.get("msg", "Invalid value")).removeprefix("Value error, ")
        details.append({"field": ".".join(loc), "message": message})
    summary = details[0]["message"] if details else "Invalid request."
    return JSONResponse(status_code=422, content=error_body("VALIDATION_ERROR", summary, details))


async def _http_exception_handler(_: Request, exc: StarletteHTTPException):
    message = exc.detail if isinstance(exc.detail, str) else "Request failed."
    return JSONResponse(
        status_code=exc.status_code,
        content=error_body(f"HTTP_{exc.status_code}", message),
        headers=getattr(exc, "headers", None),
    )


async def _unhandled_error_handler(request: Request, exc: Exception):
    logger.error("Unhandled error on %s %s", request.method, request.url.path, exc_info=exc)
    return JSONResponse(
        status_code=500,
        content=error_body("INTERNAL_ERROR", "Something went wrong on our side. Please try again later."),
    )


def register_exception_handlers(app: FastAPI) -> None:
    app.add_exception_handler(AppError, _app_error_handler)
    app.add_exception_handler(RequestValidationError, _validation_error_handler)
    app.add_exception_handler(StarletteHTTPException, _http_exception_handler)
    app.add_exception_handler(Exception, _unhandled_error_handler)
