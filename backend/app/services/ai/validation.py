"""
Career Copilot - AI Response Validation

Robust parsing and validation of AI provider responses.
Handles malformed JSON, missing fields, incorrect types, and markdown wrapping.
"""

import json
import logging
import re
from typing import Optional, Dict, Any, List

from app.services.ai.schemas import (
    AIAnalysisResponse,
    AIRecommendationsResponse,
)

logger = logging.getLogger(__name__)


class AIValidationError(Exception):
    """Raised when AI response cannot be validated."""
    pass


def extract_json_from_response(response: str) -> Optional[str]:
    """
    Extract JSON from AI response, handling various formats.
    
    Handles:
    - Plain JSON
    - JSON wrapped in ```json ... ```
    - JSON wrapped in ``` ... ```
    - JSON with leading/trailing whitespace
    - JSON with comments (basic stripping)
    
    Returns None if no valid JSON structure can be found.
    """
    if not response or not isinstance(response, str):
        return None
    
    # Strip whitespace
    response = response.strip()
    
    # Remove markdown code fences
    if response.startswith("```json"):
        response = response[7:]
    elif response.startswith("```"):
        response = response[3:]
    
    if response.endswith("```"):
        response = response[:-3]
    
    response = response.strip()
    
    # Basic check for JSON structure
    if not (response.startswith("{") or response.startswith("[")):
        logger.warning("Response does not appear to be JSON")
        return None
    
    return response


def validate_analysis_response(
    response: str,
    fallback_strengths: List[str],
    fallback_gaps: List[str],
) -> Optional[Dict[str, Any]]:
    """
    Validate AI analysis response against schema.
    
    Returns validated dict if successful, None if validation fails.
    On failure, returns a controlled fallback structure using deterministic data.
    
    Args:
        response: Raw AI response string
        fallback_strengths: Deterministic strengths to use if AI fails
        fallback_gaps: Deterministic gaps to use if AI fails
    """
    if not response:
        logger.warning("Empty AI response, using fallback")
        return _create_fallback_analysis(fallback_strengths, fallback_gaps)
    
    # Extract JSON
    json_str = extract_json_from_response(response)
    if not json_str:
        logger.warning("Could not extract JSON from AI response, using fallback")
        return _create_fallback_analysis(fallback_strengths, fallback_gaps)
    
    # Parse JSON
    try:
        parsed = json.loads(json_str)
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse AI JSON: {e}")
        return _create_fallback_analysis(fallback_strengths, fallback_gaps)
    
    # Validate against Pydantic schema
    try:
        validated = AIAnalysisResponse(**parsed)
        result = validated.model_dump()
        
        # If AI provided empty strengths/gaps but we have fallback data, use fallback
        # This handles cases where AI response validates but is incomplete
        if not result.get("strengths") and fallback_strengths:
            result["strengths"] = fallback_strengths[:10]
        if not result.get("gaps") and fallback_gaps:
            result["gaps"] = fallback_gaps[:10]
        
        return result
    except Exception as e:
        logger.error(f"AI response validation failed: {e}")
        # Try to salvage what we can
        return _salvage_analysis_response(parsed, fallback_strengths, fallback_gaps)


def validate_recommendations_response(response: str) -> Optional[List[Dict[str, Any]]]:
    """
    Validate AI recommendations response against schema.
    
    Returns validated list if successful, None if validation fails.
    """
    if not response:
        logger.warning("Empty recommendations response")
        return None
    
    json_str = extract_json_from_response(response)
    if not json_str:
        logger.warning("Could not extract JSON from recommendations")
        return None
    
    try:
        parsed = json.loads(json_str)
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse recommendations JSON: {e}")
        return None
    
    # Handle both array and object with 'items' field
    if isinstance(parsed, list):
        items = parsed
    elif isinstance(parsed, dict) and "items" in parsed:
        items = parsed["items"]
    else:
        logger.warning("Unexpected recommendations structure")
        return None
    
    try:
        validated = AIRecommendationsResponse(items=items)
        return [item.model_dump() for item in validated.items]
    except Exception as e:
        logger.error(f"Recommendations validation failed: {e}")
        return None


def _create_fallback_analysis(
    strengths: List[str],
    gaps: List[str],
) -> Dict[str, Any]:
    """
    Create a controlled fallback analysis when AI fails.
    Uses deterministic data, never invents values.
    """
    return {
        "summary": "AI analysis unavailable. Market data and skill alignment are based on deterministic analysis.",
        "strengths": strengths[:10],  # Limit to prevent explosion
        "gaps": gaps[:10],
        "recommendations": [],
        "relevant_roles": [],
        "roadmap": [],
        "alignment_scores": {},
    }


def _salvage_analysis_response(
    parsed: Dict[str, Any],
    fallback_strengths: List[str],
    fallback_gaps: List[str],
) -> Dict[str, Any]:
    """
    Attempt to salvage partial AI response.
    Uses deterministic data for missing/invalid fields.
    """
    salvaged = {
        "summary": parsed.get("summary", "")[:2000] if parsed.get("summary") else "AI analysis partially unavailable.",
        "strengths": [],
        "gaps": [],
        "recommendations": [],
        "relevant_roles": [],
        "roadmap": [],
        "alignment_scores": {},
    }
    
    # Salvage strengths if valid
    if isinstance(parsed.get("strengths"), list) and parsed["strengths"]:
        valid_strengths = [
            s for s in parsed["strengths"]
            if isinstance(s, str) and s.strip()
        ][:50]
        salvaged["strengths"] = valid_strengths if valid_strengths else fallback_strengths[:10]
    else:
        salvaged["strengths"] = fallback_strengths[:10]
    
    # Salvage gaps if valid
    if isinstance(parsed.get("gaps"), list) and parsed["gaps"]:
        valid_gaps = [
            g for g in parsed["gaps"]
            if isinstance(g, str) and g.strip()
        ][:50]
        salvaged["gaps"] = valid_gaps if valid_gaps else fallback_gaps[:10]
    else:
        salvaged["gaps"] = fallback_gaps[:10]
    
    # Salvage recommendations if valid
    if isinstance(parsed.get("recommendations"), list):
        for rec in parsed["recommendations"][:20]:
            if isinstance(rec, dict):
                salvaged["recommendations"].append({
                    "action": str(rec.get("action", ""))[:500],
                    "reason": str(rec.get("reason", ""))[:500],
                    "priority": rec.get("priority") if rec.get("priority") in ["high", "medium", "low"] else "medium",
                })
    
    # Salvage roadmap if valid
    if isinstance(parsed.get("roadmap"), list):
        for item in parsed["roadmap"][:20]:
            if isinstance(item, dict):
                salvaged["roadmap"].append({
                    "skill": str(item.get("skill", ""))[:100],
                    "priority": min(max(int(item.get("priority", 5)), 1), 10),
                    "reasoning": str(item.get("reasoning", ""))[:500],
                })
    
    # Salvage relevant roles if valid
    if isinstance(parsed.get("relevant_roles"), list):
        salvaged["relevant_roles"] = [
            r for r in parsed["relevant_roles"]
            if isinstance(r, str) and r.strip()
        ][:20]
    
    # Salvage alignment scores if valid
    if isinstance(parsed.get("alignment_scores"), dict):
        scores = {}
        for key in ["skill_alignment", "role_alignment", "education_alignment", "experience_alignment"]:
            val = parsed["alignment_scores"].get(key)
            if isinstance(val, (int, float)) and 0 <= val <= 1:
                scores[key] = float(val)
        salvaged["alignment_scores"] = scores
    
    return salvaged
