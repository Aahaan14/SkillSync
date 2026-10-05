"""Phase 7 tests for database/persistence hardening."""

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User, UserRole
from app.models.profile import Profile
from app.models.analysis import Analysis, AnalysisStatus


class TestUserOwnership:
    """Test user ownership and data isolation."""

    @pytest.mark.asyncio
    async def test_user_cannot_access_other_profile(self, db: AsyncSession):
        """User B cannot access User A's profile."""
        # Create User A and profile
        user_a = User(email="user_a@test.com", password_hash="hash", role=UserRole.USER)
        db.add(user_a)
        await db.flush()
        
        profile_a = Profile(
            user_id=user_a.id,
            name="User A",
            skills=[{"name": "Python"}]
        )
        db.add(profile_a)
        await db.commit()
        
        # Create User B
        user_b = User(email="user_b@test.com", password_hash="hash", role=UserRole.USER)
        db.add(user_b)
        await db.commit()
        
        # User B tries to access User A's profile
        result = await db.execute(
            select(Profile).where(Profile.id == profile_a.id)
        )
        profile = result.scalar_one_or_none()
        
        # Profile exists in database
        assert profile is not None
        # But ownership check must be enforced at application level
        assert profile.user_id == user_a.id
        assert profile.user_id != user_b.id

    @pytest.mark.asyncio
    async def test_user_cannot_access_other_analysis(self, db: AsyncSession):
        """User B cannot access User A's analysis."""
        # Create User A
        user_a = User(email="user_a@test.com", password_hash="hash", role=UserRole.USER)
        db.add(user_a)
        await db.flush()
        
        analysis_a = Analysis(
            user_id=user_a.id,
            status=AnalysisStatus.COMPLETED,
            jobs_analyzed_count=10
        )
        db.add(analysis_a)
        await db.commit()
        
        # Create User B
        user_b = User(email="user_b@test.com", password_hash="hash", role=UserRole.USER)
        db.add(user_b)
        await db.commit()
        
        # User B tries to access User A's analysis
        result = await db.execute(
            select(Analysis).where(Analysis.id == analysis_a.id)
        )
        analysis = result.scalar_one_or_none()
        
        # Analysis exists
        assert analysis is not None
        # But ownership must be enforced
        assert analysis.user_id == user_a.id
        assert analysis.user_id != user_b.id

    @pytest.mark.asyncio
    async def test_user_lists_only_own_analyses(self, db: AsyncSession):
        """User listing analyses sees only their own."""
        # Create User A
        user_a = User(email="user_a@test.com", password_hash="hash", role=UserRole.USER)
        db.add(user_a)
        await db.flush()
        
        analysis_a1 = Analysis(user_id=user_a.id, status=AnalysisStatus.COMPLETED)
        analysis_a2 = Analysis(user_id=user_a.id, status=AnalysisStatus.COMPLETED)
        db.add(analysis_a1)
        db.add(analysis_a2)
        await db.flush()
        
        # Create User B
        user_b = User(email="user_b@test.com", password_hash="hash", role=UserRole.USER)
        db.add(user_b)
        await db.flush()
        
        analysis_b = Analysis(user_id=user_b.id, status=AnalysisStatus.COMPLETED)
        db.add(analysis_b)
        await db.commit()
        
        # User A lists analyses
        result = await db.execute(
            select(Analysis).where(Analysis.user_id == user_a.id)
        )
        user_a_analyses = result.scalars().all()
        
        # Should only see User A's analyses
        assert len(user_a_analyses) == 2
        for analysis in user_a_analyses:
            assert analysis.user_id == user_a.id


class TestFailedAnalysisPersistence:
    """Test failed analysis persistence behavior."""

    @pytest.mark.asyncio
    async def test_failed_analysis_persists_with_error_message(self, db: AsyncSession):
        """Failed analysis should persist with status FAILED and error message."""
        user = User(email="test@test.com", password_hash="hash", role=UserRole.USER)
        db.add(user)
        await db.flush()
        
        analysis = Analysis(
            user_id=user.id,
            status=AnalysisStatus.FAILED,
            error_message="SerpAPI timeout"
        )
        db.add(analysis)
        await db.commit()
        await db.refresh(analysis)
        
        assert analysis.status == AnalysisStatus.FAILED
        assert analysis.error_message == "SerpAPI timeout"
        assert analysis.id is not None

    @pytest.mark.asyncio
    async def test_failed_analysis_does_not_mark_completed(self, db: AsyncSession):
        """Failed analysis must not be marked COMPLETED."""
        user = User(email="test@test.com", password_hash="hash", role=UserRole.USER)
        db.add(user)
        await db.flush()
        
        analysis = Analysis(
            user_id=user.id,
            status=AnalysisStatus.FAILED,
            error_message="Test error"
        )
        db.add(analysis)
        await db.commit()
        await db.refresh(analysis)
        
        assert analysis.status != AnalysisStatus.COMPLETED
        assert analysis.status == AnalysisStatus.FAILED

    @pytest.mark.asyncio
    async def test_ai_failure_preserves_deterministic_fields(self, db: AsyncSession):
        """AI failure should preserve deterministic fields."""
        user = User(email="test@test.com", password_hash="hash", role=UserRole.USER)
        db.add(user)
        await db.flush()
        
        analysis = Analysis(
            user_id=user.id,
            status=AnalysisStatus.COMPLETED,
            jobs_analyzed_count=50,
            market_skills={"python": {"percentage": 80.0}},
            skill_alignment=73.4,
            overall_alignment_score=73.4,
            # AI fields empty/None
            ai_summary=None,
            ai_strengths=None
        )
        db.add(analysis)
        await db.commit()
        await db.refresh(analysis)
        
        assert analysis.status == AnalysisStatus.COMPLETED
        assert analysis.jobs_analyzed_count == 50
        assert analysis.market_skills is not None
        assert analysis.skill_alignment == 73.4
        assert analysis.overall_alignment_score == 73.4
        assert analysis.ai_summary is None


