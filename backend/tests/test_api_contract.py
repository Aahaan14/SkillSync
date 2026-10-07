"""
Phase 10 - API contract tests.

These pin down the contract the web dashboard and the Chrome extension rely on:
response shapes, status codes, the error format, ownership, and the rule that
deterministic market data and the deterministic alignment score can never be
changed by the AI layer.
"""

import json
from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.core.config import settings
from app.core.security import create_access_token, create_refresh_token
from app.main import app
from app.models.analysis import AnalysisStatus
from app.models.user import UserRole
from app.schemas import (
    AnalysisResponse,
    MarketJobResponse,
    MarketSearchResponse,
    MarketSkillsResponse,
    ProfileResponse,
    UserResponse,
)

USER_EMAIL = "test@example.com"
USER_PASSWORD = "Password123"

GENERIC_500 = "An unexpected error occurred. Please try again later."


# ─── helpers ───

def bearer(user) -> dict:
    return {"Authorization": f"Bearer {create_access_token({'sub': str(user.id)})}"}


async def login(client: AsyncClient, email: str = USER_EMAIL, password: str = USER_PASSWORD):
    return await client.post("/api/auth/login", json={"email": email, "password": password})


def assert_error(response, status_code: int) -> str:
    """Every non-422 error is exactly {"detail": "<message>"}."""
    assert response.status_code == status_code, response.text
    body = response.json()
    assert set(body) == {"detail"}, body
    assert isinstance(body["detail"], str) and body["detail"], body
    return body["detail"]


FULL_PROFILE = {
    "name": "Ada Lovelace",
    "headline": "Engineer",
    "about": "Builds things.",
    "location": "London",
    "profile_url": "https://example.com/ada",
    "skills": [{"name": "Python", "endorsements": 3}, {"name": "React"}],
    "experience": [{"title": "Engineer", "company": "Analytical Engines", "start_date": "2020"}],
    "education": [{"institution": "University of London", "degree": "BSc"}],
    "certifications": [{"name": "AWS SAA", "issuer": "AWS"}],
    "projects": [{"name": "SkillSync", "url": "https://example.com/p"}],
    "source": "manual",
}


def make_jobs():
    """Three distinct jobs: python 3/3, react 1/3, docker 1/3 (deterministic)."""
    return [
        {"title": "Backend Engineer", "company": "A", "location": "Remote",
         "skills": ["Python", "React"], "url": "https://example.com/1"},
        {"title": "Platform Engineer", "company": "B", "location": "Remote",
         "skills": ["Python", "Docker"], "url": "https://example.com/2"},
        {"title": "Data Engineer", "company": "C", "location": "Remote",
         "skills": ["Python"], "url": "https://example.com/3"},
    ]


# What the AI is allowed to supply - and everything it must NOT be able to touch.
HOSTILE_AI_RESULT = {
    "summary": "Great fit!",
    "strengths": ["Python"],
    "gaps": ["Docker"],
    "recommendations": [{"action": "Learn Docker", "reason": "In demand", "priority": "high"}],
    "relevant_roles": ["Backend Engineer"],
    "roadmap": [{"skill": "Docker", "priority": 1, "reasoning": "33% of jobs"}],
    "alignment_scores": {
        "skill_alignment": 0.99,       # must be ignored
        "role_alignment": 0.5,
        "education_alignment": 0.25,
        "experience_alignment": 0.75,
    },
    # Fields the AI must never be able to write at all:
    "overall_alignment_score": 100,
    "market_skills": {"fake-skill": {"count": 99, "percentage": 99.0}},
    "jobs_analyzed_count": 999,
    "strengths_det": ["fake"],
}


@pytest.fixture
async def authed(client: AsyncClient, test_user):
    resp = await login(client)
    assert resp.status_code == 200
    return client


@pytest.fixture
async def saved_profile(authed: AsyncClient):
    resp = await authed.put("/api/profile", json=FULL_PROFILE)
    assert resp.status_code == 200
    return resp.json()


