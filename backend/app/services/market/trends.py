"""
Career Copilot - Market Trends

Generates market search queries based on user profiles.
Queries are dynamically generated — not hard-coded for every user.
"""

import logging
from typing import List, Dict, Any

from app.core.config import settings

logger = logging.getLogger(__name__)


def generate_market_queries(
    profile: Dict[str, Any],
    target_roles: List[str] = None,
    target_locations: List[str] = None,
) -> List[str]:
    """
    Generate market search queries based on the user's profile.
    
    Dynamically builds queries from the user's headline, skills, and location.
    Limits total queries to SERPAPI_MAX_QUERIES_PER_ANALYSIS.
    """
    queries = []
    max_queries = settings.SERPAPI_MAX_QUERIES_PER_ANALYSIS

    # Extract profile data
    headline = profile.get("headline", "")
    skills = profile.get("skills", [])
    location = profile.get("location", "")
    experience = profile.get("experience", [])

    # Normalize skills to string list
    skill_names = []
    for s in skills:
        if isinstance(s, dict):
            name = s.get("name", "")
        elif isinstance(s, str):
            name = s
        else:
            continue
        if name and len(name) <= 100:
            skill_names.append(name)

    # Use target roles or derive from headline
    roles = target_roles or []
    if not roles and headline:
        # Use headline as the primary role
        roles = [headline]

    # Use target locations or derive from profile
    locations = target_locations or []
    if not locations and location:
        locations = [location]

    # Generate queries
    # 1. Role-based queries
    for role in roles[:2]:
        base_query = f"{role} jobs"
        queries.append(base_query)

        if locations:
            queries.append(f"{role} jobs {locations[0]}")

    # 2. Skill-based queries
    if skill_names and roles:
        top_skills = skill_names[:3]
        skills_str = " ".join(top_skills)
        queries.append(f"{roles[0]} {skills_str}")

    # 3. Role + specific high-value skills
    if roles and skill_names:
        for skill in skill_names[:2]:
            queries.append(f"{roles[0]} {skill} jobs")

    # 4. Experience-derived queries
    if experience:
        latest = experience[0] if experience else {}
        if isinstance(latest, dict):
            title = latest.get("title", "")
            if title and title not in roles:
                queries.append(f"{title} jobs")

    # Deduplicate and limit
    seen = set()
    unique_queries = []
    for q in queries:
        q_normalized = q.lower().strip()
        if q_normalized not in seen and q_normalized:
            seen.add(q_normalized)
            unique_queries.append(q)

    limited = unique_queries[:max_queries]

    logger.info(
        "Generated %d market queries (from %d candidates, max=%d)",
        len(limited),
        len(unique_queries),
        max_queries,
    )

    return limited
