"""
Phase 10 - client/backend drift guard.

The web dashboard and the Chrome extension each keep a hand-written TypeScript
mirror of the backend response models (no code generation in this repo). These
tests fail when a mirror's field names, enum values or profile limits stop
matching the Pydantic schemas, so a backend change cannot silently break a
client.
"""

import re
from pathlib import Path

import pytest
from annotated_types import MaxLen

from app.models.analysis import AnalysisStatus
from app.models.user import UserRole
from app.schemas import (
    AnalysisRequest,
    AnalysisResponse,
    CertificationItem,
    EducationItem,
    ExperienceItem,
    MarketSkillEntry,
    ProfileCreate,
    ProfileResponse,
    ProjectItem,
    SkillComparison,
    SkillItem,
    UserResponse,
    AIRecommendation,
    AIRoadmapItem,
)

REPO = Path(__file__).resolve().parents[2]
WEB_TYPES = REPO / "web" / "types" / "index.ts"
EXT_TYPES = REPO / "extension" / "src" / "types" / "api.ts"
EXT_LIMITS = REPO / "extension" / "src" / "api" / "profilePayload.ts"


# ─── tiny TypeScript interface reader ───

def read(path: Path) -> str:
    if not path.exists():
        pytest.skip(f"{path.relative_to(REPO)} not present in this checkout")
    return path.read_text(encoding="utf-8")


def interface_fields(source: str, name: str, _seen=None) -> set[str]:
    """Top-level property names of `export interface <name> [extends X] { ... }`."""
    match = re.search(rf"export interface {name}\b([^{{]*)\{{", source)
    assert match, f"interface {name} not found"
    fields: set[str] = set()

    parent = re.search(r"extends\s+(\w+)", match.group(1))
    if parent:
        fields |= interface_fields(source, parent.group(1))

    depth, i = 1, match.end()
    line_start = i
    while depth and i < len(source):
        ch = source[i]
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
        elif ch == "\n":
            line = source[line_start:i]
            if depth == 1:
                prop = re.match(r"\s*(?:readonly\s+)?(\w+)\??\s*:", line)
                if prop:
                    fields.add(prop.group(1))
            line_start = i + 1
        i += 1
    return fields


def union_literals(source: str, name: str) -> set[str]:
    match = re.search(rf"export type {name}\s*=\s*([^;]+);", source, re.S)
    assert match, f"type {name} not found"
    return set(re.findall(r"'([^']+)'", match.group(1)))


def required_fields(source: str, name: str) -> set[str]:
    """Property names declared WITHOUT a `?` (client promises they always exist)."""
    match = re.search(rf"export interface {name}\b[^{{]*\{{", source)
    assert match
    depth, i, line_start, required = 1, match.end(), match.end(), set()
    while depth and i < len(source):
        ch = source[i]
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
        elif ch == "\n":
            if depth == 1:
                prop = re.match(r"\s*(\w+)(\??)\s*:", source[line_start:i])
                if prop and not prop.group(2):
                    required.add(prop.group(1))
            line_start = i + 1
        i += 1
    return required


# (TypeScript interface, backend model, fields the client intentionally omits)
WEB_CASES = [
    ("User", UserResponse, {"access_token"}),  # dashboard session lives in the HTTP-only cookie
    ("Analysis", AnalysisResponse, set()),
    ("MarketSkill", MarketSkillEntry, set()),
    ("SkillComparison", SkillComparison, set()),
    ("AIRecommendation", AIRecommendation, set()),
    ("AIRoadmapItem", AIRoadmapItem, set()),
    ("Profile", ProfileResponse, set()),
    ("ProfileInput", ProfileCreate, set()),
    ("SkillItem", SkillItem, set()),
    ("ExperienceItem", ExperienceItem, set()),
    ("EducationItem", EducationItem, set()),
    ("CertificationItem", CertificationItem, set()),
    ("ProjectItem", ProjectItem, set()),
    ("AnalysisRequest", AnalysisRequest, set()),
]

EXT_CASES = [
    ("User", UserResponse, set()),
    ("Analysis", AnalysisResponse, set()),
    ("MarketSkill", MarketSkillEntry, set()),
    ("SkillComparison", SkillComparison, set()),
    ("AIRecommendation", AIRecommendation, set()),
    ("AIRoadmapItem", AIRoadmapItem, set()),
    ("ApiProfile", ProfileResponse, set()),
    ("ProfileInput", ProfileCreate, set()),
    ("SkillItem", SkillItem, set()),
    ("ExperienceItem", ExperienceItem, set()),
    ("EducationItem", EducationItem, set()),
    ("CertificationItem", CertificationItem, set()),
    ("ProjectItem", ProjectItem, set()),
    ("AnalysisRequest", AnalysisRequest, set()),
]


@pytest.mark.parametrize("ts_name,model,omitted", WEB_CASES, ids=[c[0] for c in WEB_CASES])
def test_web_types_match_backend_fields(ts_name, model, omitted):
    ts = interface_fields(read(WEB_TYPES), ts_name)
    assert ts == set(model.model_fields) - omitted


@pytest.mark.parametrize("ts_name,model,omitted", EXT_CASES, ids=[c[0] for c in EXT_CASES])
def test_extension_types_match_backend_fields(ts_name, model, omitted):
    ts = interface_fields(read(EXT_TYPES), ts_name)
    assert ts == set(model.model_fields) - omitted


@pytest.mark.parametrize("path", [WEB_TYPES, EXT_TYPES], ids=["web", "extension"])
def test_enum_unions_match_backend(path):
    source = read(path)
    assert union_literals(source, "AnalysisStatus") == {s.value for s in AnalysisStatus}
    assert union_literals(source, "UserRole") == {r.value for r in UserRole}


