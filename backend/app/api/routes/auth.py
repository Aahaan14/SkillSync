"""
Career Copilot - Auth Routes

Registration, login, logout, token refresh, and current-user endpoint.
Passwords are hashed with Argon2id. Tokens are set in HTTP-only cookies.
"""

import logging
from fastapi import APIRouter, Depends, HTTPException, status, Response, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.security import (
    hash_password, verify_password, needs_rehash,
    create_access_token, create_refresh_token,
    decode_refresh_token,
)
from app.core.config import settings
from app.core.dependencies import get_current_user
from app.database.connection import get_db
from app.models.user import User, UserRole
from app.api.responses import UNAUTHORIZED, VALIDATION, SERVER_ERROR, Responses
from app.schemas import (
    ErrorResponse, UserRegister, UserLogin, UserResponse, TokenResponse, MessageResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth", tags=["auth"], responses={**SERVER_ERROR})


def _set_auth_cookies(response: Response, access_token: str, refresh_token: str) -> None:
    """Set HTTP-only secure cookies for auth tokens."""
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=settings.cookie_secure,
        samesite=settings.COOKIE_SAMESITE,
        domain=settings.COOKIE_DOMAIN,
        max_age=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path="/",
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=settings.cookie_secure,
        samesite=settings.COOKIE_SAMESITE,
        domain=settings.COOKIE_DOMAIN,
        max_age=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS * 86400,
        path="/api/auth/refresh",
    )


def _clear_auth_cookies(response: Response) -> None:
    """
    Expire both auth cookies. Browsers only remove a cookie when Path, Domain,
    Secure, HttpOnly and SameSite match the one that was set, so mirror
    _set_auth_cookies exactly (otherwise a configured COOKIE_DOMAIN would leave
    the session cookie in place after "logout").
    """
    for key, path in (("access_token", "/"), ("refresh_token", "/api/auth/refresh")):
        response.delete_cookie(
            key=key,
            path=path,
            domain=settings.COOKIE_DOMAIN,
            secure=settings.cookie_secure,
            httponly=True,
            samesite=settings.COOKIE_SAMESITE,
        )


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    responses={
        409: {"model": ErrorResponse, "description": "An account with this email already exists"},
        **VALIDATION,
    },
)
async def register(
    data: UserRegister,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    """Register a new user. Password is hashed with Argon2id before storage."""
    # Check for existing user
    result = await db.execute(select(User).where(User.email == data.email))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists",
        )

    # Hash password — NEVER store plaintext
    hashed = hash_password(data.password)

    user = User(
        email=data.email,
        password_hash=hashed,
        full_name=data.full_name,
        role=UserRole.USER,
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)

    # Create tokens
    token_data = {"sub": str(user.id)}
    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token(token_data)

    _set_auth_cookies(response, access_token, refresh_token)

    logger.info("User registered: user_id=%s", user.id)
    return UserResponse.model_validate(user).model_copy(update={"access_token": access_token})


@router.post(
    "/login",
    response_model=UserResponse,
    responses={
        401: {"model": ErrorResponse, "description": "Invalid email or password"},
        **VALIDATION,
    },
)
async def login(
    data: UserLogin,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    """Authenticate user. Verify password against Argon2id hash."""
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(data.password, user.password_hash):
        # Same error for both cases to prevent email enumeration
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    # Rehash if needed (e.g., upgraded Argon2 params)
    if needs_rehash(user.password_hash):
        user.password_hash = hash_password(data.password)

    # Create tokens
    token_data = {"sub": str(user.id)}
    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token(token_data)

    _set_auth_cookies(response, access_token, refresh_token)

    logger.info("User logged in: user_id=%s", user.id)
    return UserResponse.model_validate(user).model_copy(update={"access_token": access_token})


@router.post("/logout", response_model=MessageResponse)  # idempotent; always 200
async def logout(response: Response):
    """Clear auth cookies."""
    _clear_auth_cookies(response)
    return {"message": "Logged out successfully"}


@router.post(
    "/refresh",
    response_model=TokenResponse,
    responses={
        401: {"model": ErrorResponse, "description": "Missing, invalid or expired refresh token"},
    },
)
async def refresh_token(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    """Rotate access token using refresh token. Implements refresh token rotation."""
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No refresh token",
        )

    payload = decode_refresh_token(token)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )

    try:
        user_id = int(payload.get("sub"))
    except (TypeError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    # Rotate tokens
    token_data = {"sub": str(user.id)}
    new_access = create_access_token(token_data)
    new_refresh = create_refresh_token(token_data)

    _set_auth_cookies(response, new_access, new_refresh)

    return {"access_token": new_access, "token_type": "bearer"}


@router.get("/me", response_model=UserResponse, responses={**UNAUTHORIZED})
async def get_current_user_info(
    current_user: User = Depends(get_current_user),
):
    """Return the currently authenticated user (the authoritative current-user endpoint)."""
    return current_user
