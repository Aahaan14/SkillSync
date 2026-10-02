"""SerpApi services package."""

from app.services.serpapi.client import serpapi_request
from app.services.serpapi.jobs import search_google_jobs
from app.services.serpapi.search import search_jobs, execute_market_queries