@pytest.mark.parametrize(
    "path,interface", [(WEB_TYPES, "Analysis"), (EXT_TYPES, "Analysis")], ids=["web", "extension"]
)
def test_clients_never_declare_a_field_optional_that_the_backend_always_sends(path, interface):
    """Backend sends every Analysis field (nullable, never absent), so none may be `?:`."""
    assert required_fields(read(path), interface) == set(AnalysisResponse.model_fields)


@pytest.mark.parametrize("path", [WEB_TYPES, EXT_TYPES], ids=["web", "extension"])
def test_clients_do_not_model_a_client_side_score(path):
    """The deterministic score comes from the backend; clients only display it."""
    source = read(path)
    assert "overall_alignment_score: number | null" in source
    assert "skill_alignment: number | null" in source


# ─── extension profile limits mirror ProfileCreate ───

def _max_len(model, field) -> int:
    for meta in model.model_fields[field].metadata:
        if isinstance(meta, MaxLen):
            return meta.max_length
    raise AssertionError(f"{model.__name__}.{field} has no max_length")


def _list_max(model, field) -> int:
    return _max_len(model, field)


BACKEND_LIMITS = {
    "name": (ProfileCreate, "name"),
    "headline": (ProfileCreate, "headline"),
    "about": (ProfileCreate, "about"),
    "location": (ProfileCreate, "location"),
    "profile_url": (ProfileCreate, "profile_url"),
    "source": (ProfileCreate, "source"),
    "skills": (ProfileCreate, "skills"),
    "experience": (ProfileCreate, "experience"),
    "education": (ProfileCreate, "education"),
    "certifications": (ProfileCreate, "certifications"),
    "projects": (ProfileCreate, "projects"),
    "skill_name": (SkillItem, "name"),
    "experience_title": (ExperienceItem, "title"),
    "experience_company": (ExperienceItem, "company"),
    "experience_location": (ExperienceItem, "location"),
    "experience_date": (ExperienceItem, "start_date"),
    "experience_description": (ExperienceItem, "description"),
    "education_institution": (EducationItem, "institution"),
    "education_degree": (EducationItem, "degree"),
    "education_field": (EducationItem, "field_of_study"),
    "education_date": (EducationItem, "start_date"),
    "certification_name": (CertificationItem, "name"),
    "certification_issuer": (CertificationItem, "issuer"),
    "certification_date": (CertificationItem, "date"),
    "project_name": (ProjectItem, "name"),
    "project_description": (ProjectItem, "description"),
    "project_url": (ProjectItem, "url"),
}


def test_extension_profile_limits_match_backend_schema():
    source = read(EXT_LIMITS)
    block = re.search(r"PROFILE_LIMITS\s*=\s*\{(.*?)\}\s*as const", source, re.S)
    assert block, "PROFILE_LIMITS not found"
    ts_limits = {k: int(v) for k, v in re.findall(r"(\w+):\s*(\d+)", block.group(1))}

    assert set(ts_limits) == set(BACKEND_LIMITS), "limit keys differ from the documented map"
    for key, (model, field) in BACKEND_LIMITS.items():
        assert ts_limits[key] == _max_len(model, field), f"{key}: extension vs {model.__name__}.{field}"


# ─── no hardcoded backend URLs or secrets in client source ───

def _client_sources():
    for root, suffixes in (
        (REPO / "web", {".ts", ".tsx", ".mjs"}),
        (REPO / "extension" / "src", {".ts", ".tsx"}),
    ):
        if not root.exists():
            continue
        for path in root.rglob("*"):
            if path.suffix in suffixes and not any(
                part in {"node_modules", ".next", "dist"} for part in path.parts
            ):
                yield path


def test_clients_only_hardcode_localhost_in_their_config_modules():
    allowed = {
        REPO / "web" / "lib" / "api.ts",                        # dev fallback when NEXT_PUBLIC_API_URL is unset
        REPO / "extension" / "src" / "api" / "config.ts",      # dev fallbacks for VITE_API_URL / VITE_WEB_URL
    }
    offenders = [
        str(p.relative_to(REPO))
        for p in _client_sources()
        if p not in allowed and re.search(r"https?://(localhost|127\.0\.0\.1)", p.read_text(encoding="utf-8"))
    ]
    assert not offenders, f"hardcoded backend URLs outside config modules: {offenders}"


def test_clients_never_reference_provider_keys_or_providers():
    pattern = re.compile(
        r"SERPAPI_API_KEY|serpapi\.com|api\.openai\.com|api\.anthropic\.com|generativelanguage|api\.x\.ai|"
        r"GROK_API_KEY|OPENAI_API_KEY|GEMINI_API_KEY|ANTHROPIC_API_KEY|JWT_SECRET",
        re.IGNORECASE,
    )
    # Prose such as "via SerpApi" in UI copy is fine; provider URLs and key names are not.
    # Comments that explain what must NOT be used are skipped.
    offenders = []
    for path in _client_sources():
        for number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
            stripped = line.strip()
            if stripped.startswith(("//", "*", "/*")):
                continue
            if pattern.search(line):
                offenders.append(f"{path.relative_to(REPO)}:{number}")
    assert not offenders, offenders


def test_no_secret_named_public_env_vars():
    for path in list((REPO / "web").glob(".env*")) + list((REPO / "extension").glob(".env*")):
        for line in path.read_text(encoding="utf-8").splitlines():
            if line.strip().startswith("#") or "=" not in line:
                continue
            key = line.split("=", 1)[0].strip()
            assert not re.search(r"KEY|SECRET|TOKEN|PASSWORD", key, re.I), f"{path.name}: {key}"
            assert key.startswith(("NEXT_PUBLIC_", "VITE_")), f"{path.name}: {key}"