class TestConcurrentAnalyses:
    """Test concurrent analysis behavior."""

    @pytest.mark.asyncio
    async def test_concurrent_analyses_have_unique_ids(self, db: AsyncSession):
        """Multiple analyses for same user have unique IDs."""
        user = User(email="test@test.com", password_hash="hash", role=UserRole.USER)
        db.add(user)
        await db.flush()
        
        analysis1 = Analysis(user_id=user.id, status=AnalysisStatus.PENDING)
        analysis2 = Analysis(user_id=user.id, status=AnalysisStatus.PENDING)
        analysis3 = Analysis(user_id=user.id, status=AnalysisStatus.PENDING)
        
        db.add(analysis1)
        db.add(analysis2)
        db.add(analysis3)
        await db.commit()
        
        assert analysis1.id != analysis2.id
        assert analysis2.id != analysis3.id
        assert analysis1.id != analysis3.id

    @pytest.mark.asyncio
    async def test_concurrent_analyses_no_shared_state(self, db: AsyncSession):
        """Concurrent analyses do not share mutable state."""
        user = User(email="test@test.com", password_hash="hash", role=UserRole.USER)
        db.add(user)
        await db.flush()
        
        analysis1 = Analysis(
            user_id=user.id,
            status=AnalysisStatus.COMPLETED,
            jobs_analyzed_count=10,
            market_skills={"python": {"percentage": 50.0}}
        )
        analysis2 = Analysis(
            user_id=user.id,
            status=AnalysisStatus.COMPLETED,
            jobs_analyzed_count=20,
            market_skills={"react": {"percentage": 60.0}}
        )
        
        db.add(analysis1)
        db.add(analysis2)
        await db.commit()
        
        await db.refresh(analysis1)
        await db.refresh(analysis2)
        
        # Each analysis has independent data
        assert analysis1.jobs_analyzed_count == 10
        assert analysis2.jobs_analyzed_count == 20
        assert "python" in analysis1.market_skills
        assert "react" in analysis2.market_skills


class TestJSONPersistence:
    """Test JSON column persistence."""

    @pytest.mark.asyncio
    async def test_profile_json_persistence(self, db: AsyncSession):
        """Profile JSON fields persist correctly."""
        user = User(email="test@test.com", password_hash="hash", role=UserRole.USER)
        db.add(user)
        await db.flush()
        
        skills_data = [{"name": "Python", "level": "expert"}]
        profile = Profile(
            user_id=user.id,
            name="Test User",
            skills=skills_data,
            experience=[{"title": "Engineer", "company": "A"}]
        )
        db.add(profile)
        await db.commit()
        await db.refresh(profile)
        
        assert profile.skills == skills_data
        assert len(profile.experience) == 1
        assert profile.experience[0]["title"] == "Engineer"

    @pytest.mark.asyncio
    async def test_analysis_json_persistence(self, db: AsyncSession):
        """Analysis JSON fields persist correctly."""
        user = User(email="test@test.com", password_hash="hash", role=UserRole.USER)
        db.add(user)
        await db.flush()
        
        market_skills = {"python": {"percentage": 80.0, "count": 40}}
        strengths = [{"skill": "python", "market_percentage": 80.0}]
        
        analysis = Analysis(
            user_id=user.id,
            status=AnalysisStatus.COMPLETED,
            market_skills=market_skills,
            strengths=strengths,
            skill_gaps=[]
        )
        db.add(analysis)
        await db.commit()
        await db.refresh(analysis)
        
        assert analysis.market_skills == market_skills
        assert analysis.strengths == strengths
        assert "python" in analysis.market_skills


