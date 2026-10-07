"""
Career Copilot - Pydantic Schemas

Input validation and response serialization.
All user input is validated here before reaching business logic.
password_hash is NEVER included in response schemas.
"""

from datetime import datetime
from typing import Dict, List, Literal, Optional
from pydantic import BaseModel, EmailStr, Field, field_validator
import re

from app.models.analysis import AnalysisStatus
from app.models.user import UserRole


def strip_html(value: str) -> str:
    """Remove HTML markup, including executable tag contents, from text input."""
    value = re.sub(r"<(script|style)\b[^>]*>.*?</\1\s*>", "", value, flags=re.IGNORECASE | re.DOTALL)
    return re.sub(r"<[^>]+>", "", value).strip()


# ─── Error Contract ───

class ErrorResponse(BaseModel):
    """
    Body of every non-validation error (400, 401, 403, 404, 409, 429, 500, 503).

    Validation failures (422) use the standard FastAPI list form instead:
    ``{"detail": [{"loc": [...], "msg": "...", "type": "..."}]}``.
    Clients must treat ``detail`` as ``string | ValidationIssue[]``.
    """
    detail: str


class ValidationIssue(BaseModel):
    """One entry of a 422 response. Submitted values are intentionally NOT echoed."""
    loc: List[str | int]
    msg: str
    type: str


class ValidationErrorResponse(BaseModel):
    detail: List[ValidationIssue]


# ─── Auth Schemas ───

