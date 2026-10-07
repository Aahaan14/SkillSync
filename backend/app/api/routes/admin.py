"""
Career Copilot - Admin Routes

Admin-only endpoints. Every route requires:
1. Valid authentication
2. User role == ADMIN

Normal users receive 403 Forbidden. This is enforced server-side
by the get_current_admin_user dependency, NOT by frontend hiding.
"""

import logging
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.core.dependencies import get_current_admin_user
from app.database.connection import get_db
from app.models.user import User
from app.models.analysis import Analysis
from app.models.profile import Profile
from app.api.responses import UNAUTHORIZED, FORBIDDEN, SERVER_ERROR
from app.schemas import AdminStatsResponse, AdminUserResponse

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/admin",
    tags=["admin"],
    responses={**UNAUTHORIZED, **FORBIDDEN, **SERVER_ERROR},
)


@router.get("/stats", response_model=AdminStatsResponse)
async def get_system_stats(
    admin: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """System-wide statistics. Admin only."""
    user_count = await db.execute(select(func.count(User.id)))
    profile_count = await db.execute(select(func.count(Profile.id)))
    analysis_count = await db.execute(select(func.count(Analysis.id)))

    return {
        "total_users": user_count.scalar(),
        "total_profiles": profile_count.scalar(),
        "total_analyses": analysis_count.scalar(),
    }


@router.get("/users", response_model=list[AdminUserResponse])
async def list_users(
    admin: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """List all users. Admin only. NEVER returns password hashes."""
    result = await db.execute(select(User).order_by(User.created_at.desc()).limit(100))
    users = result.scalars().all()

    return [
        {
            "id": u.id,
            "email": u.email,
            "full_name": u.full_name,
            "role": u.role.value,
            "created_at": u.created_at.isoformat(),
        }
        for u in users
    ]
