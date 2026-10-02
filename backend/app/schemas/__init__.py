"""
Career Copilot - Pydantic Schemas

Input validation and response serialization.
All user input is validated here before reaching business logic.
password_hash is NEVER included in response schemas.
"""

from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, EmailStr, Field, field_validator
import re


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
        # Strip HTML tags
        v = re.sub(r"<[^>]+>", "", v).strip()
        if not v:
            return None
        return v


class UserLogin(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1, max_length=128)


class UserResponse(BaseModel):
    """User response — NEVER includes password_hash."""
    id: int
    email: str
    full_name: Optional[str]
    role: str
    created_at: datetime
    updated_at: datetime
    # Returned so Chrome extension clients can send Authorization: Bearer
    # (HTTP-only cookies are not sent from chrome-extension:// to localhost).
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
        # Strip HTML tags from text fields
        v = re.sub(r"<[^>]+>", "", v).strip()
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
    skills: list
    experience: list
    education: list
    certifications: list
    projects: list
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


class MarketSkillDemand(BaseModel):
    skill: str
    count: int
    percentage: float
    user_has: bool


class AlignmentScores(BaseModel):
    overall: Optional[float] = None
    skill_alignment: Optional[float] = None
    role_alignment: Optional[float] = None
    education_alignment: Optional[float] = None
    experience_alignment: Optional[float] = None


class AnalysisResponse(BaseModel):
    id: int
    status: str
    jobs_analyzed_count: int
    market_skills: Optional[dict]
    strengths: Optional[list]
    skill_gaps: Optional[list]
    overall_alignment_score: Optional[float]
    skill_alignment: Optional[float]
    role_alignment: Optional[float]
    education_alignment: Optional[float]
    experience_alignment: Optional[float]
    ai_summary: Optional[str]
    ai_strengths: Optional[list]
    ai_gaps: Optional[list]
    ai_recommendations: Optional[list]
    ai_relevant_roles: Optional[list]
    ai_roadmap: Optional[list]
    search_queries: Optional[list]
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
    skills: list
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
