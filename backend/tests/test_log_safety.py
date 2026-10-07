"""
Phase 10 - secret-safe logging.

Regression tests for the leak where httpx logged
``GET https://serpapi.com/search?...&api_key=<KEY>`` at INFO.
"""

import io
import logging
import re
from pathlib import Path

import httpx
import pytest

from app.core import log_safety
from app.core.config import settings
from app.core.log_safety import REDACTED, RedactingFormatter, redact

FAKE_SERP_KEY = "serp_TEST_KEY_do_not_use_0123456789"


# ─── redact() ───

@pytest.mark.parametrize(
    "line,secret",
    [
        ("GET https://serpapi.com/search?q=python&api_key=abc123SECRET&engine=google_jobs", "abc123SECRET"),
        ("GET https://x.test/a?apikey=abc123SECRET", "abc123SECRET"),
        ("url=/cb?access_token=abc123SECRET&x=1", "abc123SECRET"),
        ("Authorization: Bearer abc123SECRET.def456.ghi789", "abc123SECRET"),
        ("headers={'Authorization': 'Bearer abc123SECRET'}", "abc123SECRET"),
        ("Cookie: access_token=abc123SECRET; refresh_token=zzz999SECRET", "abc123SECRET"),
        ("Set-Cookie: refresh_token=abc123SECRET; HttpOnly", "abc123SECRET"),
        ("token eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.c2lnbmF0dXJl end", "eyJhbGciOiJIUzI1NiJ9"),
        ("INSERT ... ('a@b.com', '$argon2id$v=19$m=65536,t=3,p=4$c2FsdA$aGFzaGhhc2g')", "aGFzaGhhc2g"),
    ],
)
def test_redact_removes_credentials(line, secret):
    out = redact(line)
    assert secret not in out
    assert REDACTED in out


def test_redact_leaves_ordinary_text_alone():
    for line in (
        "Pipeline started: analysis_id=3 user_skills=12",
        "SerpApi Redis cache hit: key=serpapi:9f2c1b",  # cache key is a hash, not a secret
        "Google Jobs search: query='python developer' results=10",
        "AI_MAX_INPUT_TOKENS=4000 max_tokens=2000",
    ):
        assert redact(line) == line


def test_redact_removes_configured_secret_even_without_a_recognisable_pattern(monkeypatch):
    monkeypatch.setattr(settings, "SERPAPI_API_KEY", FAKE_SERP_KEY)
    monkeypatch.setattr(settings, "GROK_API_KEY", "xai-ANOTHER-FAKE-KEY-98765")
    out = redact(f"upstream said: bad credential {FAKE_SERP_KEY} / xai-ANOTHER-FAKE-KEY-98765")
    assert FAKE_SERP_KEY not in out and "ANOTHER-FAKE" not in out


def test_redact_ignores_trivially_short_configured_values(monkeypatch):
    monkeypatch.setattr(settings, "SERPAPI_API_KEY", "x")
    assert redact("an x marks the spot") == "an x marks the spot"


def test_formatter_redacts_exception_tracebacks():
    stream = io.StringIO()
    handler = logging.StreamHandler(stream)
    handler.setFormatter(RedactingFormatter("%(levelname)s %(message)s"))
    logger = logging.getLogger("log_safety_test_traceback")
    logger.handlers[:] = [handler]
    logger.propagate = False
    try:
        raise RuntimeError("failed GET https://serpapi.com/search?api_key=TRACEBACKSECRET1")
    except RuntimeError:
        logger.error("request failed", exc_info=True)
    assert "TRACEBACKSECRET1" not in stream.getvalue()
    assert REDACTED in stream.getvalue()


# ─── the actual leak path ───

def _serpapi_with_mock_transport(monkeypatch, handler):
    """Make serpapi_request use a MockTransport instead of the network."""
    import app.services.serpapi.client as serp_client

    real_client = httpx.AsyncClient
    monkeypatch.setattr(
        serp_client.httpx,
        "AsyncClient",
        lambda **kw: real_client(transport=httpx.MockTransport(handler), **kw),
    )
    monkeypatch.setattr(settings, "SERPAPI_API_KEY", FAKE_SERP_KEY)
    monkeypatch.setattr(settings, "REDIS_URL", "")
    serp_client._cache.clear()
    return serp_client


