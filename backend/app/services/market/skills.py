"""
Career Copilot - Market Skills Extraction

Extracts and normalizes skills from collected job listings.
"""

import logging
from typing import List, Dict, Any
from collections import Counter

from app.services.serpapi.jobs import canonicalize_skill, skill_display_name

logger = logging.getLogger(__name__)


def extract_market_skills(jobs: List[Dict[str, Any]]) -> Dict[str, int]:
    """
    Count the number of distinct jobs containing each canonical skill.

    A skill is counted once per job, so the count is always bounded by the
    number of analyzed jobs and can safely be used as a demand percentage.
    """
    skill_counter: Counter = Counter()

    for job in jobs:
        skills = job.get("skills", [])
        if not isinstance(skills, list):
            continue
        canonical_skills = {
            canonicalize_skill(skill)
            for skill in skills
            if isinstance(skill, str) and skill.strip()
        }
        skill_counter.update(skill for skill in canonical_skills if len(skill) <= 100)

    return dict(skill_counter)


def calculate_skill_percentages(
    skill_counts: Dict[str, int],
    total_jobs: int,
) -> Dict[str, Dict[str, Any]]:
    """
    Calculate the percentage of jobs that mention each skill.
    
    IMPORTANT: These percentages represent the ANALYZED SAMPLE,
    not the entire global job market. This must be communicated to users.
    """
    if total_jobs == 0:
        return {}

    result = {}
    for skill, count in sorted(skill_counts.items(), key=lambda x: (-x[1], x[0])):
        jobs_with_skill = min(max(int(count), 0), total_jobs)
        result[skill] = {
            "canonical_skill": skill,
            "display_name": skill_display_name(skill),
            "count": jobs_with_skill,
            "jobs_requiring": jobs_with_skill,
            "percentage": round((jobs_with_skill / total_jobs) * 100, 1),
        }

    return result
