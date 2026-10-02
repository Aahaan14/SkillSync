"""
Career Copilot - Analysis Model

Stores analysis results: market data, skill gaps, AI insights,
and recommendations. Each analysis is owned by a user.
"""

import enum
from datetime import datetime, timezone
from sqlalchemy import (
    String, Text, DateTime, Integer, ForeignKey, JSON, Enum as SAEnum, Float
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.connection import Base


class AnalysisStatus(str, enum.Enum):
    PENDING = "pending"
    SEARCHING = "searching"
    ANALYZING = "analyzing"
    COMPLETED = "completed"
    FAILED = "failed"


class Analysis(Base):
    __tablename__ = "analyses"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )

    status: Mapped[AnalysisStatus] = mapped_column(
        SAEnum(AnalysisStatus), default=AnalysisStatus.PENDING, nullable=False
    )

    # Input snapshot — the profile state at analysis time
    profile_snapshot: Mapped[dict] = mapped_column(JSON, nullable=True)

    # Market search queries used
    search_queries: Mapped[dict] = mapped_column(JSON, default=list, nullable=True)

    # Raw market data collected
    market_jobs: Mapped[dict] = mapped_column(JSON, default=list, nullable=True)
    jobs_analyzed_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Skill demand analysis
    market_skills: Mapped[dict] = mapped_column(JSON, default=dict, nullable=True)

    # User vs. market comparison
    strengths: Mapped[dict] = mapped_column(JSON, default=list, nullable=True)
    skill_gaps: Mapped[dict] = mapped_column(JSON, default=list, nullable=True)

    # Alignment scores
    overall_alignment_score: Mapped[float] = mapped_column(Float, nullable=True)
    skill_alignment: Mapped[float] = mapped_column(Float, nullable=True)
    role_alignment: Mapped[float] = mapped_column(Float, nullable=True)
    education_alignment: Mapped[float] = mapped_column(Float, nullable=True)
    experience_alignment: Mapped[float] = mapped_column(Float, nullable=True)

    # AI-generated insights
    ai_summary: Mapped[str] = mapped_column(Text, nullable=True)
    ai_strengths: Mapped[dict] = mapped_column(JSON, default=list, nullable=True)
    ai_gaps: Mapped[dict] = mapped_column(JSON, default=list, nullable=True)
    ai_recommendations: Mapped[dict] = mapped_column(JSON, default=list, nullable=True)
    ai_relevant_roles: Mapped[dict] = mapped_column(JSON, default=list, nullable=True)
    ai_roadmap: Mapped[dict] = mapped_column(JSON, default=list, nullable=True)

    # Error tracking
    error_message: Mapped[str] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="analyses")

    def __repr__(self) -> str:
        return f"<Analysis id={self.id} user_id={self.user_id} status={self.status}>"