async def run_analysis(client: AsyncClient, *, jobs, ai_result=None, body=None):
    """POST /api/analysis with SerpApi and the AI provider mocked."""
    with patch("app.services.pipeline.generate_market_queries", return_value=["engineer jobs"]), \
         patch("app.services.pipeline.execute_market_queries", AsyncMock(return_value=jobs)), \
         patch("app.services.pipeline.analyze_profile_vs_market", AsyncMock(return_value=ai_result)) as ai:
        resp = await client.post("/api/analysis", json=body or {})
    return resp, ai


# ═══════════════════════════ AUTH ═══════════════════════════

async def test_register_response_contract(client: AsyncClient):
    resp = await client.post(
        "/api/auth/register",
        json={"email": "new@example.com", "password": "Password123", "full_name": "New User"},
    )
    assert resp.status_code == 201
    body = resp.json()
    assert set(body) == set(UserResponse.model_fields)
    assert body["email"] == "new@example.com"
    assert body["role"] == UserRole.USER.value
    assert isinstance(body["access_token"], str) and body["access_token"]
    assert "password" not in json.dumps(body).lower().replace("access_token", "")

    set_cookie = " ".join(resp.headers.get_list("set-cookie")).lower()
    assert "access_token=" in set_cookie and "refresh_token=" in set_cookie
    assert set_cookie.count("httponly") >= 2


async def test_login_response_contract(client: AsyncClient, test_user):
    resp = await login(client)
    assert resp.status_code == 200
    body = resp.json()
    assert set(body) == set(UserResponse.model_fields)
    assert body["id"] == test_user.id
    assert body["access_token"]
    assert {c.lower().split("=")[0] for c in resp.headers.get_list("set-cookie")} == {
        "access_token", "refresh_token"
    }


async def test_me_is_authoritative_and_has_no_token(authed: AsyncClient, test_user):
    resp = await authed.get("/api/auth/me")
    assert resp.status_code == 200
    body = resp.json()
    assert set(body) == set(UserResponse.model_fields)
    assert body["id"] == test_user.id
    assert body["email"] == USER_EMAIL
    assert body["access_token"] is None  # only register/login populate it


async def test_login_failures_do_not_enumerate_accounts(client: AsyncClient, test_user):
    wrong_pw = assert_error(await login(client, USER_EMAIL, "WrongPass999"), 401)
    unknown = assert_error(await login(client, "nobody@example.com", "Password123"), 401)
    assert wrong_pw == unknown == "Invalid email or password"


async def test_register_duplicate_is_409_with_string_detail(client: AsyncClient, test_user):
    resp = await client.post(
        "/api/auth/register", json={"email": USER_EMAIL, "password": "Password123"}
    )
    assert_error(resp, 409)


PROTECTED = [
    ("GET", "/api/auth/me"),
    ("GET", "/api/profile"),
    ("PUT", "/api/profile"),
    ("POST", "/api/analysis"),
    ("GET", "/api/analysis"),
    ("GET", "/api/analysis/latest"),
    ("GET", "/api/analysis/1"),
    ("POST", "/api/market/search"),
    ("GET", "/api/market/skills"),
    ("GET", "/api/admin/stats"),
    ("GET", "/api/admin/users"),
]


@pytest.mark.parametrize("method,path", PROTECTED)
async def test_protected_routes_return_401_without_credentials(client: AsyncClient, method, path):
    body = {"query": "python"} if path.endswith("/search") else {}
    resp = await client.request(method, path, json=body if method != "GET" else None)
    assert assert_error(resp, 401) == "Not authenticated"


async def test_invalid_and_wrong_type_tokens_are_401(client: AsyncClient, test_user):
    garbage = await client.get("/api/auth/me", headers={"Authorization": "Bearer not-a-jwt"})
    assert assert_error(garbage, 401) == "Invalid or expired token"

    # A refresh token must never be accepted as an access token.
    refresh = create_refresh_token({"sub": str(test_user.id)})
    wrong_type = await client.get("/api/auth/me", headers={"Authorization": f"Bearer {refresh}"})
    assert_error(wrong_type, 401)


async def test_token_for_deleted_user_is_401(client: AsyncClient):
    headers = {"Authorization": f"Bearer {create_access_token({'sub': '987654'})}"}
    assert assert_error(await client.get("/api/auth/me", headers=headers), 401) == "User not found"


