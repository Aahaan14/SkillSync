"""
Career Copilot - AI Response Schemas

Structured validation for AI provider responses.
Ensures AI output matches expected structure and types.
"""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, field_validator


class RecommendationItem(BaseModel):
    """Individual recommendation from AI."""
    action: str = Field(..., min_length=1, max_length=500)
    reason: str = Field(..., min_length=1, max_length=500)
    priority: str = Field(..., pattern="^(high|medium|low)$")


class RoadmapItem(BaseModel):
    """Individual roadmap item from AI."""
    skill: str = Field(..., min_length=1, max_length=100)
    priority: int = Field(..., ge=1, le=10)
    reasoning: str = Field(..., min_length=1, max_length=500)


class AlignmentScores(BaseModel):
    """AI-provided alignment scores (contextual, not authoritative)."""
    skill_alignment: Optional[float] = Field(None, ge=0.0, le=1.0)
    role_alignment: Optional[float] = Field(None, ge=0.0, le=1.0)
    education_alignment: Optional[float] = Field(None, ge=0.0, le=1.0)
    experience_alignment: Optional[float] = Field(None, ge=0.0, le=1.0)


class AIAnalysisResponse(BaseModel):
    """Structured AI analysis response."""
    summary: str = Field(..., min_length=1, max_length=2000)
    strengths: List[str] = Field(default_factory=list, max_length=50)
    gaps: List[str] = Field(default_factory=list, max_length=50)
    recommendations: List[RecommendationItem] = Field(default_factory=list, max_length=20)
    relevant_roles: List[str] = Field(default_factory=list, max_length=20)
    roadmap: List[RoadmapItem] = Field(default_factory=list, max_length=20)
    alignment_scores: Optional[AlignmentScores] = None

    @field_validator("strengths", "gaps", "relevant_roles")
    @classmethod
    def validate_string_lists(cls, v: List[str]) -> List[str]:
        """Ensure list items are non-empty strings."""
        return [s for s in v if s and isinstance(s, str) and s.strip()]

    @field_validator("summary")
    @classmethod
    def sanitize_summary(cls, v: str) -> str:
        """Strip and validate summary."""
        return v.strip()


class AIRecommendationItem(BaseModel):
    """Individual recommendation from recommendations endpoint."""
    category: str = Field(..., pattern="^(skills|experience|education|projects|profile)$")
    action: str = Field(..., min_length=1, max_length=500)
    reason: str = Field(..., min_length=1, max_length=500)
    priority: str = Field(..., pattern="^(high|medium|low)$")
    estimated_impact: Optional[str] = Field(None, max_length=500)


class AIRecommendationsResponse(BaseModel):
    """Structured AI recommendations response."""
    items: List[AIRecommendationItem] = Field(default_factory=list, max_length=20)
