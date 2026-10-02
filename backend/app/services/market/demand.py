"""
Career Copilot - Demand Analysis

Compares user skills against market demand to identify
strengths and skill gaps.
"""

import logging
from typing import List, Dict, Any, Tuple

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
    # Normalize user skills for comparison
    user_skills_normalized = {s.lower().strip() for s in user_skills if isinstance(s, str)}

    strengths = []
    gaps = []

    for skill_name, data in market_skills.items():
        skill_lower = skill_name.lower().strip()
        percentage = data.get("percentage", 0)
        count = data.get("count", 0)

        if skill_lower in user_skills_normalized:
            strengths.append({
                "skill": skill_name,
                "market_percentage": percentage,
                "market_count": count,
                "status": "strong",
            })
        else:
            gaps.append({
                "skill": skill_name,
                "market_percentage": percentage,
                "market_count": count,
                "status": "missing",
            })

    # Sort strengths by market demand (highest first)
    strengths.sort(key=lambda x: x["market_percentage"], reverse=True)
    # Sort gaps by market demand (highest demand gaps first — most critical)
    gaps.sort(key=lambda x: x["market_percentage"], reverse=True)

    return strengths, gaps


def calculate_alignment_score(
    strengths: List[Dict[str, Any]],
    gaps: List[Dict[str, Any]],
    total_market_skills: int,
) -> float:
    """
    Calculate an overall skill alignment score.
    
    This is Career Copilot's analysis based on the sampled listings.
    It is NOT an objective industry-wide score.
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
