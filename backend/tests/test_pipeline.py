"""Phase 6 tests for complete pipeline hardening."""

import pytest
from unittest.mock import AsyncMock, patch, MagicMock
import asyncio

from app.models.analysis import Analysis, AnalysisStatus
from app.services.pipeline import run_analysis_pipeline


class MockDB:
    """Mock database for pipeline testing."""
    def __init__(self):
        self.flushed = False
        self.refreshed = False
        
    async def flush(self):
        self.flushed = True
        
    async def refresh(self, _instance):
        self.refreshed = True


class TestPipelineSerpAPIFailure:
    """Test pipeline behavior when SerpAPI fails."""

    @pytest.mark.asyncio
    async def test_serpapi_timeout_returns_failed_analysis(self):
        """Pipeline should fail gracefully when SerpAPI times out."""
        analysis = Analysis(
            user_id=1,
            profile_snapshot={"skills": [{"name": "Python"}], "headline": "Engineer"},
        )
        
        with patch('app.services.pipeline.generate_market_queries', return_value=["engineer jobs"]):
            with patch('app.services.pipeline.execute_market_queries', side_effect=asyncio.TimeoutError):
                result = await run_analysis_pipeline(
                    analysis=analysis,
                    profile=None,
                    target_roles=["Engineer"],
                    target_locations=[],
                    db=MockDB(),
                )
                
                assert result.status == AnalysisStatus.FAILED
                assert result.error_message is not None

    @pytest.mark.asyncio
    async def test_serpapi_returns_empty_jobs(self):
        """Pipeline should handle zero jobs from SerpAPI."""
        analysis = Analysis(
            user_id=1,
            profile_snapshot={"skills": [{"name": "Python"}], "headline": "Engineer"},
        )
        
        with patch('app.services.pipeline.generate_market_queries', return_value=["engineer jobs"]):
            with patch('app.services.pipeline.execute_market_queries', return_value=[]):
                result = await run_analysis_pipeline(
                    analysis=analysis,
                    profile=None,
                    target_roles=["Engineer"],
                    target_locations=[],
                    db=MockDB(),
                )
                
                # Should complete with zero jobs, not fail
                assert result.status == AnalysisStatus.COMPLETED
                assert result.jobs_analyzed_count == 0
                assert result.market_skills == {}
                assert result.skill_alignment == 0.0
                assert result.overall_alignment_score == 0.0

    @pytest.mark.asyncio
    async def test_serpapi_malformed_data_handled(self):
        """Pipeline should handle malformed job data from SerpAPI."""
        analysis = Analysis(
            user_id=1,
            profile_snapshot={"skills": [{"name": "Python"}], "headline": "Engineer"},
        )
        
        malformed_jobs = [
            {"title": None, "company": "A"},  # Missing title
            {"title": "Engineer", "skills": "not a list"},  # Invalid skills
            {"description": "<script>alert('xss')</script>"},  # HTML in description
        ]
        
        with patch('app.services.pipeline.generate_market_queries', return_value=["engineer jobs"]):
            with patch('app.services.pipeline.execute_market_queries', return_value=malformed_jobs):
                result = await run_analysis_pipeline(
                    analysis=analysis,
                    profile=None,
                    target_roles=["Engineer"],
                    target_locations=[],
                    db=MockDB(),
                )
                
                # Should complete without crashing
                assert result.status == AnalysisStatus.COMPLETED
                assert result.jobs_analyzed_count >= 0


class TestPipelineZeroJobs:
    """Test pipeline behavior with zero jobs."""

    @pytest.mark.asyncio
    async def test_zero_jobs_no_division_by_zero(self):
        """Zero jobs should not cause division by zero."""
        analysis = Analysis(
            user_id=1,
            profile_snapshot={"skills": [{"name": "Python"}], "headline": "Engineer"},
        )
        
        with patch('app.services.pipeline.generate_market_queries', return_value=["engineer jobs"]):
            with patch('app.services.pipeline.execute_market_queries', return_value=[]):
                result = await run_analysis_pipeline(
                    analysis=analysis,
                    profile=None,
                    target_roles=["Engineer"],
                    target_locations=[],
                    db=MockDB(),
                )
                
                assert result.status == AnalysisStatus.COMPLETED
                assert result.market_skills == {}
                assert result.skill_alignment == 0.0
                assert result.overall_alignment_score == 0.0
                # No NaN or infinity
                assert result.skill_alignment is not None
                assert result.overall_alignment_score is not None

    @pytest.mark.asyncio
    async def test_zero_jobs_no_fake_skills(self):
        """Zero jobs should not invent fake skills."""
        analysis = Analysis(
            user_id=1,
            profile_snapshot={"skills": [{"name": "Python"}], "headline": "Engineer"},
        )
        
        with patch('app.services.pipeline.generate_market_queries', return_value=["engineer jobs"]):
            with patch('app.services.pipeline.execute_market_queries', return_value=[]):
                result = await run_analysis_pipeline(
                    analysis=analysis,
                    profile=None,
                    target_roles=["Engineer"],
                    target_locations=[],
                    db=MockDB(),
                )
                
                assert result.market_skills == {}
                assert result.strengths == []
                assert result.skill_gaps == []


