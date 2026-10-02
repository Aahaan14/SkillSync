"""AI services package."""

from app.services.ai.client import get_ai_provider, AIProvider
from app.services.ai.analyzer import analyze_profile_vs_market
from app.services.ai.recommendations import generate_recommendations