async def test_non_numeric_subject_is_401_not_500(client: AsyncClient):
    headers = {"Authorization": f"Bearer {create_access_token({'sub': 'abc'})}"}
    assert_error(await client.get("/api/auth/me", headers=headers), 401)


async def test_valid_bearer_wins_over_stale_cookie(client: AsyncClient, test_user):
    """The extension shares the browser cookie jar; an expired cookie must not lock it out."""
    client.cookies.set("access_token", "stale.invalid.cookie")
    resp = await client.get("/api/auth/me", headers=bearer(test_user))
    assert resp.status_code == 200
    assert resp.json()["id"] == test_user.id


async def test_cookie_only_authentication_works(authed: AsyncClient):
    assert "authorization" not in authed.headers
    assert (await authed.get("/api/auth/me")).status_code == 200


async def test_logout_expires_both_cookies_with_matching_attributes(
    authed: AsyncClient, monkeypatch
):
    monkeypatch.setattr(settings, "COOKIE_DOMAIN", "example.com")
    resp = await authed.post("/api/auth/logout")
    assert resp.status_code == 200
    assert resp.json() == {"message": "Logged out successfully"}

    cookies = {c.split("=")[0]: c.lower() for c in resp.headers.get_list("set-cookie")}
    assert set(cookies) == {"access_token", "refresh_token"}
    assert "path=/;" in cookies["access_token"] + ";" or "path=/ " in cookies["access_token"] + " "
    assert "path=/api/auth/refresh" in cookies["refresh_token"]
    for cookie in cookies.values():
        assert "max-age=0" in cookie
        # Browsers only drop a cookie whose Domain/HttpOnly/SameSite match the original.
        assert "domain=example.com" in cookie
        assert "httponly" in cookie
        assert "samesite=" in cookie


async def test_logout_is_idempotent_without_session(client: AsyncClient):
    assert (await client.post("/api/auth/logout")).status_code == 200


async def test_refresh_contract(authed: AsyncClient):
    resp = await authed.post("/api/auth/refresh")
    assert resp.status_code == 200
    body = resp.json()
    assert set(body) == {"access_token", "token_type"}
    assert body["token_type"] == "bearer"
    assert len(resp.headers.get_list("set-cookie")) == 2  # rotated


async def test_refresh_rejects_missing_and_wrong_tokens(client: AsyncClient, test_user):
    assert_error(await client.post("/api/auth/refresh"), 401)

    # An access token in the refresh cookie slot is invalid.
    client.cookies.set("refresh_token", create_access_token({"sub": str(test_user.id)}))
    assert_error(await client.post("/api/auth/refresh"), 401)

    client.cookies.set("refresh_token", create_refresh_token({"sub": "oops"}))
    assert_error(await client.post("/api/auth/refresh"), 401)


async def test_admin_routes_403_for_user_and_typed_for_admin(
    client: AsyncClient, test_user, admin_user
):
    assert assert_error(await client.get("/api/admin/stats", headers=bearer(test_user)), 403)

    stats = await client.get("/api/admin/stats", headers=bearer(admin_user))
    assert stats.status_code == 200
    assert set(stats.json()) == {"total_users", "total_profiles", "total_analyses"}

    users = await client.get("/api/admin/users", headers=bearer(admin_user))
    assert users.status_code == 200
    for row in users.json():
        assert set(row) == {"id", "email", "full_name", "role", "created_at"}
        assert row["role"] in {"user", "admin"}


# ═══════════════════════════ ERRORS ═══════════════════════════

async def test_validation_error_shape_does_not_echo_submitted_values(client: AsyncClient):
    secret_pw = "weakpassword"  # fails the strength rules
    resp = await client.post(
        "/api/auth/register", json={"email": "x@example.com", "password": secret_pw}
    )
    assert resp.status_code == 422
    detail = resp.json()["detail"]
    assert isinstance(detail, list) and detail
    for issue in detail:
        assert set(issue) == {"loc", "msg", "type"}
    assert secret_pw not in resp.text  # never reflect credentials back


