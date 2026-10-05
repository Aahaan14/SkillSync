"""
Career Copilot - SerpApi Job Search

Searches Google Jobs via SerpApi and normalizes results into
our internal schema.
"""

import logging
import re
from functools import lru_cache
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


@lru_cache(maxsize=1)
def _skill_mappings() -> Dict[str, List[str]]:
    """Return the Phase 3 skill aliases, keyed by their canonical name."""
    return {
        "python": ["python", "python3"],
        "java": ["java", "java ee", "j2ee"],
        "javascript": ["javascript", "js", "es6", "vanilla js"],
        "typescript": ["typescript", "ts"],
        "c++": ["c++", "cpp"],
        "c#": ["c#", "csharp", ".net", "dotnet"],
        "go": ["go", "golang"],
        "rust": ["rust"],
        "ruby": ["ruby", "ruby on rails", "ror"],
        "php": ["php"],
        "swift": ["swift"],
        "kotlin": ["kotlin"],
        "scala": ["scala"],
        "r": ["r"],
        "react": ["react", "reactjs", "react.js", "react js"],
        "angular": ["angular", "angularjs", "angular.js"],
        "vue": ["vue", "vuejs", "vue.js", "vue js"],
        "node.js": ["node.js", "nodejs", "node js", "node"],
        "express": ["express", "express.js"],
        "django": ["django"],
        "flask": ["flask"],
        "fastapi": ["fastapi"],
        "spring": ["spring", "spring boot"],
        "sql": ["sql"],
        "postgresql": ["postgresql", "postgres"],
        "mysql": ["mysql"],
        "mongodb": ["mongodb", "mongo"],
        "redis": ["redis"],
        "elasticsearch": ["elasticsearch"],
        "aws": ["aws", "amazon web services"],
        "azure": ["azure", "microsoft azure"],
        "gcp": ["gcp", "google cloud", "google cloud platform"],
        "docker": ["docker"],
        "kubernetes": ["kubernetes", "k8s"],
        "terraform": ["terraform"],
        "ci/cd": ["ci/cd", "ci-cd", "continuous integration", "continuous deployment"],
        "jenkins": ["jenkins"],
        "github actions": ["github actions"],
        "gitlab": ["gitlab"],
        "machine learning": ["machine learning", "ml"],
        "deep learning": ["deep learning", "dl"],
        "nlp": ["nlp", "natural language processing"],
        "computer vision": ["computer vision", "cv"],
        "pytorch": ["pytorch"],
        "tensorflow": ["tensorflow"],
        "scikit-learn": ["scikit-learn", "sklearn"],
        "pandas": ["pandas"],
        "numpy": ["numpy"],
        "data science": ["data science"],
        "data engineering": ["data engineering"],
        "data analysis": ["data analysis"],
        "html": ["html", "html5"],
        "css": ["css", "css3"],
        "tailwind": ["tailwind", "tailwindcss", "tailwind css"],
        "bootstrap": ["bootstrap"],
        "git": ["git"],
        "linux": ["linux"],
        "agile": ["agile"],
        "scrum": ["scrum"],
        "rest": ["rest", "restful", "rest api"],
        "graphql": ["graphql"],
        "grpc": ["grpc"],
        "microservices": ["microservices"],
        "figma": ["figma"],
        "sketch": ["sketch"],
        "adobe": ["adobe", "adobe creative suite"],
    }



def _alias_key(value: str) -> str:
    """Normalize case, whitespace, and separator punctuation for alias lookup."""
    return re.sub(r"[^a-z0-9+#]+", "", value.casefold())


@lru_cache(maxsize=512)
def canonicalize_skill(skill: str) -> str:
    """Return a canonical skill name using the shared Phase 3 alias map.

    Unknown values remain usable as stable, lower-case names rather than being
    discarded. This lets profile and market data follow the same comparison
    rules without inventing a second normalizer.
    """
    if not isinstance(skill, str):
        return ""
    cleaned = re.sub(r"\s+", " ", skill).strip()
    if not cleaned:
        return ""

    key = _alias_key(cleaned)
    for canonical, aliases in _skill_mappings().items():
        if key == _alias_key(canonical) or any(key == _alias_key(alias) for alias in aliases):
            return canonical
    return cleaned.casefold()


def skill_display_name(canonical_skill: str) -> str:
    """Provide a readable display name while retaining canonical storage keys."""
    special_names = {
        "aws": "AWS", "gcp": "GCP", "ci/cd": "CI/CD", "c++": "C++",
        "c#": "C#", "node.js": "Node.js", "nlp": "NLP", "grpc": "gRPC",
        "postgresql": "PostgreSQL",
    }
    return special_names.get(canonical_skill, canonical_skill.title())


def _extract_skills_from_description(description: str) -> List[str]:
    """Extract canonical skills from a job description using the shared aliases."""
    if not description:
        return []

    description_lower = description.lower()
    found_skills = []

    for canonical, aliases in _skill_mappings().items():
        for alias in aliases:
            # Escape regex specials like + or .
            escaped_alias = re.escape(alias)
            # Use word boundaries, except when dealing with specific non-word chars
            # For C++, c# -> boundaries might not match if it's followed by punctuation
            pattern = r'(?<!\w)' + escaped_alias + r'(?!\w)'
            if re.search(pattern, description_lower):
                found_skills.append(canonical)
                break # Move to next canonical skill once found

    return sorted(set(found_skills))


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
