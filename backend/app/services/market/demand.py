"""
Career Copilot - Demand Analysis

Compares user skills against market demand to identify
strengths and skill gaps.
"""

import logging
from typing import List, Dict, Any, Tuple

from app.services.serpapi.jobs import canonicalize_skill, skill_display_name

logger = logging.getLogger(__name__)


def compare_user_vs_market(
    user_skills: List[str],
    market_skills: Dict[str, Dict[str, Any]],
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """
    Compare user's skills against market demand.
    
    Returns:
        (strengths, gaps)
        
    Strengths: skills the user has that are in demand
    Gaps: skills in demand that the user lacks
    """
    # The comparison always uses Phase 3 canonical names, not presentation text.
    user_skills_normalized = {
        canonicalize_skill(skill)
        for skill in user_skills
        if isinstance(skill, str) and canonicalize_skill(skill)
    }

    strengths = []
    gaps = []

    for skill_name, data in market_skills.items():
        canonical_skill = data.get("canonical_skill") or canonicalize_skill(skill_name)
        if not canonical_skill:
            continue
        percentage = data.get("percentage", 0)
        count = data.get("count", 0)
        display_name = data.get("display_name") or skill_display_name(canonical_skill)

        entry = {
            # Existing field names are retained for API compatibility.
            "skill": canonical_skill,
            "canonical_skill": canonical_skill,
            "display_name": display_name,
            "market_percentage": percentage,
            "demand_percentage": percentage,
            "market_count": count,
            "jobs_requiring": data.get("jobs_requiring", count),
        }
        if canonical_skill in user_skills_normalized:
            entry["status"] = "strong"
            strengths.append(entry)
        else:
            entry["status"] = "missing"
            gaps.append(entry)

    # Sort strengths by market demand (highest first)
    strengths.sort(key=lambda x: (-x["market_percentage"], x["skill"]))
    # Sort gaps by market demand (highest demand gaps first — most critical)
    gaps.sort(key=lambda x: (-x["market_percentage"], x["skill"]))
    for rank, gap in enumerate(gaps, start=1):
        gap["priority_rank"] = rank

    return strengths, gaps


def calculate_alignment_score(
    strengths: List[Dict[str, Any]],
    gaps: List[Dict[str, Any]],
    total_market_skills: int,
) -> float:
    """
    Calculate weighted skill alignment for the sampled job listings.
    
    Formula: sum(demand percentage for matched skills) / sum(demand
    percentage for all recognized market skills) * 100. It measures sampled
    skill coverage only; it is not a hiring, interview, salary, or employment
    prediction.
    """
    if total_market_skills == 0:
        return 0.0

    # Weight by market percentage — matching high-demand skills matters more
    total_weight = sum(s["market_percentage"] for s in strengths) + sum(
        g["market_percentage"] for g in gaps
    )

    if total_weight == 0:
        return 0.0

    matched_weight = sum(s["market_percentage"] for s in strengths)
    score = (matched_weight / total_weight) * 100

    return round(score, 1)