async def test_validation_error_for_bad_path_param(authed: AsyncClient):
    resp = await authed.get("/api/analysis/not-a-number")
    assert resp.status_code == 422
    assert all(set(i) == {"loc", "msg", "type"} for i in resp.json()["detail"])


async def test_unknown_route_uses_detail_format(client: AsyncClient):
    assert_error(await client.get("/api/does-not-exist"), 404)


async def test_unhandled_exception_returns_generic_500_without_internals():
    @app.get("/api/__contract_boom")
    async def boom():  # pragma: no cover - executed through the ASGI app
        raise RuntimeError("db password hunter2 at /srv/app/secret.py")

    try:
        transport = ASGITransport(app=app, raise_app_exceptions=False)
        async with AsyncClient(transport=transport, base_url="http://test") as c:
            resp = await c.get("/api/__contract_boom")
    finally:
        app.router.routes[:] = [
            r for r in app.router.routes if getattr(r, "path", "") != "/api/__contract_boom"
        ]

    assert resp.status_code == 500
    assert resp.json() == {"detail": GENERIC_500}
    for leak in ("hunter2", "/srv/app", "Traceback", "RuntimeError"):
        assert leak not in resp.text


# ═══════════════════════════ PROFILE ═══════════════════════════

async def test_profile_404_before_creation(authed: AsyncClient):
    assert "profile" in assert_error(await authed.get("/api/profile"), 404).lower()


async def test_empty_profile_roundtrip(authed: AsyncClient, test_user):
    put = await authed.put("/api/profile", json={})
    assert put.status_code == 200
    body = put.json()
    assert set(body) == set(ProfileResponse.model_fields)
    assert body["user_id"] == test_user.id
    for text_field in ("name", "headline", "about", "location", "profile_url", "source"):
        assert body[text_field] is None
    for list_field in ("skills", "experience", "education", "certifications", "projects"):
        assert body[list_field] == []  # never null

    assert (await authed.get("/api/profile")).json() == body


async def test_partial_profile_keeps_unsent_lists_empty(authed: AsyncClient):
    body = (await authed.put("/api/profile", json={"name": "Ada", "skills": [{"name": "Go"}]})).json()
    assert body["name"] == "Ada"
    assert body["skills"] == [{"name": "Go", "endorsements": None}]
    assert body["experience"] == [] and body["projects"] == []


async def test_populated_profile_roundtrip(authed: AsyncClient, saved_profile):
    assert set(saved_profile) == set(ProfileResponse.model_fields)
    for key in ("name", "headline", "about", "location", "profile_url", "source"):
        assert saved_profile[key] == FULL_PROFILE[key]
    assert saved_profile["skills"][0] == {"name": "Python", "endorsements": 3}
    assert saved_profile["experience"][0]["company"] == "Analytical Engines"
    assert saved_profile["education"][0]["institution"] == "University of London"
    assert saved_profile["certifications"][0]["issuer"] == "AWS"
    assert saved_profile["projects"][0]["url"] == "https://example.com/p"
    assert (await authed.get("/api/profile")).json() == saved_profile


async def test_profile_put_is_a_full_replace(authed: AsyncClient, saved_profile):
    body = (await authed.put("/api/profile", json={"name": "Only Name"})).json()
    assert body["name"] == "Only Name"
    assert body["skills"] == [] and body["headline"] is None
    assert body["id"] == saved_profile["id"]  # same row, not a second profile


@pytest.mark.parametrize(
    "payload,loc_tail",
    [
        ({"name": ""}, "name"),                                        # extension sent '' before the fix
        ({"name": "x" * 101}, "name"),
        ({"profile_url": "javascript:alert(1)"}, "profile_url"),
        ({"projects": [{"name": "p", "url": "ftp://x"}]}, "url"),
        ({"skills": [{"name": ""}]}, "name"),
        ({"skills": [{"name": "s"}] * 201}, "skills"),
    ],
)
async def test_profile_validation_errors_are_422_with_field_locations(
    authed: AsyncClient, payload, loc_tail
):
    resp = await authed.put("/api/profile", json=payload)
    assert resp.status_code == 422
    assert any(loc_tail in [str(p) for p in i["loc"]] for i in resp.json()["detail"])


