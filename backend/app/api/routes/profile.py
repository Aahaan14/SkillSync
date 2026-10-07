"""
Career Copilot - Profile Routes

CRUD operations for user profiles. All endpoints enforce ownership:
the user_id comes from the authenticated token, never from user input.
"""

import logging
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.dependencies import get_current_user
from app.database.connection import get_db
from app.models.user import User
from app.models.profile import Profile
from app.api.responses import UNAUTHORIZED, VALIDATION, SERVER_ERROR, not_found
from app.schemas import ProfileCreate, ProfileResponse

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/profile",
    tags=["profile"],
    responses={**UNAUTHORIZED, **SERVER_ERROR},
)


@router.get(
    "",
    response_model=ProfileResponse,
    responses={**not_found("The user has not saved a profile yet")},
)
async def get_profile(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get the authenticated user's profile."""
    result = await db.execute(
        select(Profile).where(Profile.user_id == current_user.id)
    )
    profile = result.scalar_one_or_none()

    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profile not found. Create one first.",
        )

    return profile


@router.put("", response_model=ProfileResponse, responses={**VALIDATION})
async def upsert_profile(
    data: ProfileCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Create or update the authenticated user's profile.
    
    user_id is derived from the auth token — never from request body.
    Input is validated and sanitized by the Pydantic schema.
    """
    result = await db.execute(
        select(Profile).where(Profile.user_id == current_user.id)
    )
    profile = result.scalar_one_or_none()

    profile_data = {
        "name": data.name,
        "headline": data.headline,
        "about": data.about,
        "location": data.location,
        "profile_url": data.profile_url,
        "skills": [s.model_dump() for s in data.skills],
        "experience": [e.model_dump() for e in data.experience],
        "education": [e.model_dump() for e in data.education],
        "certifications": [c.model_dump() for c in data.certifications],
        "projects": [p.model_dump() for p in data.projects],
        "source": data.source,
    }

    if profile:
        # Update existing profile
        for key, value in profile_data.items():
            setattr(profile, key, value)
        logger.info("Profile updated: user_id=%s", current_user.id)
    else:
        # Create new profile
        profile = Profile(user_id=current_user.id, **profile_data)
        db.add(profile)
        logger.info("Profile created: user_id=%s", current_user.id)

    await db.flush()
    await db.refresh(profile)
    return profile
