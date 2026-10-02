"""
Career Copilot - Data Deduplication

Removes duplicate job listings from collected market data.
"""

import logging
from typing import List, Dict, Any

logger = logging.getLogger(__name__)


def deduplicate_jobs(jobs: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Remove duplicate job listings based on title + company + location.
    Keeps the first occurrence of each unique job.
    """
    seen = set()
    unique_jobs = []

    for job in jobs:
        # Create a dedup key from title + company + location
        key = _make_dedup_key(job)
        if key not in seen:
            seen.add(key)
            unique_jobs.append(job)

    removed = len(jobs) - len(unique_jobs)
    if removed > 0:
        logger.info("Deduplicated jobs: %d -> %d (removed %d)", len(jobs), len(unique_jobs), removed)

    return unique_jobs


def _make_dedup_key(job: Dict[str, Any]) -> str:
    """Create a normalized deduplication key."""
    title = (job.get("title") or "").lower().strip()
    company = (job.get("company") or "").lower().strip()
    location = (job.get("location") or "").lower().strip()
    return f"{title}|{company}|{location}"