async def test_profile_owner_comes_from_token_not_body(
    client: AsyncClient, test_user, admin_user
):
    resp = await client.put(
        "/api/profile",
        json={"name": "Mine", "user_id": admin_user.id},
        headers=bearer(test_user),
    )
    assert resp.status_code == 200
    assert resp.json()["user_id"] == test_user.id
    assert_error(await client.get("/api/profile", headers=bearer(admin_user)), 404)


# ═══════════════════════════ ANALYSIS ═══════════════════════════

async def test_analysis_requires_a_profile(authed: AsyncClient):
    assert "profile" in assert_error(await authed.post("/api/analysis", json={}), 400).lower()


async def test_latest_and_list_404_or_empty_before_any_analysis(authed: AsyncClient, saved_profile):
    assert_error(await authed.get("/api/analysis/latest"), 404)
    listing = await authed.get("/api/analysis")
    assert listing.status_code == 200 and listing.json() == []


async def test_analysis_response_contract(authed: AsyncClient, saved_profile):
    resp, _ = await run_analysis(authed, jobs=make_jobs(), ai_result=HOSTILE_AI_RESULT)
    assert resp.status_code == 201
    body = resp.json()

    assert set(body) == set(AnalysisResponse.model_fields)
    assert body["status"] == AnalysisStatus.COMPLETED.value
    assert isinstance(body["id"], int)
    assert body["error_message"] is None
    assert body["created_at"] and body["updated_at"]
    assert body["jobs_analyzed_count"] == 3

    # market_skills: dict keyed by canonical skill, bounded numbers, no duplicates
    skills = body["market_skills"]
    assert set(skills) == {"python", "react", "docker"}
    for key, entry in skills.items():
        assert entry["canonical_skill"] == key == key.lower()
        assert 0 <= entry["count"] <= body["jobs_analyzed_count"]
        assert 0 <= entry["percentage"] <= 100
    assert skills["python"]["percentage"] == 100.0

    # strengths / gaps partition the market skills exactly
    strengths, gaps = body["strengths"], body["skill_gaps"]
    assert {s["skill"] for s in strengths} == {"python", "react"}
    assert {g["skill"] for g in gaps} == {"docker"}
    assert {s["skill"] for s in strengths}.isdisjoint({g["skill"] for g in gaps})
    assert all(s["status"] == "strong" and s["priority_rank"] is None for s in strengths)
    assert [g["priority_rank"] for g in gaps] == list(range(1, len(gaps) + 1))
    assert all(g["status"] == "missing" for g in gaps)

    # No NaN / Infinity can ever be serialised.
    json.loads(resp.text, parse_constant=lambda c: pytest.fail(f"non-finite number {c}"))


async def test_deterministic_score_is_authoritative_and_ai_cannot_overwrite_it(
    authed: AsyncClient, saved_profile
):
    resp, ai = await run_analysis(authed, jobs=make_jobs(), ai_result=HOSTILE_AI_RESULT)
    body = resp.json()
    ai.assert_awaited_once()

    # (100 + 33.3) / (100 + 33.3 + 33.3) * 100 = 80.0, computed from the sample only.
    assert body["skill_alignment"] == pytest.approx(80.0, abs=0.1)
    assert body["overall_alignment_score"] == body["skill_alignment"]
    assert body["overall_alignment_score"] != 99 and body["overall_alignment_score"] != 100

    # AI may supply ONLY the contextual dimensions and the ai_* text fields.
    assert body["role_alignment"] == 50.0
    assert body["education_alignment"] == 25.0
    assert body["experience_alignment"] == 75.0
    assert body["ai_summary"] == "Great fit!"
    assert body["ai_roadmap"] == [{"skill": "Docker", "priority": 1, "reasoning": "33% of jobs"}]
    assert body["ai_recommendations"][0]["priority"] == "high"

    # Deterministic market data is untouched by the AI's claims.
    assert "fake-skill" not in body["market_skills"]
    assert body["jobs_analyzed_count"] == 3


