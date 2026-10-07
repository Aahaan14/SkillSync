"""
Career Copilot - Analysis Pipeline

Orchestrates the complete analysis workflow:

USER PROFILE
     ↓
PROFILE EXTRACTION
     ↓
PROFILE NORMALIZATION
     ↓
GENERATE MARKET QUERIES
     ↓
SERPAPI LIVE MARKET SEARCH
     ↓
COLLECT JOB DATA
     ↓
NORMALIZE + DEDUPLICATE
     ↓
EXTRACT MARKET SKILLS
     ↓
CALCULATE SKILL DEMAND
     ↓
COMPARE USER VS MARKET
     ↓
IDENTIFY SKILL GAPS
     ↓
DETERMINISTIC ALIGNMENT SCORE
     ↓
AI ANALYSIS (enrichment layer, not required for core functionality)
     ↓
PERSONALIZED RECOMMENDATIONS

DETERMINISTIC VS AI SEPARATION:
- Deterministic: jobs_analyzed_count, market_skills, strengths, skill_gaps, 
  skill_alignment, overall_alignment_score
- AI: ai_summary, ai_strengths, ai_gaps, ai_recommendations, ai_relevant_roles, 
  ai_roadmap, role_alignment, education_alignment, experience_alignment
- If AI fails, deterministic analysis is still complete and returned
"""

import json
import logging
from typing import List, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.analysis import Analysis, AnalysisStatus
from app.models.profile import Profile
from app.services.market.trends import generate_market_queries
from app.services.serpapi.search import execute_market_queries
from app.services.processing.normalize import normalize_job_listing, normalize_profile_skills
from app.services.processing.deduplicate import deduplicate_jobs
from app.services.market.skills import extract_market_skills, calculate_skill_percentages
from app.services.market.demand import compare_user_vs_market, calculate_alignment_score
from app.services.ai.analyzer import analyze_profile_vs_market

logger = logging.getLogger(__name__)


