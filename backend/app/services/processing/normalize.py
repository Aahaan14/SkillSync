"""
Career Copilot - Data Normalization

Normalizes extracted profile and market data into consistent formats.
"""

import re
import logging
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)


def normalize_skill_name(skill: str) -> str:
    """Normalize a skill name for consistent comparison."""
    if not skill or not isinstance(skill, str):
        return ""
    
    # Strip HTML tags
    skill = re.sub(r"<[^>]+>", "", skill)
    # Trim whitespace
    skill = skill.strip()
    # Title case for display (but lowercase for matching)
    return skill


def normalize_job_listing(raw: Dict[str, Any]) -> Dict[str, Any]:
    """Normalize a raw job listing into our internal schema."""
    return {
        "title": _clean_text(raw.get("title", ""), max_length=200),
        "company": _clean_text(raw.get("company", ""), max_length=200),
        "location": _clean_text(raw.get("location", ""), max_length=200),
        "skills": _normalize_skills_list(raw.get("skills", [])),
        "experience": _clean_text(raw.get("experience", ""), max_length=500),
        "education": _clean_text(raw.get("education", ""), max_length=500),
        "salary": _clean_text(raw.get("salary", ""), max_length=200),
        "employment_type": _clean_text(raw.get("employment_type", ""), max_length=50),
        "source": _clean_text(raw.get("source", ""), max_length=200),
        "url": _validate_url(raw.get("url", "")),
    }


def normalize_profile_skills(skills: list) -> List[str]:
    """Extract and normalize skill names from various skill formats."""
    normalized = []
    for skill in skills:
        if isinstance(skill, dict):
            name = skill.get("name", "")
        elif isinstance(skill, str):
            name = skill
        else:
            continue
        
        name = normalize_skill_name(name)
        if name and len(name) <= 100:
            normalized.append(name)
    
    return normalized


def _clean_text(text: Any, max_length: int = 500) -> Optional[str]:
    """Clean and truncate text input."""
    if not text or not isinstance(text, str):
        return None
    # Strip HTML tags
    text = re.sub(r"<[^>]+>", "", text)
    text = text.strip()
    if not text:
        return None
    return text[:max_length]


def _normalize_skills_list(skills: list) -> List[str]:
    """Normalize a list of skills."""
    normalized = []
    for skill in skills:
        if isinstance(skill, str):
            cleaned = normalize_skill_name(skill)
            if cleaned and len(cleaned) <= 100:
                normalized.append(cleaned)
    return list(set(normalized))  # Deduplicate


def _validate_url(url: Any) -> Optional[str]:
    """Validate and clean a URL. Only allow http/https."""
    if not url or not isinstance(url, str):
        return None
    url = url.strip()
    if not re.match(r"^https?://", url, re.IGNORECASE):
        return None
    # Block dangerous schemes
    lower_url = url.lower()
    for blocked in ["javascript:", "data:", "file:", "vbscript:"]:
        if lower_url.startswith(blocked):
            return None
    return url[:2048]