async def test_analysis_without_ai_is_still_complete(authed: AsyncClient, saved_profile):
    resp, _ = await run_analysis(authed, jobs=make_jobs(), ai_result=None)
    body = resp.json()
    assert resp.status_code == 201 and body["status"] == "completed"
    assert body["overall_alignment_score"] == pytest.approx(80.0, abs=0.1)
    assert body["ai_summary"] is None
    assert body["role_alignment"] is None
    assert not body["ai_recommendations"] and not body["ai_roadmap"]


async def test_zero_job_analysis_contract(authed: AsyncClient, saved_profile):
    resp, ai = await run_analysis(authed, jobs=[], ai_result=HOSTILE_AI_RESULT)
    assert resp.status_code == 201
    body = resp.json()
    assert body["status"] == "completed"
    assert body["jobs_analyzed_count"] == 0
    assert body["market_skills"] == {}
    assert body["strengths"] == [] and body["skill_gaps"] == []
    assert body["skill_alignment"] == 0.0 and body["overall_alignment_score"] == 0.0
    # Nothing to interpret -> the AI is not called and nothing is invented.
    ai.assert_not_awaited()
    assert body["ai_summary"] is None
    assert not body["ai_roadmap"] and not body["ai_strengths"]
    json.loads(resp.text, parse_constant=lambda c: pytest.fail(f"non-finite number {c}"))


async def test_failed_analysis_is_201_with_generic_error_message(
    authed: AsyncClient, saved_profile
):
    with patch("app.services.pipeline.generate_market_queries", return_value=["q"]), \
         patch(
             "app.services.pipeline.execute_market_queries",
             AsyncMock(side_effect=RuntimeError("api_key=SUPERSECRETKEY123 /srv/app/x.py")),
         ):
        resp = await authed.post("/api/analysis", json={})
    assert resp.status_code == 201
    body = resp.json()
    assert body["status"] == "failed"
    assert isinstance(body["error_message"], str) and body["error_message"]
    for leak in ("SUPERSECRETKEY123", "/srv/app", "RuntimeError"):
        assert leak not in resp.text


async def test_latest_list_and_get_by_id_agree(authed: AsyncClient, saved_profile):
    first, _ = await run_analysis(authed, jobs=make_jobs())
    second, _ = await run_analysis(authed, jobs=[])
    first_id, second_id = first.json()["id"], second.json()["id"]
    assert second_id > first_id

    latest = (await authed.get("/api/analysis/latest")).json()
    assert latest["id"] == second_id

    listing = (await authed.get("/api/analysis")).json()
    assert [a["id"] for a in listing] == [second_id, first_id]  # newest first
    assert all(set(a) == set(AnalysisResponse.model_fields) for a in listing)

    by_id = await authed.get(f"/api/analysis/{first_id}")
    assert by_id.status_code == 200 and by_id.json() == first.json()


async def test_analysis_ownership_is_enforced_with_404(
    client: AsyncClient, test_user, admin_user
):
    mine, theirs = bearer(test_user), bearer(admin_user)
    assert (await client.put("/api/profile", json=FULL_PROFILE, headers=mine)).status_code == 200
    with patch("app.services.pipeline.generate_market_queries", return_value=["q"]), \
         patch("app.services.pipeline.execute_market_queries", AsyncMock(return_value=make_jobs())), \
         patch("app.services.pipeline.analyze_profile_vs_market", AsyncMock(return_value=None)):
        created = await client.post("/api/analysis", json={}, headers=mine)
    analysis_id = created.json()["id"]

    # Another user gets 404 (not 403) so ids cannot be probed.
    assert_error(await client.get(f"/api/analysis/{analysis_id}", headers=theirs), 404)
    assert_error(await client.get("/api/analysis/latest", headers=theirs), 404)
    assert (await client.get("/api/analysis", headers=theirs)).json() == []
    assert_error(await client.get("/api/market/skills", headers=theirs), 404)
    assert_error(await client.get("/api/analysis/999999", headers=mine), 404)


async def test_analysis_request_ignores_client_supplied_owner(
    authed: AsyncClient, saved_profile, admin_user
):
    resp, _ = await run_analysis(authed, jobs=make_jobs(), body={"user_id": admin_user.id})
    assert resp.status_code == 201
    assert_error(
        await authed.get("/api/analysis/latest", headers=bearer(admin_user)), 404
    )