async def test_serpapi_request_never_logs_the_api_key(monkeypatch, caplog):
    """End to end: a real serpapi_request with root logging at INFO."""
    seen_urls = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen_urls.append(str(request.url))
        return httpx.Response(200, json={"jobs_results": []})

    serp_client = _serpapi_with_mock_transport(monkeypatch, handler)

    with caplog.at_level(logging.INFO):
        data = await serp_client.serpapi_request({"engine": "google_jobs", "q": "python"})

    assert data == {"jobs_results": []}
    # The key really is sent upstream (SerpApi requires it in the query string)...
    assert FAKE_SERP_KEY in seen_urls[0]
    # ...but it must not appear in any log record, raw or formatted.
    formatter = RedactingFormatter("%(name)s %(message)s")
    for record in caplog.records:
        assert FAKE_SERP_KEY not in record.getMessage(), record.name
        assert FAKE_SERP_KEY not in formatter.format(record)


async def test_serpapi_error_paths_never_log_the_api_key(monkeypatch, caplog):
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError(f"cannot connect to {request.url}")

    serp_client = _serpapi_with_mock_transport(monkeypatch, handler)

    with caplog.at_level(logging.DEBUG):
        assert await serp_client.serpapi_request({"engine": "google_jobs", "q": "err"}, max_retries=0) is None

    formatter = RedactingFormatter("%(name)s %(message)s")
    assert all(FAKE_SERP_KEY not in formatter.format(r) for r in caplog.records)


def test_httpx_request_url_logging_is_disabled_by_the_app():
    import app.main  # noqa: F401  (importing the app installs the log safety layer)

    for name in ("httpx", "httpcore"):
        assert logging.getLogger(name).getEffectiveLevel() >= logging.WARNING


def test_app_handlers_use_the_redacting_formatter():
    import app.main  # noqa: F401

    handlers = logging.getLogger().handlers
    assert handlers, "root logger has no handlers"
    stdout_handlers = [h for h in handlers if isinstance(h, logging.StreamHandler)]
    assert any(isinstance(h.formatter, RedactingFormatter) for h in stdout_handlers)


def test_even_if_httpx_info_logging_returns_the_key_is_still_redacted(monkeypatch):
    """Defence in depth: the formatter layer works on its own."""
    stream = io.StringIO()
    handler = logging.StreamHandler(stream)
    handler.setFormatter(RedactingFormatter("%(name)s | %(message)s"))
    httpx_logger = logging.getLogger("httpx")
    old_level, old_handlers, old_prop = httpx_logger.level, httpx_logger.handlers[:], httpx_logger.propagate
    httpx_logger.handlers[:] = [handler]
    httpx_logger.propagate = False
    httpx_logger.setLevel(logging.INFO)
    try:
        import asyncio

        async def go():
            transport = httpx.MockTransport(lambda r: httpx.Response(200, json={}))
            async with httpx.AsyncClient(transport=transport) as c:
                await c.get("https://serpapi.com/search", params={"q": "x", "api_key": FAKE_SERP_KEY})

        asyncio.run(go())
    finally:
        httpx_logger.handlers[:] = old_handlers
        httpx_logger.propagate = old_prop
        httpx_logger.setLevel(old_level)

    output = stream.getvalue()
    assert "HTTP Request" in output, "expected httpx to log the request in this scenario"
    assert FAKE_SERP_KEY not in output


# ─── static guard ───

LOG_CALL = re.compile(r"\blogger\.(debug|info|warning|error|exception|critical)\(")
FORBIDDEN_IN_LOG_CALLS = re.compile(
    r"settings\.\w*(KEY|SECRET)\w*|request_params|\.cookies\b|\bAuthorization\b|headers\b|\bpassword\b|password_hash",
    re.IGNORECASE,
)


def test_no_logging_call_references_secrets():
    app_dir = Path(log_safety.__file__).resolve().parents[1]
    offenders = []
    for path in app_dir.rglob("*.py"):
        if path.name == "log_safety.py":
            continue
        for number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
            if LOG_CALL.search(line) and FORBIDDEN_IN_LOG_CALLS.search(line):
                offenders.append(f"{path.relative_to(app_dir)}:{number}: {line.strip()}")
    assert not offenders, "logging calls that may leak secrets:\n" + "\n".join(offenders)