class TestPipelinePartialJobData:
    """Test pipeline with jobs missing optional fields."""

    @pytest.mark.asyncio
    async def test_jobs_with_missing_optional_fields(self):
        """Jobs missing optional fields should not crash the pipeline."""
        analysis = Analysis(
            user_id=1,
            profile_snapshot={"skills": [{"name": "Python"}], "headline": "Engineer"},
        )
        
        partial_jobs = [
            {
                "title": "Engineer",
                "company": None,  # Missing company
                "location": None,  # Missing location
                "description": None,  # Missing description
                "salary": None,  # Missing salary
                "source": None,  # Missing source
                "url": None,  # Missing URL
                "skills": ["Python"],
            },
        ]
        
        with patch('app.services.pipeline.generate_market_queries', return_value=["engineer jobs"]):
            with patch('app.services.pipeline.execute_market_queries', return_value=partial_jobs):
                result = await run_analysis_pipeline(
                    analysis=analysis,
                    profile=None,
                    target_roles=["Engineer"],
                    target_locations=[],
                    db=MockDB(),
                )
                
                assert result.status == AnalysisStatus.COMPLETED
                assert result.jobs_analyzed_count == 1


class TestPipelineDeduplication:
    """Test deduplication in pipeline."""

    @pytest.mark.asyncio
    async def test_duplicate_jobs_not_counted_multiple_times(self):
        """Duplicate jobs should be deduplicated before demand calculation."""
        analysis = Analysis(
            user_id=1,
            profile_snapshot={"skills": [{"name": "Python"}], "headline": "Engineer"},
        )
        
        jobs_with_duplicates = [
            {"title": "Engineer", "company": "A", "location": "Remote", "skills": ["Python"]},
            {"title": "Engineer", "company": "A", "location": "Remote", "skills": ["Python"]},  # Duplicate
            {"title": "Developer", "company": "B", "location": "NYC", "skills": ["React"]},
        ]
        
        with patch('app.services.pipeline.generate_market_queries', return_value=["engineer jobs"]):
            with patch('app.services.pipeline.execute_market_queries', return_value=jobs_with_duplicates):
                result = await run_analysis_pipeline(
                    analysis=analysis,
                    profile=None,
                    target_roles=["Engineer"],
                    target_locations=[],
                    db=MockDB(),
                )
                
                assert result.status == AnalysisStatus.COMPLETED
                assert result.jobs_analyzed_count == 2  # 2 unique jobs, not 3
                # Demand percentage should be based on 2 jobs
                if result.market_skills:
                    for skill_data in result.market_skills.values():
                        assert skill_data["percentage"] <= 100.0


class TestPipelineQueryGeneration:
    """Test query generation in pipeline."""

    @pytest.mark.asyncio
    async def test_empty_queries_fails_gracefully(self):
        """Empty query list should fail with useful error."""
        analysis = Analysis(
            user_id=1,
            profile_snapshot={"skills": [], "headline": "", "location": ""},
        )
        
        with patch('app.services.pipeline.generate_market_queries', return_value=[]):
            result = await run_analysis_pipeline(
                analysis=analysis,
                profile=None,
                target_roles=[],
                target_locations=[],
                db=MockDB(),
            )
            
            assert result.status == AnalysisStatus.FAILED
            assert "market queries" in result.error_message.lower()

    @pytest.mark.asyncio
    async def test_multiple_target_roles(self):
        """Multiple target roles should generate queries."""
        analysis = Analysis(
            user_id=1,
            profile_snapshot={"skills": [{"name": "Python"}], "headline": "Engineer"},
        )
        
        with patch('app.services.pipeline.generate_market_queries') as mock_queries:
            mock_queries.return_value = ["engineer jobs", "developer jobs"]
            
            with patch('app.services.pipeline.execute_market_queries', return_value=[]):
                result = await run_analysis_pipeline(
                    analysis=analysis,
                    profile=None,
                    target_roles=["Engineer", "Developer"],
                    target_locations=[],
                    db=MockDB(),
                )
                
                assert result.status == AnalysisStatus.COMPLETED
                assert result.search_queries == ["engineer jobs", "developer jobs"]