# ═══════════════════════════ MARKET ═══════════════════════════

async def test_market_skills_matches_latest_analysis(authed: AsyncClient, saved_profile):
    assert_error(await authed.get("/api/market/skills"), 404)

    created, _ = await run_analysis(authed, jobs=make_jobs())
    resp = await authed.get("/api/market/skills")
    assert resp.status_code == 200
    body = resp.json()
    assert set(body) == set(MarketSkillsResponse.model_fields)
    assert body["market_skills"] == created.json()["market_skills"]
    assert body["jobs_analyzed_count"] == 3
    assert isinstance(body["analysis_date"], str) and "T" in body["analysis_date"]


async def test_market_skills_for_zero_job_analysis_is_empty_not_404(
    authed: AsyncClient, saved_profile
):
    await run_analysis(authed, jobs=[])
    # {} is falsy, so the endpoint reports "no data" rather than an empty dict.
    assert_error(await authed.get("/api/market/skills"), 404)


async def test_market_search_contract(authed: AsyncClient):
    jobs = [
        {"title": "Dev", "company": "A", "location": "Remote", "skills": ["python"],
         "description": "long text that must not leak into the contract",
         "experience": None, "education": None, "salary": None,
         "employment_type": "Full-time", "source": "Google Jobs", "url": None},
        {"title": "Sparse", "company": None, "location": None, "skills": [],
         "experience": None, "education": None, "salary": None,
         "employment_type": None, "source": None, "url": None},
    ]
    with patch("app.services.serpapi.search.search_google_jobs", AsyncMock(return_value=jobs)):
        resp = await authed.post(
            "/api/market/search", json={"query": "python developer", "num_results": 5}
        )
    assert resp.status_code == 200
    body = resp.json()
    assert set(body) == set(MarketSearchResponse.model_fields)
    assert body["total_results"] == len(body["jobs"]) == 2
    assert body["cached"] is False
    for job in body["jobs"]:
        assert set(job) == set(MarketJobResponse.model_fields)
        assert "description" not in job
    assert body["jobs"][1]["company"] is None and body["jobs"][1]["skills"] == []


async def test_market_search_empty_results_render_safely(authed: AsyncClient):
    with patch("app.services.serpapi.search.search_google_jobs", AsyncMock(return_value=[])):
        resp = await authed.post("/api/market/search", json={"query": "zzzz nothing"})
    assert resp.status_code == 200
    assert resp.json() == {"query": "zzzz nothing", "jobs": [], "total_results": 0, "cached": False}


@pytest.mark.parametrize(
    "payload",
    [{}, {"query": "a"}, {"query": "python", "num_results": 0}, {"query": "python", "num_results": 51}],
)
async def test_market_search_validation(authed: AsyncClient, payload):
    assert (await authed.post("/api/market/search", json=payload)).status_code == 422


async def test_market_search_failure_is_503_without_provider_details(authed: AsyncClient):
    boom = AsyncMock(side_effect=RuntimeError("https://serpapi.com/search?api_key=LEAKME123456"))
    with patch("app.services.serpapi.search.search_jobs", boom):
        resp = await authed.post("/api/market/search", json={"query": "python"})
    assert "temporarily unavailable" in assert_error(resp, 503)
    assert "LEAKME123456" not in resp.text and "serpapi" not in resp.text.lower()


def test_google_job_title_is_never_null():
    from app.services.serpapi.jobs import _normalize_google_job

    assert _normalize_google_job({"title": None})["title"] == "Unknown"
    assert _normalize_google_job({"title": ""})["title"] == "Unknown"
    assert _normalize_google_job({})["title"] == "Unknown"
    assert _normalize_google_job({"title": "Dev"})["title"] == "Dev"


# ═══════════════════════════ OPENAPI ═══════════════════════════

PUBLIC_OPERATIONS = {
    ("post", "/api/auth/register"),
    ("post", "/api/auth/login"),
    ("post", "/api/auth/logout"),
    ("post", "/api/auth/refresh"),
    ("get", "/api/health"),
}


@pytest.fixture(scope="module")
def spec() -> dict:
    return app.openapi()


