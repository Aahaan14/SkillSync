"""
Career Copilot - AI Client Abstraction

Provider-agnostic AI service.

Architecture:
    AIService
    ├── OpenAI provider
    ├── Gemini provider
    └── Anthropic provider

External webpage content is treated as UNTRUSTED DATA.
System instructions are separated from user/external content
to prevent prompt injection.
"""

import asyncio
import logging
from abc import ABC, abstractmethod
from typing import Optional, Dict, Any

from app.core.config import settings

logger = logging.getLogger(__name__)

# Retry configuration
MAX_RETRIES = 2
RETRY_DELAY_SECONDS = 1.0


class AIProvider(ABC):
    """Base class for AI providers."""

    @abstractmethod
    async def generate(
        self,
        system_prompt: str,
        user_prompt: str,
        max_tokens: int = 2000,
    ) -> Optional[str]:
        """Generate a response. System and user prompts are kept separate."""
        pass


class GrokProvider(AIProvider):
    """xAI Grok provider. API key never leaves the backend."""

    async def generate(
        self,
        system_prompt: str,
        user_prompt: str,
        max_tokens: int = 2000,
    ) -> Optional[str]:
        if not settings.GROK_API_KEY:
            logger.warning("GROK_API_KEY not configured")
            return None
        if not settings.GROK_MODEL:
            logger.warning("GROK_MODEL not configured")
            return None

        for attempt in range(MAX_RETRIES + 1):
            try:
                import httpx
                async with httpx.AsyncClient(timeout=60.0) as client:
                    response = await client.post(
                        "https://api.x.ai/v1/chat/completions",
                        headers={
                            "Authorization": f"Bearer {settings.GROK_API_KEY}",
                            "Content-Type": "application/json",
                        },
                        json={
                            "model": settings.GROK_MODEL,
                            "messages": [
                                {"role": "system", "content": system_prompt},
                                {"role": "user", "content": user_prompt[:settings.AI_MAX_INPUT_TOKENS * 4]},
                            ],
                            "max_tokens": min(max_tokens, settings.AI_MAX_OUTPUT_TOKENS),
                            "temperature": 0.7,
                        },
                    )

                if response.status_code == 200:
                    data = response.json()
                    return data["choices"][0]["message"]["content"]
                elif response.status_code == 429:
                    # Rate limit - retry with backoff
                    if attempt < MAX_RETRIES:
                        logger.warning("Grok rate limited, retrying (attempt %d/%d)", attempt + 1, MAX_RETRIES)
                        await asyncio.sleep(RETRY_DELAY_SECONDS * (attempt + 1))
                        continue
                    else:
                        logger.error("Grok rate limit exceeded after retries")
                        return None
                elif response.status_code >= 500:
                    # Server error - retry
                    if attempt < MAX_RETRIES:
                        logger.warning("Grok server error %d, retrying (attempt %d/%d)", response.status_code, attempt + 1, MAX_RETRIES)
                        await asyncio.sleep(RETRY_DELAY_SECONDS)
                        continue
                    else:
                        logger.error("Grok server error %d after retries", response.status_code)
                        return None
                elif response.status_code == 401:
                    logger.error("Grok authentication failed - invalid API key")
                    return None
                else:
                    logger.error("Grok API error: status=%d", response.status_code)
                    return None

            except asyncio.TimeoutError:
                if attempt < MAX_RETRIES:
                    logger.warning("Grok timeout, retrying (attempt %d/%d)", attempt + 1, MAX_RETRIES)
                    await asyncio.sleep(RETRY_DELAY_SECONDS)
                    continue
                else:
                    logger.error("Grok timeout after retries")
                    return None
            except Exception as e:
                logger.error("Grok request failed: %s", str(e))
                return None

        return None


