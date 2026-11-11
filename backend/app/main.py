from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.core.exceptions import register_exception_handlers
from app.core.logging import setup_logging
from app.database.mongodb import _db, close_mongo_connection, connect_to_mongo, get_db
from app.database.indexes import ensure_indexes
from app.routes.analyses import router as analyses_router
from app.routes.auth import router as auth_router
from app.routes.dashboard import router as dashboard_router
from app.routes.exports import router as exports_router
from app.routes.jobs import router as jobs_router
from app.routes.optimizer import router as optimizer_router
from app.routes.resumes import router as resumes_router


def create_app() -> FastAPI:
    setup_logging(settings.log_level)

    app = FastAPI(
        title=settings.app_name,
        version="1.0.0",
        description="AI ATS Resume Analyzer SaaS API",
        docs_url="/docs",
        redoc_url="/redoc",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    register_exception_handlers(app)

    @app.on_event("startup")
    async def _startup() -> None:
        await connect_to_mongo()
        if _db is not None:
            await ensure_indexes(_db)

    @app.on_event("shutdown")
    async def _shutdown() -> None:
        await close_mongo_connection()

    @app.get("/health")
    async def health_check():
        return {"success": True, "data": {"status": "ok", "app": settings.app_name}}

    app.include_router(auth_router, prefix=settings.api_prefix)
    app.include_router(resumes_router, prefix=settings.api_prefix)
    app.include_router(jobs_router, prefix=settings.api_prefix)
    app.include_router(analyses_router, prefix=settings.api_prefix)
    app.include_router(dashboard_router, prefix=settings.api_prefix)
    app.include_router(optimizer_router, prefix=settings.api_prefix)
    app.include_router(exports_router, prefix=settings.api_prefix)
    return app


app = create_app()