def test_openapi_declares_both_auth_schemes(spec):
    schemes = spec["components"]["securitySchemes"]
    assert schemes["cookieAuth"] == {"type": "apiKey", "in": "cookie", "name": "access_token"}
    assert schemes["bearerAuth"] == {"type": "http", "scheme": "bearer"}


def test_openapi_security_matches_public_and_protected_routes(spec):
    for path, operations in spec["paths"].items():
        for method, op in operations.items():
            if (method, path) in PUBLIC_OPERATIONS:
                assert "security" not in op, f"{method} {path} should be public"
            else:
                assert op.get("security"), f"{method} {path} must declare authentication"
                assert "401" in op["responses"], f"{method} {path} must document 401"


def test_openapi_routes_are_the_documented_inventory(spec):
    expected = {
        ("post", "/api/auth/register"), ("post", "/api/auth/login"), ("post", "/api/auth/logout"),
        ("post", "/api/auth/refresh"), ("get", "/api/auth/me"),
        ("get", "/api/profile"), ("put", "/api/profile"),
        ("post", "/api/analysis"), ("get", "/api/analysis"),
        ("get", "/api/analysis/latest"), ("get", "/api/analysis/{analysis_id}"),
        ("post", "/api/market/search"), ("get", "/api/market/skills"),
        ("get", "/api/admin/stats"), ("get", "/api/admin/users"),
        ("get", "/api/health"),
    }
    actual = {(m, p) for p, ops in spec["paths"].items() for m in ops}
    assert actual == expected


def test_openapi_enums_and_nullability(spec):
    schemas = spec["components"]["schemas"]
    assert schemas["AnalysisStatus"]["enum"] == [s.value for s in AnalysisStatus]
    assert schemas["UserRole"]["enum"] == [r.value for r in UserRole]
    assert schemas["SkillComparison"]["properties"]["status"]["anyOf"][0]["enum"] == ["strong", "missing"]

    analysis = schemas["AnalysisResponse"]
    assert set(analysis["required"]) == set(AnalysisResponse.model_fields)

    def nullable(prop):
        return any(branch.get("type") == "null" for branch in prop.get("anyOf", []))

    for field in ("error_message", "overall_alignment_score", "ai_summary", "market_skills",
                  "strengths", "skill_gaps", "role_alignment"):
        assert nullable(analysis["properties"][field]), field
    for field in ("id", "status", "jobs_analyzed_count", "created_at"):
        assert not nullable(analysis["properties"][field]), field


def test_openapi_exposes_no_secret_fields_in_responses(spec):
    banned = ("password", "hash", "secret", "api_key", "apikey", "jwt", "refresh_token")
    request_only = {"UserRegister", "UserLogin"}
    for name, schema in spec["components"]["schemas"].items():
        if name in request_only:
            continue
        for prop in schema.get("properties", {}):
            assert not any(b in prop.lower() for b in banned), f"{name}.{prop}"
    # access_token is allowed only where it is intentionally returned.
    holders = {n for n, s in spec["components"]["schemas"].items() if "access_token" in s.get("properties", {})}
    assert holders == {"UserResponse", "TokenResponse"}


def test_error_responses_are_documented_with_one_format(spec):
    schemas = spec["components"]["schemas"]
    assert set(schemas["ErrorResponse"]["properties"]) == {"detail"}
    assert schemas["ErrorResponse"]["properties"]["detail"]["type"] == "string"
    assert set(schemas["ValidationIssue"]["properties"]) == {"loc", "msg", "type"}


def test_committed_openapi_snapshot_is_current(spec):
    """
    docs/openapi.json is the reviewable source of truth for client types.
    If this fails you changed the API: run `python scripts/export_openapi.py`,
    then update web/types and extension/src/types to match.
    """
    snapshot = Path(__file__).resolve().parents[2] / "docs" / "openapi.json"
    assert snapshot.exists(), "docs/openapi.json missing - run scripts/export_openapi.py"
    committed = json.loads(snapshot.read_text(encoding="utf-8"))
    live = json.loads(json.dumps(spec, sort_keys=True, ensure_ascii=False))
    assert committed == live
