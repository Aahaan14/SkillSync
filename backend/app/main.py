"""
Career Copilot - FastAPI Application

Main application entry point with CORS, middleware, and route registration.
Structured logging is configured here. Sensitive data is NEVER logged.
"""

import logging
import sys
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.database.connection import init_db, close_db


# ─── Structured Logging ───

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger("career_copilot")


# ─── Lifespan ───

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown."""
    logger.info("Starting Career Copilot backend (env=%s)", settings.ENVIRONMENT)
    await init_db()
    logger.info("Database initialized")
    yield
    await close_db()
    logger.info("Career Copilot backend stopped")


# ─── App ───

app = FastAPI(
    title="Career Copilot API",
    description="Career Intelligence Copilot — Analyze your profile against live market data",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/api/docs" if settings.ENVIRONMENT == "development" else None,
    redoc_url="/api/redoc" if settings.ENVIRONMENT == "development" else None,
)


# ─── CORS ───

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_origin_regex=r"chrome-extension://[a-z]{32}",
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)


# ─── Global Error Handler ───

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """
    Catch unhandled exceptions. Return safe error to client.
    Log detailed error server-side. NEVER expose stack traces to users.
    """
    logger.error(
        "Unhandled error: path=%s method=%s error=%s",
        request.url.path,
        request.method,
        str(exc),
        exc_info=True,
    )
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "An unexpected error occurred. Please try again later."},
    )


# ─── Routes ───

from app.api.routes.auth import router as auth_router
from app.api.routes.profile import router as profile_router
from app.api.routes.analysis import router as analysis_router
from app.api.routes.market import router as market_router
from app.api.routes.admin import router as admin_router

app.include_router(auth_router)
app.include_router(profile_router)
app.include_router(analysis_router)
app.include_router(market_router)
app.include_router(admin_router)


# ─── Health Check ───

@app.get("/api/health")
async def health_check():
    """Public health check endpoint."""
    return {"status": "healthy", "service": "career-copilot"}
