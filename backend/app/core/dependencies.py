"""
Career Copilot Backend - Dependencies

FastAPI dependency injection for authentication, authorization,
database sessions, and rate limiting.
"""

from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import APIKeyCookie, HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decode_access_token
from app.database.connection import get_db
from app.models.user import User, UserRole


# Both schemes are declared so /openapi.json documents how authentication works.
# auto_error=False: the 401 responses below stay the single source of truth for
# error wording, and either credential alone is enough.
cookie_scheme = APIKeyCookie(name="access_token", auto_error=False, scheme_name="cookieAuth")
bearer_scheme = HTTPBearer(auto_error=False, scheme_name="bearerAuth")


async def get_current_user(
    cookie_token: Optional[str] = Depends(cookie_scheme),
    bearer: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    Extract and validate the current user from the access token.

    The authenticated identity comes from the token, NOT from any
    user-supplied ID in the request body or URL.

    Accepted credentials, in order: ``Authorization: Bearer`` (Chrome extension)
    then the HTTP-only ``access_token`` cookie (web dashboard). The first one that
    validates wins, so a stale cookie cannot lock out a client that also holds a
    valid bearer token (the extension shares the browser's cookie jar for
    localhost). Both are verified identically.
    """
    candidates = [t for t in (bearer.credentials if bearer else None, cookie_token) if t]

    if not candidates:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )

    payload = None
    for token in candidates:
        payload = decode_access_token(token)
        if payload is not None:
            break

    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )

    try:
        user_id = int(payload.get("sub"))
    except (TypeError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )

    from sqlalchemy import select
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    return user


async def get_current_admin_user(
    current_user: User = Depends(get_current_user),
) -> User:
    """
    Require the current user to have ADMIN role.
    Normal users receive 403 Forbidden.
    """
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return current_user


def require_ownership(resource_user_id: int, current_user_id: int) -> None:
    """
    Verify that a resource belongs to the current user.
    Prevents horizontal privilege escalation (e.g., /user/123 -> /user/124).
    """
    if resource_user_id != current_user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied",
        )
