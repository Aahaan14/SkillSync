"""
Career Copilot - SerpApi Client

Secure wrapper around SerpApi. The API key is NEVER sent to the frontend.
All calls go through the backend:  Extension → FastAPI → SerpApi

Implements:
- Caching (reduce API costs)
- Rate limiting
- Timeout handling
- Retry logic
- Graceful failure
"""

import hashlib
import json
import logging
from typing import Optional, Dict, Any

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

# In-memory cache as Redis fallback for development
_cache: Dict[str, Any] = {}
_CACHE_MAX_SIZE = 1000


def _cache_key(params: dict) -> str:
    """Generate a deterministic cache key from query params."""
    serialized = json.dumps(params, sort_keys=True)
    return hashlib.sha256(serialized.encode()).hexdigest()


async def serpapi_request(
    params: dict,
    timeout: float = 30.0,
    max_retries: int = 2,
) -> Optional[dict]:
    """
    Make a request to SerpApi with caching, timeout, and retry.
    
    The SERPAPI_API_KEY is injected server-side — it NEVER leaves the backend.
    """
    if not settings.SERPAPI_API_KEY:
        logger.warning("SERPAPI_API_KEY not configured")
        return None

    # Check cache first
    key = _cache_key(params)
    if key in _cache:
        logger.info("SerpApi cache hit: key=%s", key[:12])
        return _cache[key]

    # Add API key server-side
    request_params = {**params, "api_key": settings.SERPAPI_API_KEY}

    for attempt in range(max_retries + 1):
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.get(
                    "https://serpapi.com/search",
                    params=request_params,
                )

            if response.status_code == 200:
                data = response.json()
                # Cache the result
                if len(_cache) < _CACHE_MAX_SIZE:
                    _cache[key] = data
                logger.info("SerpApi request successful: params=%s", {k: v for k, v in params.items() if k != "api_key"})
                return data
            elif response.status_code == 429:
                logger.warning("SerpApi rate limited, attempt %d/%d", attempt + 1, max_retries + 1)
                if attempt < max_retries:
                    import asyncio
                    await asyncio.sleep(2 ** attempt)
                    continue
                return None
            else:
                logger.error("SerpApi error: status=%d", response.status_code)
                return None

        except httpx.TimeoutException:
            logger.warning("SerpApi timeout, attempt %d/%d", attempt + 1, max_retries + 1)
            if attempt < max_retries:
                import asyncio
                await asyncio.sleep(1)
                continue
            return None
        except Exception as e:
            logger.error("SerpApi request failed: %s", str(e))
            return None

    return None
