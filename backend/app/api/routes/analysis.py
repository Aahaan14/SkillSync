"""
Career Copilot - Analysis Routes

Triggers the full analysis pipeline:
Profile → Market Queries → SerpApi → Skill Extraction → 
Demand Calculation → Gap Analysis → AI Insights → Results

All operations are user-scoped and ownership-verified.
"""

import logging
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from app.core.dependencies import get_current_user
from app.database.connection import get_db
from app.models.user import User
from app.models.profile import Profile
from app.models.analysis import Analysis, AnalysisStatus
from app.api.responses import UNAUTHORIZED, VALIDATION, SERVER_ERROR, not_found
from app.schemas import AnalysisRequest, AnalysisResponse, ErrorResponse

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/analysis",
    tags=["analysis"],
    responses={**UNAUTHORIZED, **SERVER_ERROR},
)


@router.post(
    "",
    response_model=AnalysisResponse,
    status_code=status.HTTP_201_CREATED,
    responses={
        400: {"model": ErrorResponse, "description": "The user has no saved profile to analyse"},
        **VALIDATION,
    },
)
async def create_analysis(
    data: AnalysisRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Trigger a new profile analysis.
    
    Pipeline:
    1. Fetch user's profile
    2. Generate market queries
    3. Search via SerpApi (cached)
    4. Normalize & deduplicate results
    5. Extract market skills
    6. Calculate demand percentages
    7. Compare user vs. market
    8. Identify strengths & gaps
    9. AI analysis & recommendations
    10. Store and return results
    """
    # 1. Get user's profile
    result = await db.execute(
        select(Profile).where(Profile.user_id == current_user.id)
    )
    profile = result.scalar_one_or_none()

    if not profile:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No profile found. Please create a profile first.",
        )

    # Snapshot the profile at analysis time
    profile_snapshot = {
        "name": profile.name,
        "headline": profile.headline,
        "about": profile.about,
        "location": profile.location,
        "skills": profile.skills,
        "experience": profile.experience,
        "education": profile.education,
        "certifications": profile.certifications,
        "projects": profile.projects,
    }

    # Create analysis record
    analysis = Analysis(
        user_id=current_user.id,
        status=AnalysisStatus.PENDING,
        profile_snapshot=profile_snapshot,
    )
    db.add(analysis)
    await db.flush()
    await db.refresh(analysis)

    # Run the pipeline
    try:
        from app.services.pipeline import run_analysis_pipeline
        analysis = await run_analysis_pipeline(
            analysis=analysis,
            profile=profile,
            target_roles=data.target_roles,
            target_locations=data.target_locations,
            db=db,
        )
    except Exception as e:
        analysis.status = AnalysisStatus.FAILED
        analysis.error_message = "Analysis failed. Please try again later."
        logger.error("Analysis pipeline failed: analysis_id=%s error=%s", analysis.id, str(e))
        await db.flush()
        await db.refresh(analysis)

    return analysis


@router.get(
    "/latest",
    response_model=AnalysisResponse,
    responses={**not_found("The user has never run an analysis")},
)
async def get_latest_analysis(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get the most recent analysis for the authenticated user."""
    result = await db.execute(
        select(Analysis)
        .where(Analysis.user_id == current_user.id)
        .order_by(desc(Analysis.created_at))
        .limit(1)
    )
    analysis = result.scalar_one_or_none()

    if not analysis:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No analysis found. Run an analysis first.",
        )

    return analysis


@router.get(
    "/{analysis_id}",
    response_model=AnalysisResponse,
    responses={**not_found("No such analysis, or it belongs to another user")},
)
async def get_analysis(
    analysis_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a specific analysis. Ownership is enforced — users can only see their own."""
    result = await db.execute(
        select(Analysis).where(
            Analysis.id == analysis_id,
            Analysis.user_id == current_user.id,  # Ownership check
        )
    )
    analysis = result.scalar_one_or_none()

    if not analysis:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Analysis not found",
        )

    return analysis


@router.get("", response_model=list[AnalysisResponse])  # newest first, capped at 20, no pagination
async def list_analyses(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all analyses for the authenticated user."""
    result = await db.execute(
        select(Analysis)
        .where(Analysis.user_id == current_user.id)
        .order_by(desc(Analysis.created_at))
        .limit(20)
    )
    return result.scalars().all()