class OpenAIProvider(AIProvider):
    """OpenAI GPT provider."""

    async def generate(
        self,
        system_prompt: str,
        user_prompt: str,
        max_tokens: int = 2000,
    ) -> Optional[str]:
        if not settings.OPENAI_API_KEY:
            logger.warning("OPENAI_API_KEY not configured")
            return None

        for attempt in range(MAX_RETRIES + 1):
            try:
                import httpx
                async with httpx.AsyncClient(timeout=60.0) as client:
                    response = await client.post(
                        "https://api.openai.com/v1/chat/completions",
                        headers={
                            "Authorization": f"Bearer {settings.OPENAI_API_KEY}",
                            "Content-Type": "application/json",
                        },
                        json={
                            "model": "gpt-4o-mini",
                            "messages": [
                                {"role": "system", "content": system_prompt},
                                {"role": "user", "content": user_prompt[:settings.AI_MAX_INPUT_TOKENS * 4]},
                            ],
                            "max_tokens": min(max_tokens, settings.AI_MAX_OUTPUT_TOKENS),
                            "temperature": 0.7,
                        },
                    )

                if response.status_code == 200:
                    data = response.json()
                    return data["choices"][0]["message"]["content"]
                elif response.status_code == 429:
                    if attempt < MAX_RETRIES:
                        logger.warning("OpenAI rate limited, retrying (attempt %d/%d)", attempt + 1, MAX_RETRIES)
                        await asyncio.sleep(RETRY_DELAY_SECONDS * (attempt + 1))
                        continue
                    else:
                        logger.error("OpenAI rate limit exceeded after retries")
                        return None
                elif response.status_code >= 500:
                    if attempt < MAX_RETRIES:
                        logger.warning("OpenAI server error %d, retrying (attempt %d/%d)", response.status_code, attempt + 1, MAX_RETRIES)
                        await asyncio.sleep(RETRY_DELAY_SECONDS)
                        continue
                    else:
                        logger.error("OpenAI server error %d after retries", response.status_code)
                        return None
                elif response.status_code == 401:
                    logger.error("OpenAI authentication failed - invalid API key")
                    return None
                else:
                    logger.error("OpenAI API error: status=%d", response.status_code)
                    return None

            except asyncio.TimeoutError:
                if attempt < MAX_RETRIES:
                    logger.warning("OpenAI timeout, retrying (attempt %d/%d)", attempt + 1, MAX_RETRIES)
                    await asyncio.sleep(RETRY_DELAY_SECONDS)
                    continue
                else:
                    logger.error("OpenAI timeout after retries")
                    return None
            except Exception as e:
                logger.error("OpenAI request failed: %s", str(e))
                return None

        return None


class GeminiProvider(AIProvider):
    """Google Gemini provider."""

    async def generate(
        self,
        system_prompt: str,
        user_prompt: str,
        max_tokens: int = 2000,
    ) -> Optional[str]:
        if not settings.GEMINI_API_KEY:
            logger.warning("GEMINI_API_KEY not configured")
            return None

        for attempt in range(MAX_RETRIES + 1):
            try:
                import httpx
                async with httpx.AsyncClient(timeout=60.0) as client:
                    response = await client.post(
                        f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={settings.GEMINI_API_KEY}",
                        json={
                            "system_instruction": {
                                "parts": [{"text": system_prompt}]
                            },
                            "contents": [
                                {
                                    "parts": [{"text": user_prompt[:settings.AI_MAX_INPUT_TOKENS * 4]}]
                                }
                            ],
                            "generationConfig": {
                                "maxOutputTokens": min(max_tokens, settings.AI_MAX_OUTPUT_TOKENS),
                                "temperature": 0.7,
                            },
                        },
                    )

                if response.status_code == 200:
                    data = response.json()
                    candidates = data.get("candidates", [])
                    if candidates:
                        parts = candidates[0].get("content", {}).get("parts", [])
                        if parts:
                            return parts[0].get("text", "")
                    return None
                elif response.status_code == 429:
                    if attempt < MAX_RETRIES:
                        logger.warning("Gemini rate limited, retrying (attempt %d/%d)", attempt + 1, MAX_RETRIES)
                        await asyncio.sleep(RETRY_DELAY_SECONDS * (attempt + 1))
                        continue
                    else:
                        logger.error("Gemini rate limit exceeded after retries")
                        return None
                elif response.status_code >= 500:
                    if attempt < MAX_RETRIES:
                        logger.warning("Gemini server error %d, retrying (attempt %d/%d)", response.status_code, attempt + 1, MAX_RETRIES)
                        await asyncio.sleep(RETRY_DELAY_SECONDS)
                        continue
                    else:
                        logger.error("Gemini server error %d after retries", response.status_code)
                        return None
                elif response.status_code == 401 or response.status_code == 403:
                    logger.error("Gemini authentication failed - invalid API key")
                    return None
                else:
                    logger.error("Gemini API error: status=%d", response.status_code)
                    return None

            except asyncio.TimeoutError:
                if attempt < MAX_RETRIES:
                    logger.warning("Gemini timeout, retrying (attempt %d/%d)", attempt + 1, MAX_RETRIES)
                    await asyncio.sleep(RETRY_DELAY_SECONDS)
                    continue
                else:
                    logger.error("Gemini timeout after retries")
                    return None
            except Exception as e:
                logger.error("Gemini request failed: %s", str(e))
                return None

        return None


