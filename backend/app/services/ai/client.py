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

import logging
from abc import ABC, abstractmethod
from typing import Optional, Dict, Any

from app.core.config import settings

logger = logging.getLogger(__name__)


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
            else:
                logger.error("Grok API error: status=%d", response.status_code)
                return None

        except Exception as e:
            logger.error("Grok request failed: %s", str(e))
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
            else:
                logger.error("OpenAI API error: status=%d", response.status_code)
                return None

        except Exception as e:
            logger.error("OpenAI request failed: %s", str(e))
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
            else:
                logger.error("Gemini API error: status=%d", response.status_code)
                return None

        except Exception as e:
            logger.error("Gemini request failed: %s", str(e))
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
            else:
                logger.error("Anthropic API error: status=%d", response.status_code)
                return None

        except Exception as e:
            logger.error("Anthropic request failed: %s", str(e))
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
