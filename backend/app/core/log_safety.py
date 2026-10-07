"""
Career Copilot - Log Safety

Keeps secrets out of log output.

Why this exists: httpx logs every request at INFO as
``HTTP Request: GET https://serpapi.com/search?q=...&api_key=<KEY> "HTTP/1.1 200 OK"``.
SerpApi only accepts its key as a query-string parameter, so the key ends up in
the URL and therefore in the log line. Two independent layers prevent that:

1. ``quiet_http_client_loggers`` raises the httpx/httpcore loggers above INFO so
   per-request URL lines are not emitted at all.
2. ``RedactingFormatter`` scrubs anything that still looks like a secret
   (query-string credentials, Authorization headers, cookies, JWTs and the
   literal configured key values) from every formatted record, including
   exception tracebacks.

This is a defence-in-depth fix for the leak found in Phase 10. The broader
security review (audit logging, request-id correlation, etc.) belongs to Phase 11.
"""

import logging
import re
from typing import Iterable, List

REDACTED = "[REDACTED]"

# Query-string / form style credentials:  api_key=abc  token=abc  access_token=abc ...
_QUERY_SECRET = re.compile(
    r"(?i)\b(api[_-]?key|apikey|access[_-]?token|refresh[_-]?token|token|secret|password|passwd|client[_-]?secret)=([^&\s\"'<>]+)"
)
# Header style credentials:  Authorization: Bearer abc   Cookie: access_token=abc   Set-Cookie: ...
_HEADER_SECRET = re.compile(
    r"(?i)\b(authorization|proxy-authorization|cookie|set-cookie|x-api-key)\s*[:=]\s*[^\r\n]+"
)
# Bare bearer tokens that show up outside a header line.
_BEARER = re.compile(r"(?i)\bbearer\s+[A-Za-z0-9._~+/=-]+")
# Argon2 password hashes (SQLAlchemy echo prints bound parameters in development).
_ARGON2 = re.compile(
    r"\$argon2[a-z]*\$(?:v=\d+\$)?m=\d+,t=\d+,p=\d+\$[A-Za-z0-9+/]+\$[A-Za-z0-9+/]+"
)
# JWTs (header.payload.signature, each segment base64url) wherever they appear.
_JWT = re.compile(r"\beyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]*")

# Names of settings whose values must never be printed verbatim.
_SECRET_SETTING_NAMES = (
    "SERPAPI_API_KEY",
    "GROK_API_KEY",
    "OPENAI_API_KEY",
    "GEMINI_API_KEY",
    "ANTHROPIC_API_KEY",
    "JWT_SECRET",
    "JWT_REFRESH_SECRET",
)

# Ignore values that are too short to be a real secret (avoids mangling logs when a
# key is configured as something like "x" in tests).
_MIN_SECRET_LENGTH = 8


def _configured_secret_values() -> List[str]:
    # Imported lazily so this module has no import-time dependency on settings.
    from app.core.config import settings

    values = []
    for name in _SECRET_SETTING_NAMES:
        value = getattr(settings, name, "") or ""
        if isinstance(value, str) and len(value) >= _MIN_SECRET_LENGTH:
            values.append(value)
    # Longest first so a secret that contains another is fully replaced.
    return sorted(set(values), key=len, reverse=True)


def redact(text: str, extra_secrets: Iterable[str] = ()) -> str:
    """Return ``text`` with credentials replaced by ``[REDACTED]``."""
    if not text:
        return text

    for secret in sorted({s for s in extra_secrets if s}, key=len, reverse=True):
        text = text.replace(secret, REDACTED)
    for secret in _configured_secret_values():
        text = text.replace(secret, REDACTED)

    text = _HEADER_SECRET.sub(lambda m: f"{m.group(1)}: {REDACTED}", text)
    text = _QUERY_SECRET.sub(lambda m: f"{m.group(1)}={REDACTED}", text)
    text = _BEARER.sub(f"Bearer {REDACTED}", text)
    text = _JWT.sub(REDACTED, text)
    text = _ARGON2.sub(REDACTED, text)
    return text


class RedactingFormatter(logging.Formatter):
    """Formatter that redacts secrets from the final line, traceback included."""

    def format(self, record: logging.LogRecord) -> str:  # noqa: A003 - stdlib name
        return redact(super().format(record))


def quiet_http_client_loggers() -> None:
    """Stop httpx/httpcore from logging request URLs (which can carry api_key)."""
    for name in ("httpx", "httpcore"):
        logging.getLogger(name).setLevel(logging.WARNING)


_DEFAULT_FORMAT = "%(asctime)s | %(levelname)s | %(name)s | %(message)s"


def install_log_redaction(fmt: str = _DEFAULT_FORMAT) -> None:
    """
    Apply redaction to the root logger's handlers and to uvicorn's handlers, and
    silence httpx request-URL logging. Safe to call more than once.
    """
    quiet_http_client_loggers()
    formatter = RedactingFormatter(fmt)
    seen = set()
    for logger_name in ("", "uvicorn", "uvicorn.error", "uvicorn.access"):
        for handler in logging.getLogger(logger_name).handlers:
            if id(handler) in seen:
                continue
            seen.add(id(handler))
            handler.setFormatter(formatter)
