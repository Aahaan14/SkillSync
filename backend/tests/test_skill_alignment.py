"""Phase 4 tests for canonical market-skill alignment."""

import pytest

from app.models.analysis import Analysis, AnalysisStatus
from app.services.market.demand import calculate_alignment_score, compare_user_vs_market
from app.services.market.skills import calculate_skill_percentages, extract_market_skills
from app.services.processing.normalize import normalize_profile_skills
from app.services.serpapi.jobs import canonicalize_skill


def test_canonicalization_handles_exact_alias_case_and_punctuation():
    assert canonicalize_skill("python") == "python"
    assert canonicalize_skill("React.js") == "react"
    assert canonicalize_skill("POSTGRES") == "postgresql"
    assert normalize_profile_skills(["React.js", "react", "Postgres"]) == [
        "react", "postgresql"
    ]


def test_market_demand_counts_a_skill_once_per_unique_job():
    jobs = [
        {"skills": ["React.js", "react", "Python"]},
        {"skills": ["react", "Postgres"]},
        {"skills": []},
        {"description": None},
    ]
    demand = calculate_skill_percentages(extract_market_skills(jobs), total_jobs=4)

    assert demand["react"]["jobs_requiring"] == 2
    assert demand["react"]["percentage"] == 50.0
    assert demand["python"]["percentage"] == 25.0
    assert demand["postgresql"]["display_name"] == "PostgreSQL"
    assert calculate_skill_percentages({}, total_jobs=0) == {}


def test_missing_skills_are_canonical_and_ranked_by_actual_demand():
    market = calculate_skill_percentages(
        {"react": 4, "python": 3, "postgresql": 1}, total_jobs=4
    )
    strengths, gaps = compare_user_vs_market(["React.js", "PYTHON"], market)

    assert [entry["skill"] for entry in strengths] == ["react", "python"]
    assert [entry["skill"] for entry in gaps] == ["postgresql"]
    assert gaps[0]["jobs_requiring"] == 1
    assert gaps[0]["demand_percentage"] == 25.0
    assert gaps[0]["priority_rank"] == 1


def test_alignment_edge_cases_and_weighted_partial_alignment():
    assert calculate_alignment_score([], [], total_market_skills=0) == 0.0
    assert calculate_alignment_score([], [{"market_percentage": 100}], 1) == 0.0
    assert calculate_alignment_score([{"market_percentage": 100}], [], 1) == 100.0
    assert calculate_alignment_score(
        [{"market_percentage": 75}], [{"market_percentage": 25}], 2
    ) == 75.0


class _PipelineDB:
    async def flush(self):
        pass

    async def refresh(self, _instance):
        pass


@pytest.mark.asyncio
async def test_pipeline_persists_canonical_alignment_with_mocked_external_services(monkeypatch):
    """Only SerpApi and AI are mocked; normalization and demand run for real."""
    from app.services import pipeline

    async def fake_search(**_kwargs):
        return [
            {"title": "Engineer", "company": "A", "location": "Remote", "skills": ["React.js", "Python"]},
            {"title": "Developer", "company": "B", "location": "Remote", "skills": ["react", "Postgres"]},
            # The duplicate listing must not inflate demand.
            {"title": "Engineer", "company": "A", "location": "Remote", "skills": ["React", "Python"]},
        ]

    async def fake_ai(**_kwargs):
        return {"alignment_scores": {"role_alignment": 0.2}}

    monkeypatch.setattr(pipeline, "generate_market_queries", lambda **_kwargs: ["engineer jobs"])
    monkeypatch.setattr(pipeline, "execute_market_queries", fake_search)
    monkeypatch.setattr(pipeline, "analyze_profile_vs_market", fake_ai)

    analysis = Analysis(
        user_id=1,
        profile_snapshot={"skills": [{"name": "React.js"}], "headline": "Engineer"},
    )
    result = await pipeline.run_analysis_pipeline(
        analysis=analysis,
        profile=None,
        target_roles=["Engineer"],
        target_locations=[],
        db=_PipelineDB(),
    )

    assert result.status == AnalysisStatus.COMPLETED
    assert result.jobs_analyzed_count == 2
    assert result.market_skills["react"]["percentage"] == 100.0
    assert [gap["skill"] for gap in result.skill_gaps] == ["postgresql", "python"]
    assert result.skill_alignment == 50.0
    assert result.overall_alignment_score == 50.0
    assert result.role_alignment == 20.0
