"""
Career Copilot - FastAPI Application

Main application entry point with CORS, middleware, and route registration.
Structured logging is configured here. Sensitive data is NEVER logged.
"""

import logging
import sys
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.core.log_safety import install_log_redaction
from app.database.connection import init_db, close_db
from app.schemas import HealthResponse


# ─── Structured Logging ───

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
# Secrets must never reach the logs: httpx logs full request URLs at INFO and
# SerpApi's key travels in the query string. See app/core/log_safety.py.
install_log_redaction()
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


# ─── Error Handlers ───
#
# Error contract: every error body has a "detail" key.
#   - 4xx/5xx from the API:  {"detail": "<human readable message>"}
#   - 422 validation:        {"detail": [{"loc": [...], "msg": "...", "type": "..."}]}

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """
    Standard 422 shape, minus the fields FastAPI would add by default.

    FastAPI echoes the rejected value in each error's ``input`` (and parser
    internals in ``ctx``/``url``). For /auth/register that would reflect the
    submitted password back in the response body, so only the location, message
    and error type are returned.
    """
    issues = [
        {
            "loc": [part for part in err.get("loc", ())],
            "msg": str(err.get("msg", "Invalid value")),
            "type": str(err.get("type", "value_error")),
        }
        for err in exc.errors()
    ]
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": issues},
    )


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

@app.get("/api/health", response_model=HealthResponse, tags=["health"])
async def health_check():
    """Public health check endpoint."""
    return {"status": "healthy", "service": "career-copilot"}
