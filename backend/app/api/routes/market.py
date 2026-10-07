"""
Career Copilot - Market Routes

Endpoints for searching market data via SerpApi and retrieving
market skill insights. Upstream SerpApi responses are cached server-side;
per-user rate limiting is not enforced yet (planned for Phase 11).
"""

import logging
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.database.connection import get_db
from app.models.user import User
from app.api.responses import UNAUTHORIZED, VALIDATION, SERVER_ERROR, not_found
from app.schemas import ErrorResponse, MarketSearchRequest, MarketSearchResponse, MarketSkillsResponse

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/market",
    tags=["market"],
    responses={**UNAUTHORIZED, **SERVER_ERROR},
)


@router.post(
    "/search",
    response_model=MarketSearchResponse,
    responses={
        503: {"model": ErrorResponse, "description": "Market search is temporarily unavailable"},
        **VALIDATION,
    },
)
async def search_market(
    data: MarketSearchRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Search the job market using SerpApi.
    Upstream SerpApi responses are cached server-side to reduce API costs
    (the response's `cached` flag is currently always false).
    Per-user rate limiting is not enforced yet.
    """
    try:
        from app.services.serpapi.search import search_jobs
        result = await search_jobs(
            query=data.query,
            location=data.location,
            num_results=data.num_results,
        )
        return result
    except Exception as e:
        logger.error("Market search failed: user_id=%s error=%s", current_user.id, str(e))
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Market search is temporarily unavailable. Please try again later.",
        )


@router.get(
    "/skills",
    response_model=MarketSkillsResponse,
    responses={**not_found("No analysis with market skills exists yet")},
)
async def get_market_skills(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get aggregated market skill demand from the user's latest analysis."""
    from sqlalchemy import select, desc
    from app.models.analysis import Analysis

    result = await db.execute(
        select(Analysis)
        .where(Analysis.user_id == current_user.id)
        .order_by(desc(Analysis.created_at))
        .limit(1)
    )
    analysis = result.scalar_one_or_none()

    if not analysis or not analysis.market_skills:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No market analysis data found. Run an analysis first.",
        )

    return {
        "market_skills": analysis.market_skills,
        "jobs_analyzed_count": analysis.jobs_analyzed_count,
        "analysis_date": analysis.created_at.isoformat(),
    }