class AnthropicProvider(AIProvider):
    """Anthropic Claude provider."""

    async def generate(
        self,
        system_prompt: str,
        user_prompt: str,
        max_tokens: int = 2000,
    ) -> Optional[str]:
        if not settings.ANTHROPIC_API_KEY:
            logger.warning("ANTHROPIC_API_KEY not configured")
            return None

        for attempt in range(MAX_RETRIES + 1):
            try:
                import httpx
                async with httpx.AsyncClient(timeout=60.0) as client:
                    response = await client.post(
                        "https://api.anthropic.com/v1/messages",
                        headers={
                            "x-api-key": settings.ANTHROPIC_API_KEY,
                            "anthropic-version": "2023-06-01",
                            "Content-Type": "application/json",
                        },
                        json={
                            "model": "claude-3-5-sonnet-20241022",
                            "max_tokens": min(max_tokens, settings.AI_MAX_OUTPUT_TOKENS),
                            "system": system_prompt,
                            "messages": [
                                {"role": "user", "content": user_prompt[:settings.AI_MAX_INPUT_TOKENS * 4]},
                            ],
                        },
                    )

                if response.status_code == 200:
                    data = response.json()
                    content = data.get("content", [])
                    if content:
                        return content[0].get("text", "")
                    return None
                elif response.status_code == 429:
                    if attempt < MAX_RETRIES:
                        logger.warning("Anthropic rate limited, retrying (attempt %d/%d)", attempt + 1, MAX_RETRIES)
                        await asyncio.sleep(RETRY_DELAY_SECONDS * (attempt + 1))
                        continue
                    else:
                        logger.error("Anthropic rate limit exceeded after retries")
                        return None
                elif response.status_code >= 500:
                    if attempt < MAX_RETRIES:
                        logger.warning("Anthropic server error %d, retrying (attempt %d/%d)", response.status_code, attempt + 1, MAX_RETRIES)
                        await asyncio.sleep(RETRY_DELAY_SECONDS)
                        continue
                    else:
                        logger.error("Anthropic server error %d after retries", response.status_code)
                        return None
                elif response.status_code == 401:
                    logger.error("Anthropic authentication failed - invalid API key")
                    return None
                else:
                    logger.error("Anthropic API error: status=%d", response.status_code)
                    return None

            except asyncio.TimeoutError:
                if attempt < MAX_RETRIES:
                    logger.warning("Anthropic timeout, retrying (attempt %d/%d)", attempt + 1, MAX_RETRIES)
                    await asyncio.sleep(RETRY_DELAY_SECONDS)
                    continue
                else:
                    logger.error("Anthropic timeout after retries")
                    return None
            except Exception as e:
                logger.error("Anthropic request failed: %s", str(e))
                return None

        return None


def get_ai_provider() -> AIProvider:
    """Factory: return the configured AI provider."""
    providers = {
        "grok": GrokProvider,
        "openai": OpenAIProvider,
        "gemini": GeminiProvider,
        "anthropic": AnthropicProvider,
    }

    provider_name = settings.AI_PROVIDER.lower()
    provider_class = providers.get(provider_name)

    if not provider_class:
        logger.warning("Unknown AI provider '%s', defaulting to Grok", provider_name)
        provider_class = GrokProvider

    return provider_class()
