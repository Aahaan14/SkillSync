"""
Career Copilot - Models Package

Import all models here so SQLAlchemy discovers them.
"""

from app.models.user import User, UserRole
from app.models.profile import Profile
from app.models.analysis import Analysis, AnalysisStatus

__all__ = [
    "User",
    "UserRole",
    "Profile",
    "Analysis",
    "AnalysisStatus",
]
