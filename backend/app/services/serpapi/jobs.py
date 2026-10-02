"""
Career Copilot - SerpApi Job Search

Searches Google Jobs via SerpApi and normalizes results into
our internal schema.
"""

import logging
from typing import List, Optional, Dict, Any

from app.services.serpapi.client import serpapi_request

logger = logging.getLogger(__name__)


async def search_google_jobs(
    query: str,
    location: Optional[str] = None,
    num_results: int = 10,
) -> List[Dict[str, Any]]:
    """
    Search Google Jobs via SerpApi.
    Returns normalized job listings.
    """
    params = {
        "engine": "google_jobs",
        "q": query[:500],  # Limit query length
        "num": min(num_results, 50),
    }
    if location:
        params["location"] = location[:200]

    data = await serpapi_request(params)
    if not data:
        return []

    jobs_results = data.get("jobs_results", [])
    normalized = []

    for job in jobs_results[:num_results]:
        normalized.append(_normalize_google_job(job))

    logger.info("Google Jobs search: query='%s' results=%d", query[:100], len(normalized))
    return normalized


def _normalize_google_job(raw: dict) -> Dict[str, Any]:
    """Normalize a Google Jobs result into our internal schema."""
    # Extract skills from description
    description = raw.get("description", "")
    detected_chips = raw.get("detected_extensions", {})

    return {
        "title": raw.get("title", "Unknown"),
        "company": raw.get("company_name", None),
        "location": raw.get("location", None),
        "description": description[:5000] if description else None,
        "skills": _extract_skills_from_description(description),
        "experience": detected_chips.get("work_from_home") and "Remote" or None,
        "education": None,
        "salary": detected_chips.get("salary", raw.get("salary", None)),
        "employment_type": _get_employment_type(detected_chips),
        "source": raw.get("via", "Google Jobs"),
        "url": raw.get("share_link") or raw.get("related_links", [{}])[0].get("link") if raw.get("related_links") else None,
    }


def _extract_skills_from_description(description: str) -> List[str]:
    """Extract likely skill keywords from a job description."""
    if not description:
        return []

    # Common tech skills to match against
    COMMON_SKILLS = {
        "python", "java", "javascript", "typescript", "c++", "c#", "go", "rust",
        "ruby", "php", "swift", "kotlin", "scala", "r",
        "react", "angular", "vue", "node.js", "nodejs", "express", "django",
        "flask", "fastapi", "spring", "rails",
        "sql", "postgresql", "mysql", "mongodb", "redis", "elasticsearch",
        "aws", "azure", "gcp", "google cloud", "docker", "kubernetes", "terraform",
        "ci/cd", "jenkins", "github actions", "gitlab",
        "machine learning", "deep learning", "nlp", "computer vision",
        "pytorch", "tensorflow", "scikit-learn", "pandas", "numpy",
        "data science", "data engineering", "data analysis",
        "html", "css", "tailwind", "bootstrap",
        "git", "linux", "agile", "scrum",
        "rest", "graphql", "grpc", "microservices",
        "figma", "sketch", "adobe",
    }

    description_lower = description.lower()
    found_skills = []

    for skill in COMMON_SKILLS:
        if skill in description_lower:
            found_skills.append(skill.title() if len(skill) > 3 else skill.upper())

    return list(set(found_skills))


def _get_employment_type(detected: dict) -> Optional[str]:
    """Extract employment type from detected extensions."""
    if detected.get("full_time"):
        return "Full-time"
    if detected.get("part_time"):
        return "Part-time"
    if detected.get("contract"):
        return "Contract"
    if detected.get("internship"):
        return "Internship"
    return None