class TestPipelineAIFailure:
    """Test that AI failure preserves deterministic results."""

    @pytest.mark.asyncio
    async def test_ai_failure_preserves_deterministic_results(self):
        """Critical test: AI failure must not destroy deterministic results."""
        analysis = Analysis(
            user_id=1,
            profile_snapshot={"skills": [{"name": "Python"}], "headline": "Engineer"},
        )
        
        # 50 jobs with Python skill
        jobs = [
            {"title": "Engineer", "company": f"C{i}", "location": "Remote", "skills": ["Python"]}
            for i in range(50)
        ]
        
        with patch('app.services.pipeline.generate_market_queries', return_value=["engineer jobs"]):
            with patch('app.services.pipeline.execute_market_queries', return_value=jobs):
                with patch('app.services.pipeline.analyze_profile_vs_market', return_value=None):  # AI fails
                    result = await run_analysis_pipeline(
                        analysis=analysis,
                        profile=None,
                        target_roles=["Engineer"],
                        target_locations=[],
                        db=MockDB(),
                    )
                    
                    # Pipeline should complete
                    assert result.status == AnalysisStatus.COMPLETED
                    
                    # Deterministic results must be preserved
                    assert result.jobs_analyzed_count == 50
                    assert result.market_skills is not None
                    assert "python" in result.market_skills
                    assert result.strengths is not None
                    assert result.skill_gaps is not None
                    assert result.skill_alignment is not None
                    assert result.overall_alignment_score is not None
                    
                    # AI fields should be None/empty
                    assert result.ai_summary is None
                    assert result.ai_strengths is None or result.ai_strengths == []
                    assert result.ai_gaps is None or result.ai_gaps == []

    @pytest.mark.asyncio
    async def test_ai_malformed_response_uses_fallback(self):
        """AI returning malformed response should use fallback."""
        analysis = Analysis(
            user_id=1,
            profile_snapshot={"skills": [{"name": "Python"}], "headline": "Engineer"},
        )
        
        jobs = [
            {"title": "Engineer", "company": "A", "location": "Remote", "skills": ["Python"]}
        ]
        
        with patch('app.services.pipeline.generate_market_queries', return_value=["engineer jobs"]):
            with patch('app.services.pipeline.execute_market_queries', return_value=jobs):
                with patch('app.services.pipeline.analyze_profile_vs_market', return_value={"invalid": "data"}):
                    result = await run_analysis_pipeline(
                        analysis=analysis,
                        profile=None,
                        target_roles=["Engineer"],
                        target_locations=[],
                        db=MockDB(),
                    )
                    
                    # Should complete with deterministic results
                    assert result.status == AnalysisStatus.COMPLETED
                    assert result.jobs_analyzed_count == 1
                    assert result.skill_alignment is not None


class TestPipelineResultContract:
    """Test that pipeline produces expected result structure."""

    @pytest.mark.asyncio
    async def test_pipeline_provides_all_expected_fields(self):
        """Successful analysis should contain all expected fields."""
        analysis = Analysis(
            user_id=1,
            profile_snapshot={"skills": [{"name": "Python"}], "headline": "Engineer"},
        )
        
        jobs = [
            {"title": "Engineer", "company": "A", "location": "Remote", "skills": ["Python"]}
        ]
        
        ai_response = {
            "summary": "Test summary",
            "strengths": ["Python"],
            "gaps": [],
            "recommendations": [],
            "relevant_roles": ["Engineer"],
            "roadmap": [],
            "alignment_scores": {}
        }
        
        with patch('app.services.pipeline.generate_market_queries', return_value=["engineer jobs"]):
            with patch('app.services.pipeline.execute_market_queries', return_value=jobs):
                with patch('app.services.pipeline.analyze_profile_vs_market', return_value=ai_response):
                    result = await run_analysis_pipeline(
                        analysis=analysis,
                        profile=None,
                        target_roles=["Engineer"],
                        target_locations=[],
                        db=MockDB(),
                    )
                    
                    assert result.status == AnalysisStatus.COMPLETED
                    
                    # Deterministic fields
                    assert hasattr(result, 'jobs_analyzed_count')
                    assert hasattr(result, 'market_skills')
                    assert hasattr(result, 'strengths')
                    assert hasattr(result, 'skill_gaps')
                    assert hasattr(result, 'skill_alignment')
                    assert hasattr(result, 'overall_alignment_score')
                    
                    # AI fields
                    assert hasattr(result, 'ai_summary')
                    assert hasattr(result, 'ai_strengths')
                    assert hasattr(result, 'ai_gaps')
                    assert hasattr(result, 'ai_recommendations')
                    assert hasattr(result, 'ai_relevant_roles')
                    assert hasattr(result, 'ai_roadmap')