class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    full_name: Optional[str] = Field(None, min_length=1, max_length=100)

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not re.search(r"[a-z]", v):
            raise ValueError("Password must contain at least one lowercase letter")
        if not re.search(r"\d", v):
            raise ValueError("Password must contain at least one digit")
        return v

    @field_validator("full_name")
    @classmethod
    def sanitize_name(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        v = strip_html(v)
        if not v:
            return None
        return v


class UserLogin(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1, max_length=128)


class UserResponse(BaseModel):
    """The authenticated user. Never includes any credential material."""
    id: int
    email: str
    full_name: Optional[str]
    role: UserRole
    created_at: datetime
    updated_at: datetime
    # Only populated by POST /auth/register and POST /auth/login (null from
    # GET /auth/me). Returned so Chrome extension clients can send
    # Authorization: Bearer, because HTTP-only cookies are not sent from
    # chrome-extension:// to localhost. The web dashboard ignores it.
    access_token: Optional[str] = None

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class MessageResponse(BaseModel):
    message: str


# ─── Profile Schemas ───

class SkillItem(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    endorsements: Optional[int] = Field(None, ge=0)


class ExperienceItem(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    company: Optional[str] = Field(None, max_length=200)
    location: Optional[str] = Field(None, max_length=200)
    start_date: Optional[str] = Field(None, max_length=50)
    end_date: Optional[str] = Field(None, max_length=50)
    description: Optional[str] = Field(None, max_length=5000)


class EducationItem(BaseModel):
    institution: str = Field(..., min_length=1, max_length=200)
    degree: Optional[str] = Field(None, max_length=200)
    field_of_study: Optional[str] = Field(None, max_length=200)
    start_date: Optional[str] = Field(None, max_length=50)
    end_date: Optional[str] = Field(None, max_length=50)


class CertificationItem(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    issuer: Optional[str] = Field(None, max_length=200)
    date: Optional[str] = Field(None, max_length=50)


class ProjectItem(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=5000)
    url: Optional[str] = Field(None, max_length=2048)

    @field_validator("url")
    @classmethod
    def validate_url(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        v = v.strip()
        if not v:
            return None
        # Only allow http/https URLs
        if not re.match(r"^https?://", v, re.IGNORECASE):
            raise ValueError("URL must start with http:// or https://")
        # Block dangerous schemes
        dangerous = ["javascript:", "data:", "file:", "vbscript:"]
        lower_v = v.lower()
        for scheme in dangerous:
            if lower_v.startswith(scheme):
                raise ValueError(f"URL scheme '{scheme}' is not allowed")
        return v


class ProfileCreate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    headline: Optional[str] = Field(None, max_length=500)
    about: Optional[str] = Field(None, max_length=10000)
    location: Optional[str] = Field(None, max_length=200)
    profile_url: Optional[str] = Field(None, max_length=2048)
    skills: List[SkillItem] = Field(default_factory=list, max_length=200)
    experience: List[ExperienceItem] = Field(default_factory=list, max_length=50)
    education: List[EducationItem] = Field(default_factory=list, max_length=20)
    certifications: List[CertificationItem] = Field(default_factory=list, max_length=50)
    projects: List[ProjectItem] = Field(default_factory=list, max_length=50)
    source: Optional[str] = Field(None, max_length=50)

    @field_validator("name", "headline", "about", "location")
    @classmethod
    def sanitize_text(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        v = strip_html(v)
        return v if v else None

    @field_validator("profile_url")
    @classmethod
    def validate_profile_url(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        v = v.strip()
        if not v:
            return None
        if not re.match(r"^https?://", v, re.IGNORECASE):
            raise ValueError("Profile URL must start with http:// or https://")
        return v


class ProfileResponse(BaseModel):
    id: int
    user_id: int
    name: Optional[str]
    headline: Optional[str]
    about: Optional[str]
    location: Optional[str]
    profile_url: Optional[str]
    skills: List[SkillItem]
    experience: List[ExperienceItem]
    education: List[EducationItem]
    certifications: List[CertificationItem]
    projects: List[ProjectItem]
    source: Optional[str]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ─── Analysis Schemas ───

class AnalysisRequest(BaseModel):
    """Request to trigger a new profile analysis."""
    target_roles: List[str] = Field(default_factory=list, max_length=10)
    target_locations: List[str] = Field(default_factory=list, max_length=5)

    @field_validator("target_roles")
    @classmethod
    def sanitize_roles(cls, v: List[str]) -> List[str]:
        sanitized = []
        for role in v:
            role = re.sub(r"<[^>]+>", "", role).strip()
            if role and len(role) <= 200:
                sanitized.append(role)
        return sanitized

    @field_validator("target_locations")
    @classmethod
    def sanitize_locations(cls, v: List[str]) -> List[str]:
        sanitized = []
        for loc in v:
            loc = re.sub(r"<[^>]+>", "", loc).strip()
            if loc and len(loc) <= 200:
                sanitized.append(loc)
        return sanitized


class MarketSkillEntry(BaseModel):
    """
    One value of ``Analysis.market_skills`` (the dict is keyed by canonical skill).
    Deterministic: computed from the analysed job sample, never by the AI.
    """
    canonical_skill: Optional[str] = None
    display_name: Optional[str] = None
    # Jobs in the sample mentioning the skill; 0 <= count <= jobs_analyzed_count.
    count: int
    jobs_requiring: Optional[int] = None
    # Share of the sampled jobs mentioning the skill, 0-100 inclusive.
    percentage: float = Field(
        ..., json_schema_extra={"minimum": 0, "maximum": 100}
    )


class SkillComparison(BaseModel):
    """
    One entry of ``Analysis.strengths`` (status "strong") or
    ``Analysis.skill_gaps`` (status "missing"). Deterministic.
    """
    skill: str
    canonical_skill: Optional[str] = None
    display_name: Optional[str] = None
    market_percentage: float = Field(
        ..., json_schema_extra={"minimum": 0, "maximum": 100}
    )
    demand_percentage: Optional[float] = None
    market_count: Optional[int] = None
    jobs_requiring: Optional[int] = None
    status: Optional[Literal["strong", "missing"]] = None
    # Gaps only: 1 = highest-demand missing skill. null on strengths.
    priority_rank: Optional[int] = None


class AIRecommendation(BaseModel):
    """AI enrichment only. ``priority`` is "high" | "medium" | "low"."""
    action: str
    reason: Optional[str] = None
    priority: Optional[str] = None


class AIRoadmapItem(BaseModel):
    """AI enrichment only. ``priority`` is 1 (most important) to 10."""
    skill: str
    priority: Optional[int] = None
    reasoning: Optional[str] = None


class AnalysisResponse(BaseModel):
    """
    One analysis run.

    DETERMINISTIC (authoritative, never written by the AI):
      jobs_analyzed_count, market_skills, strengths, skill_gaps,
      skill_alignment, overall_alignment_score (always equal to skill_alignment).

    AI-DERIVED (optional enrichment, may be null/empty when the AI is unavailable):
      ai_*, role_alignment, education_alignment, experience_alignment.

    A run that finishes with zero jobs is still ``completed``: jobs_analyzed_count
    is 0, market_skills is {}, strengths and skill_gaps are [] and the scores are 0.
    A run can also be returned with ``status = failed`` (HTTP 201 on POST) and an
    ``error_message``; clients must check ``status`` before rendering results.
    """
    id: int
    status: AnalysisStatus
    jobs_analyzed_count: int
    market_skills: Optional[Dict[str, MarketSkillEntry]]
    strengths: Optional[List[SkillComparison]]
    skill_gaps: Optional[List[SkillComparison]]
    overall_alignment_score: Optional[float]
    skill_alignment: Optional[float]
    role_alignment: Optional[float]
    education_alignment: Optional[float]
    experience_alignment: Optional[float]
    ai_summary: Optional[str]
    ai_strengths: Optional[List[str]]
    ai_gaps: Optional[List[str]]
    ai_recommendations: Optional[List[AIRecommendation]]
    ai_relevant_roles: Optional[List[str]]
    ai_roadmap: Optional[List[AIRoadmapItem]]
    search_queries: Optional[List[str]]
    error_message: Optional[str]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ─── Market Schemas ───

class MarketSearchRequest(BaseModel):
    query: str = Field(..., min_length=2, max_length=500)
    location: Optional[str] = Field(None, max_length=200)
    num_results: int = Field(default=10, ge=1, le=50)

    @field_validator("query", "location")
    @classmethod
    def sanitize_search_input(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        v = re.sub(r"<[^>]+>", "", v).strip()
        return v if v else None


class MarketJobResponse(BaseModel):
    title: str
    company: Optional[str]
    location: Optional[str]
    skills: List[str]
    experience: Optional[str]
    education: Optional[str]
    salary: Optional[str]
    employment_type: Optional[str]
    source: Optional[str]
    url: Optional[str]


class MarketSearchResponse(BaseModel):
    query: str
    jobs: List[MarketJobResponse]
    total_results: int
    cached: bool = False


class MarketSkillsResponse(BaseModel):
    """GET /api/market/skills - the latest analysis' deterministic market skills."""
    market_skills: Dict[str, MarketSkillEntry]
    jobs_analyzed_count: int
    # ISO-8601 timestamp of the analysis the skills came from.
    analysis_date: str


# ─── Admin / Health Schemas ───

class AdminStatsResponse(BaseModel):
    total_users: int
    total_profiles: int
    total_analyses: int


class AdminUserResponse(BaseModel):
    id: int
    email: str
    full_name: Optional[str]
    role: UserRole
    created_at: str


class HealthResponse(BaseModel):
    status: str
    service: str
