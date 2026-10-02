"""
Career Copilot - Profile Model

Stores structured professional profile data owned by a user.
All queries must enforce user_id ownership.
"""

from datetime import datetime, timezone
from sqlalchemy import (
    String, Text, DateTime, Integer, ForeignKey, JSON
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.connection import Base


class Profile(Base):
    __tablename__ = "profiles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False, index=True
    )

    # Core profile fields
    name: Mapped[str] = mapped_column(String(100), nullable=True)
    headline: Mapped[str] = mapped_column(String(500), nullable=True)
    about: Mapped[str] = mapped_column(Text, nullable=True)
    location: Mapped[str] = mapped_column(String(200), nullable=True)
    profile_url: Mapped[str] = mapped_column(String(2048), nullable=True)

    # Structured data stored as JSON arrays
    skills: Mapped[dict] = mapped_column(JSON, default=list, nullable=False)
    experience: Mapped[dict] = mapped_column(JSON, default=list, nullable=False)
    education: Mapped[dict] = mapped_column(JSON, default=list, nullable=False)
    certifications: Mapped[dict] = mapped_column(JSON, default=list, nullable=False)
    projects: Mapped[dict] = mapped_column(JSON, default=list, nullable=False)

    # Extraction metadata
    source: Mapped[str] = mapped_column(String(50), nullable=True)  # linkedin, generic, manual

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
    user: Mapped["User"] = relationship("User", back_populates="profile")

    def __repr__(self) -> str:
        return f"<Profile id={self.id} user_id={self.user_id} name={self.name}>"
