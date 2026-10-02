"""
Career Copilot Backend - Core Configuration

All configuration is loaded from environment variables.
Never hardcode secrets or credentials.
"""

from pydantic_settings import BaseSettings
from pydantic import field_validator
from typing import List, Optional


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Environment
    ENVIRONMENT: str = "development"

    # Database
    DATABASE_URL: str = ""

    # Redis
    REDIS_URL: str = ""

    # SerpApi
    SERPAPI_API_KEY: str = ""
    SERPAPI_MAX_QUERIES_PER_ANALYSIS: int = 5
    SERPAPI_CACHE_TTL_HOURS: int = 24

    # AI Provider (grok | openai | gemini | anthropic)
    AI_PROVIDER: str = "grok"
    GROK_API_KEY: str = ""
    GROK_MODEL: str = ""
    OPENAI_API_KEY: str = ""
    GEMINI_API_KEY: str = ""
    ANTHROPIC_API_KEY: str = ""
    AI_MAX_INPUT_TOKENS: int = 4000
    AI_MAX_OUTPUT_TOKENS: int = 2000

    # JWT Authentication
    JWT_SECRET: str = ""
    JWT_REFRESH_SECRET: str = ""
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    JWT_ALGORITHM: str = "HS256"

    # Cookies — Secure must be false on http://localhost
    COOKIE_SECURE: Optional[bool] = None
    COOKIE_DOMAIN: Optional[str] = None
    COOKIE_SAMESITE: str = "lax"

    # CORS
    CORS_ORIGINS: str = "http://localhost:3000"

    # Server
    BACKEND_URL: str = "http://localhost:8000"
    FRONTEND_URL: str = "http://localhost:3000"

    # Rate Limiting
    RATE_LIMIT_LOGIN: str = "5/minute"
    RATE_LIMIT_REGISTER: str = "5/hour"
    RATE_LIMIT_ANALYSIS: str = "10/hour"
    RATE_LIMIT_MARKET_SEARCH: str = "20/hour"

    @property
    def cors_origins_list(self) -> List[str]:
        """Parse CORS_ORIGINS string into a list."""
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    @property
    def cookie_secure(self) -> bool:
        """HTTPS-only cookies in production; allow HTTP on localhost."""
        if self.COOKIE_SECURE is not None:
            return self.COOKIE_SECURE
        return self.ENVIRONMENT != "development"

    @field_validator("COOKIE_DOMAIN", mode="before")
    @classmethod
    def empty_cookie_domain(cls, v):
        if v == "":
            return None
        return v

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def validate_database_url(cls, v: str) -> str:
        if not v:
            # Allow empty for initial setup, but warn
            return "sqlite+aiosqlite:///./dev.db"
        return v

    @field_validator("JWT_SECRET", mode="before")
    @classmethod
    def validate_jwt_secret(cls, v: str) -> str:
        if not v:
            import secrets
            return secrets.token_urlsafe(32)
        return v

    @field_validator("JWT_REFRESH_SECRET", mode="before")
    @classmethod
    def validate_jwt_refresh_secret(cls, v: str) -> str:
        if not v:
            import secrets
            return secrets.token_urlsafe(32)
        return v

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "case_sensitive": True,
    }


# Singleton settings instance
settings = Settings()
