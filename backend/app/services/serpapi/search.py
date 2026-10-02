"""
Career Copilot - SerpApi Search Service

High-level search orchestration. Generates queries, executes searches,
and aggregates results. Respects SERPAPI_MAX_QUERIES_PER_ANALYSIS.
"""

import logging
from typing import List, Optional, Dict, Any

from app.core.config import settings
from app.services.serpapi.jobs import search_google_jobs

logger = logging.getLogger(__name__)


async def search_jobs(
    query: str,
    location: Optional[str] = None,
    num_results: int = 10,
) -> Dict[str, Any]:
    """Execute a single market search query."""
    jobs = await search_google_jobs(
        query=query,
        location=location,
        num_results=num_results,
    )
    return {
        "query": query,
        "jobs": jobs,
        "total_results": len(jobs),
        "cached": False,
    }


async def execute_market_queries(
    queries: List[str],
    location: Optional[str] = None,
    num_results_per_query: int = 10,
) -> List[Dict[str, Any]]:
    """
    Execute multiple market search queries with cost control.
    
    Limits the number of SerpApi queries per analysis to
    SERPAPI_MAX_QUERIES_PER_ANALYSIS.
    """
    max_queries = settings.SERPAPI_MAX_QUERIES_PER_ANALYSIS
    limited_queries = queries[:max_queries]

    if len(queries) > max_queries:
        logger.info(
            "Limiting queries from %d to %d (SERPAPI_MAX_QUERIES_PER_ANALYSIS)",
            len(queries),
            max_queries,
        )

    all_jobs = []
    for query in limited_queries:
        jobs = await search_google_jobs(
            query=query,
            location=location,
            num_results=num_results_per_query,
        )
        all_jobs.extend(jobs)

    logger.info(
        "Market queries complete: queries=%d results=%d",
        len(limited_queries),
        len(all_jobs),
    )
    return all_jobs