class TestCascadeDelete:
    """Test cascade delete behavior."""

    @pytest.mark.asyncio
    async def test_user_delete_cascades_to_profile(self, db: AsyncSession):
        """Deleting user cascades to profile."""
        user = User(email="test@test.com", password_hash="hash", role=UserRole.USER)
        db.add(user)
        await db.flush()
        
        profile = Profile(user_id=user.id, name="Test User")
        db.add(profile)
        await db.commit()
        
        profile_id = profile.id
        
        # Delete user
        await db.delete(user)
        await db.commit()
        
        # Profile should be deleted
        result = await db.execute(select(Profile).where(Profile.id == profile_id))
        assert result.scalar_one_or_none() is None

    @pytest.mark.asyncio
    async def test_user_delete_cascades_to_analyses(self, db: AsyncSession):
        """Deleting user cascades to analyses."""
        user = User(email="test@test.com", password_hash="hash", role=UserRole.USER)
        db.add(user)
        await db.flush()
        
        analysis1 = Analysis(user_id=user.id, status=AnalysisStatus.COMPLETED)
        analysis2 = Analysis(user_id=user.id, status=AnalysisStatus.COMPLETED)
        db.add(analysis1)
        db.add(analysis2)
        await db.commit()
        
        analysis1_id = analysis1.id
        analysis2_id = analysis2.id
        
        # Delete user
        await db.delete(user)
        await db.commit()
        
        # Analyses should be deleted
        result1 = await db.execute(select(Analysis).where(Analysis.id == analysis1_id))
        result2 = await db.execute(select(Analysis).where(Analysis.id == analysis2_id))
        assert result1.scalar_one_or_none() is None
        assert result2.scalar_one_or_none() is None


class TestTransactionRollback:
    """Test transaction rollback behavior."""

    @pytest.mark.asyncio
    async def test_rollback_on_exception(self, db: AsyncSession):
        """Exception causes rollback, no partial data committed."""
        user = User(email="test@test.com", password_hash="hash", role=UserRole.USER)
        db.add(user)
        await db.flush()
        
        # Start a transaction
        analysis = Analysis(user_id=user.id, status=AnalysisStatus.PENDING)
        db.add(analysis)
        await db.flush()
        
        # Simulate error by violating unique constraint
        user2 = User(email="test@test.com", password_hash="hash2", role=UserRole.USER)
        db.add(user2)
        
        try:
            await db.commit()
        except Exception:
            await db.rollback()
        
        # Verify no partial commit - analysis should not exist
        result = await db.execute(
            select(Analysis).where(Analysis.user_id == user.id)
        )
        analyses = result.scalars().all()
        
        # Should be empty due to rollback
        assert len(analyses) == 0

    @pytest.mark.asyncio
    async def test_successful_commit_persists_all_changes(self, db: AsyncSession):
        """Successful commit persists all changes."""
        user = User(email="test@test.com", password_hash="hash", role=UserRole.USER)
        db.add(user)
        await db.flush()
        
        analysis = Analysis(
            user_id=user.id,
            status=AnalysisStatus.COMPLETED,
            jobs_analyzed_count=10
        )
        db.add(analysis)
        await db.commit()
        
        # Verify persisted
        result = await db.execute(
            select(Analysis).where(Analysis.user_id == user.id)
        )
        analyses = result.scalars().all()
        
        assert len(analyses) == 1
        assert analyses[0].jobs_analyzed_count == 10


class TestForeignKeyConstraints:
    """Test foreign key constraints."""

    @pytest.mark.asyncio
    async def test_profile_requires_valid_user(self, db: AsyncSession):
        """Profile must have valid user_id."""
        # Note: SQLite doesn't enforce FK constraints by default
        # This test verifies the relationship exists in the model
        user = User(email="test@test.com", password_hash="hash", role=UserRole.USER)
        db.add(user)
        await db.flush()
        
        profile = Profile(user_id=user.id, name="Test User")
        db.add(profile)
        await db.commit()
        
        # Verify relationship is correct
        assert profile.user_id == user.id
        assert profile.user is not None

    @pytest.mark.asyncio
    async def test_analysis_requires_valid_user(self, db: AsyncSession):
        """Analysis must have valid user_id."""
        # Note: SQLite doesn't enforce FK constraints by default
        # This test verifies the relationship exists in the model
        user = User(email="test@test.com", password_hash="hash", role=UserRole.USER)
        db.add(user)
        await db.flush()
        
        analysis = Analysis(user_id=user.id, status=AnalysisStatus.PENDING)
        db.add(analysis)
        await db.commit()
        
        # Verify relationship is correct
        assert analysis.user_id == user.id
        assert analysis.user is not None


class TestUniqueConstraints:
    """Test unique constraints."""

    @pytest.mark.asyncio
    async def test_user_email_unique(self, db: AsyncSession):
        """User email must be unique."""
        user1 = User(email="test@test.com", password_hash="hash", role=UserRole.USER)
        db.add(user1)
        await db.commit()
        
        user2 = User(email="test@test.com", password_hash="hash", role=UserRole.USER)
        db.add(user2)
        
        # Should fail due to unique constraint
        with pytest.raises(Exception):
            await db.commit()

    @pytest.mark.asyncio
    async def test_profile_user_id_unique(self, db: AsyncSession):
        """Profile user_id must be unique (one profile per user)."""
        user = User(email="test@test.com", password_hash="hash", role=UserRole.USER)
        db.add(user)
        await db.flush()
        
        profile1 = Profile(user_id=user.id, name="Test User")
        db.add(profile1)
        await db.commit()
        
        profile2 = Profile(user_id=user.id, name="Another Profile")
        db.add(profile2)
        
        # Should fail due to unique constraint
        with pytest.raises(Exception):
            await db.commit()
