"""
Career Copilot - Market Skills Extraction

Extracts and normalizes skills from collected job listings.
"""

import logging
from typing import List, Dict, Any
from collections import Counter

logger = logging.getLogger(__name__)


def extract_market_skills(jobs: List[Dict[str, Any]]) -> Dict[str, int]:
    """
    Extract all skills from collected jobs and count occurrences.
    Returns a dict of {skill_name: count}.
    """
    skill_counter: Counter = Counter()

    for job in jobs:
        skills = job.get("skills", [])
        for skill in skills:
            if isinstance(skill, str) and skill.strip():
                # Normalize skill name
                normalized = skill.strip().title()
                if len(normalized) <= 100:
                    skill_counter[normalized] += 1

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
    for skill, count in sorted(skill_counts.items(), key=lambda x: x[1], reverse=True):
        result[skill] = {
            "count": count,
            "percentage": round((count / total_jobs) * 100, 1),
        }

    return result
