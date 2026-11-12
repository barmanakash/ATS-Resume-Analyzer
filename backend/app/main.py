import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.core.exceptions import register_exception_handlers
from app.core.logging import setup_logging
from app.database.indexes import ensure_indexes
from app.database.mongodb import close_mongo_connection, connect_to_mongo, get_db
from app.middleware.body_limit import BodySizeLimitMiddleware
from app.middleware.security_headers import SecurityHeadersMiddleware
from app.routes.analyses import router as analyses_router
from app.routes.auth import router as auth_router
from app.routes.dashboard import router as dashboard_router
from app.routes.exports import router as exports_router
from app.routes.jobs import router as jobs_router
from app.routes.optimizer import router as optimizer_router
from app.routes.resumes import router as resumes_router
from app.routes.users import router as users_router

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_: FastAPI):
    await connect_to_mongo()
    # Indexes (unique email, TTL cleanup of expired tokens, query indexes). Failing loudly is intentional:
    # running without the unique email index would silently allow duplicate accounts.
    await ensure_indexes(get_db())
    yield
    await close_mongo_connection()


def create_app() -> FastAPI:
    setup_logging(settings.log_level)

    app = FastAPI(
        title=settings.app_name,
        version="1.0.0",
        description="AI ATS Resume Analyzer SaaS API",
        docs_url=None if settings.is_production else "/docs",
        redoc_url=None if settings.is_production else "/redoc",
        openapi_url=None if settings.is_production else "/openapi.json",
        lifespan=lifespan,
    )

    # Added innermost to outermost: CORS must wrap everything so even 413/500 responses carry CORS headers.
    app.add_middleware(BodySizeLimitMiddleware, max_bytes=settings.max_request_body_bytes)
    app.add_middleware(SecurityHeadersMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type"],
    )

    register_exception_handlers(app)

    @app.get("/health", tags=["health"])
    async def health_check():
        return {"success": True, "data": {"status": "ok", "app": settings.app_name}}

    for router in (
        auth_router,
        users_router,
        resumes_router,
        jobs_router,
        analyses_router,
        dashboard_router,
        optimizer_router,
        exports_router,
    ):
        app.include_router(router, prefix=settings.api_prefix)
    return app


app = create_app()