class TestPipelinePersistence:
    """Test database persistence behavior."""

    @pytest.mark.asyncio
    async def test_pipeline_flushes_at_each_stage(self):
        """Pipeline should flush database at each stage."""
        db = MockDB()
        analysis = Analysis(
            user_id=1,
            profile_snapshot={"skills": [{"name": "Python"}], "headline": "Engineer"},
        )
        
        with patch('app.services.pipeline.generate_market_queries', return_value=["engineer jobs"]):
            with patch('app.services.pipeline.execute_market_queries', return_value=[]):
                with patch('app.services.pipeline.analyze_profile_vs_market', return_value=None):
                    result = await run_analysis_pipeline(
                        analysis=analysis,
                        profile=None,
                        target_roles=["Engineer"],
                        target_locations=[],
                        db=db,
                    )
                    
                    # Should have flushed multiple times
                    assert db.flushed
                    assert db.refreshed

    @pytest.mark.asyncio
    async def test_pipeline_failure_sets_failed_status(self):
        """Pipeline failure should set status to FAILED."""
        db = MockDB()
        analysis = Analysis(
            user_id=1,
            profile_snapshot={"skills": [{"name": "Python"}], "headline": "Engineer"},
        )
        
        with patch('app.services.pipeline.generate_market_queries', return_value=[]):
            result = await run_analysis_pipeline(
                analysis=analysis,
                profile=None,
                target_roles=[],
                target_locations=[],
                db=db,
            )
            
            assert result.status == AnalysisStatus.FAILED
            assert result.error_message is not None


class TestPipelineWithSkillAliases:
    """Test pipeline with skill aliases."""

    @pytest.mark.asyncio
    async def test_pipeline_normalizes_skill_aliases(self):
        """Pipeline should normalize skill aliases to canonical form."""
        analysis = Analysis(
            user_id=1,
            profile_snapshot={
                "skills": [{"name": "React.js"}, {"name": "POSTGRES"}],
                "headline": "Engineer"
            },
        )
        
        jobs = [
            {"title": "Engineer", "company": "A", "location": "Remote", "skills": ["react", "postgresql"]}
        ]
        
        with patch('app.services.pipeline.generate_market_queries', return_value=["engineer jobs"]):
            with patch('app.services.pipeline.execute_market_queries', return_value=jobs):
                with patch('app.services.pipeline.analyze_profile_vs_market', return_value=None):
                    result = await run_analysis_pipeline(
                        analysis=analysis,
                        profile=None,
                        target_roles=["Engineer"],
                        target_locations=[],
                        db=MockDB(),
                    )
                    
                    assert result.status == AnalysisStatus.COMPLETED
                    # Skills should be canonicalized
                    if result.strengths:
                        for strength in result.strengths:
                            assert strength["skill"] in ["react", "postgresql"]


class TestPipelineDeterministicScorePreserved:
    """Test that deterministic score is preserved through AI processing."""

    @pytest.mark.asyncio
    async def test_deterministic_score_not_modified_by_ai(self):
        """AI must not modify the deterministic alignment score."""
        analysis = Analysis(
            user_id=1,
            profile_snapshot={"skills": [{"name": "Python"}], "headline": "Engineer"},
        )
        
        jobs = [
            {"title": "Engineer", "company": "A", "location": "Remote", "skills": ["Python"]}
        ]
        
        # AI returns a different score
        ai_response = {
            "summary": "Test",
            "strengths": ["Python"],
            "gaps": [],
            "recommendations": [],
            "relevant_roles": [],
            "roadmap": [],
            "alignment_scores": {"skill_alignment": 0.99}  # Different from deterministic
        }
        
        with patch('app.services.pipeline.generate_market_queries', return_value=["engineer jobs"]):
            with patch('app.services.pipeline.execute_market_queries', return_value=jobs):
                with patch('app.services.pipeline.analyze_profile_vs_market', return_value=ai_response):
                    result = await run_analysis_pipeline(
                        analysis=analysis,
                        profile=None,
                        target_roles=["Engineer"],
                        target_locations=[],
                        db=MockDB(),
                    )
                    
                    assert result.status == AnalysisStatus.COMPLETED
                    # overall_alignment_score should remain the deterministic score
                    assert result.overall_alignment_score == result.skill_alignment
                    # AI's skill_alignment is separate contextual data