async def run_analysis_pipeline(
    analysis: Analysis,
    profile: Profile,
    target_roles: List[str],
    target_locations: List[str],
    db: AsyncSession,
) -> Analysis:
    """
    Run the complete Career Copilot analysis pipeline.
    
    Each step is logged and errors are handled gracefully.
    The analysis is updated in-place and flushed to the database.
    """
    try:
        # Step 1: Normalize user profile skills
        analysis.status = AnalysisStatus.SEARCHING
        await db.flush()

        profile_data = analysis.profile_snapshot or {}
        user_skill_names = normalize_profile_skills(profile_data.get("skills", []))

        logger.info(
            "Pipeline started: analysis_id=%s user_skills=%d",
            analysis.id,
            len(user_skill_names),
        )

        # Step 2: Generate market queries
        queries = generate_market_queries(
            profile=profile_data,
            target_roles=target_roles,
            target_locations=target_locations,
        )
        analysis.search_queries = queries
        await db.flush()

        if not queries:
            analysis.status = AnalysisStatus.FAILED
            analysis.error_message = "Could not generate market queries. Please add more details to your profile."
            await db.flush()
            return analysis

        logger.info("Generated %d market queries", len(queries))

        # Step 3: Search via SerpApi
        location = target_locations[0] if target_locations else profile_data.get("location")
        raw_jobs = await execute_market_queries(
            queries=queries,
            location=location,
            num_results_per_query=10,
        )

        logger.info("Collected %d raw job listings", len(raw_jobs))

        # Step 4: Normalize job data
        normalized_jobs = [normalize_job_listing(job) for job in raw_jobs]

        # Step 5: Deduplicate
        unique_jobs = deduplicate_jobs(normalized_jobs)
        analysis.market_jobs = unique_jobs
        analysis.jobs_analyzed_count = len(unique_jobs)

        logger.info("After normalization & dedup: %d unique jobs", len(unique_jobs))

        # Step 6: Extract market skills
        analysis.status = AnalysisStatus.ANALYZING
        await db.flush()

        skill_counts = extract_market_skills(unique_jobs)
        market_skills = calculate_skill_percentages(skill_counts, len(unique_jobs))
        analysis.market_skills = market_skills

        logger.info("Extracted %d unique market skills", len(market_skills))

        # Step 7: Compare user vs. market
        strengths, gaps = compare_user_vs_market(user_skill_names, market_skills)
        analysis.strengths = strengths
        analysis.skill_gaps = gaps

        # Step 8: Calculate alignment score (DETERMINISTIC)
        total_market_skills = len(market_skills)
        alignment = calculate_alignment_score(strengths, gaps, total_market_skills)
        analysis.skill_alignment = alignment
        analysis.overall_alignment_score = alignment

        logger.info(
            "DETERMINISTIC alignment complete: strengths=%d gaps=%d alignment=%.1f%%",
            len(strengths),
            len(gaps),
            alignment,
        )

        # Step 9: AI Analysis (ENRICHMENT LAYER - not required for core functionality)
        market_summary = _generate_market_summary(unique_jobs)
        strength_names = [s["skill"] for s in strengths]
        gap_names = [g["skill"] for g in gaps]

        if not unique_jobs:
            # Nothing was analysed, so there is nothing for the AI to interpret.
            # Skipping keeps the zero-job contract intact (no invented skills,
            # roadmap or strengths) and avoids a pointless provider call.
            logger.info("No jobs analysed - skipping AI enrichment")
            ai_result = None
        else:
            ai_result = await analyze_profile_vs_market(
                profile=profile_data,
                market_skills=market_skills,
                market_jobs_summary=market_summary,
                jobs_analyzed_count=len(unique_jobs),
                strengths=strength_names,
                gaps=gap_names,
            )

        if ai_result:
            # AI enrichment - these fields are optional
            analysis.ai_summary = ai_result.get("summary")
            analysis.ai_strengths = ai_result.get("strengths", [])
            analysis.ai_gaps = ai_result.get("gaps", [])
            analysis.ai_recommendations = ai_result.get("recommendations", [])
            analysis.ai_relevant_roles = ai_result.get("relevant_roles", [])
            analysis.ai_roadmap = ai_result.get("roadmap", [])

            # AI-provided contextual alignment scores (not authoritative)
            ai_scores = ai_result.get("alignment_scores", {})
            if ai_scores:
                analysis.role_alignment = _to_percentage(ai_scores.get("role_alignment"))
                analysis.education_alignment = _to_percentage(ai_scores.get("education_alignment"))
                analysis.experience_alignment = _to_percentage(ai_scores.get("experience_alignment"))
                # CRITICAL: overall_alignment_score remains the deterministic skill alignment
                # AI dimensions are for context only, never override the deterministic score

            logger.info("AI enrichment complete")
        else:
            logger.info("AI enrichment not applied — returning deterministic-only results")
            # Deterministic analysis is complete; AI failure does not break the pipeline

        # Step 10: Mark as completed
        analysis.status = AnalysisStatus.COMPLETED
        await db.flush()
        await db.refresh(analysis)

        logger.info("Pipeline completed: analysis_id=%s", analysis.id)
        return analysis

    except Exception as e:
        logger.error("Pipeline error: analysis_id=%s error=%s", analysis.id, str(e))
        analysis.status = AnalysisStatus.FAILED
        analysis.error_message = "Analysis encountered an error. Please try again."
        await db.flush()
        await db.refresh(analysis)
        return analysis


def _generate_market_summary(jobs: list) -> str:
    """Generate a brief textual summary of market data for AI context."""
    if not jobs:
        return "No job listings found."

    companies = set()
    locations = set()
    titles = set()

    for job in jobs[:50]:  # Limit to prevent token explosion
        if job.get("company"):
            companies.add(job["company"])
        if job.get("location"):
            locations.add(job["location"])
        if job.get("title"):
            titles.add(job["title"])

    summary_parts = [
        f"Analyzed {len(jobs)} job listings.",
    ]
    if titles:
        summary_parts.append(f"Common titles: {', '.join(list(titles)[:10])}")
    if companies:
        summary_parts.append(f"Companies hiring: {', '.join(list(companies)[:10])}")
    if locations:
        summary_parts.append(f"Locations: {', '.join(list(locations)[:5])}")

    return " ".join(summary_parts)


def _to_percentage(value) -> Optional[float]:
    """Convert a 0-1 float to a 0-100 percentage."""
    if value is None:
        return None
    try:
        v = float(value)
        if 0 <= v <= 1:
            return round(v * 100, 1)
        elif 0 <= v <= 100:
            return round(v, 1)
        return None
    except (ValueError, TypeError):
        return None
