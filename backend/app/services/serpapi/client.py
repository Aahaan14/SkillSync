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

# In-memory cache as fallback for development
_cache: Dict[str, Any] = {}
_CACHE_MAX_SIZE = 1000

# Global redis client
_redis_client = None

def get_redis():
    global _redis_client
    if _redis_client is None and settings.REDIS_URL:
        try:
            import redis.asyncio as aioredis
            _redis_client = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
        except ImportError:
            logger.warning("redis not installed, cannot use Redis cache")
    return _redis_client

def _cache_key(params: dict) -> str:
    """Generate a deterministic cache key from query params."""
    serialized = json.dumps(params, sort_keys=True)
    return "serpapi:" + hashlib.sha256(serialized.encode()).hexdigest()


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

    key = _cache_key(params)
    redis = get_redis()
    
    # Check Redis cache first
    if redis:
        try:
            cached = await redis.get(key)
            if cached:
                logger.info("SerpApi Redis cache hit: key=%s", key)
                return json.loads(cached)
        except Exception as e:
            logger.error("Redis cache error: %s", str(e))
    
    # Fallback to in-memory cache
    if key in _cache:
        logger.info("SerpApi in-memory cache hit: key=%s", key)
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
                
                # Cache the result in Redis
                if redis:
                    try:
                        ttl_seconds = settings.SERPAPI_CACHE_TTL_HOURS * 3600
                        await redis.setex(key, ttl_seconds, json.dumps(data))
                    except Exception as e:
                        logger.error("Redis cache set error: %s", str(e))
                        
                # Fallback in-memory cache
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
