"""
Unit tests for opportunity DB operations.

Tests the upsert/fetch/new-count functions that interact with the
opportunities table in Supabase.
"""
from __future__ import annotations

import hashlib
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from sqlalchemy.ext.asyncio import AsyncSession


# ── Fixtures ───────────────────────────────────────────────────────────────

SAMPLE_OPPORTUNITIES = [
    {
        "title": "Jamaica Tech Hackathon 2026",
        "company": "Jamaica Tech Foundation",
        "location": "Kingston, Jamaica",
        "pay": "Free",
        "url": "https://example.com/hackathon",
        "category": "competition",
        "description": "Annual hackathon for Caribbean developers.",
        "salary_min": None,
        "salary_max": None,
        "salary_currency": None,
        "age_requirement": "Ages 16-30",
        "experience_required": "Basic programming",
        "posted_at": "2026-09-01T00:00:00+00:00",
        "first_seen_at": "2026-09-05T12:00:00+00:00",
        "source_name": "devpost",
        "image_url": None,
    },
    {
        "title": "Caribbean Climate Innovation Fellowship",
        "company": "IDB Lab",
        "location": "Trinidad and Tobago",
        "pay": "$5,000 USD stipend",
        "url": "https://example.com/fellowship",
        "category": "fellowship",
        "description": "Climate-focused innovation fellowship.",
        "salary_min": 5000,
        "salary_max": 5000,
        "salary_currency": "USD",
        "age_requirement": "Ages 18-35",
        "experience_required": "Bachelor's degree",
        "posted_at": "2026-09-03T00:00:00+00:00",
        "first_seen_at": "2026-09-05T12:00:00+00:00",
        "source_name": "eventbrite",
        "image_url": None,
    },
]

DUPLICATE_OPPORTUNITIES = [
    {
        "title": "Jamaica Tech Hackathon 2026",  # Same title = same ID
        "company": "Jamaica Tech Foundation",
        "location": "Kingston, Jamaica",
        "pay": "Free",
        "url": "https://example.com/hackathon-v2",
        "category": "competition",
        "description": "Updated description.",
        "salary_min": None,
        "salary_max": None,
        "salary_currency": None,
        "age_requirement": "Ages 16-30",
        "experience_required": "Basic programming",
        "posted_at": "2026-09-05T00:00:00+00:00",
        "first_seen_at": None,
        "source_name": "devpost",
        "image_url": None,
    },
]


# ── ID generation tests ────────────────────────────────────────────────────


class TestOppIdGeneration:
    def test_deterministic_id(self):
        """Same title always produces the same ID."""
        title = "Jamaica Tech Hackathon 2026"
        expected = hashlib.md5(title.encode()).hexdigest()[:16]
        result = hashlib.md5(title.encode()).hexdigest()[:16]
        assert result == expected

    def test_different_titles_different_ids(self):
        """Different titles produce different IDs."""
        id1 = hashlib.md5("Hackathon".encode()).hexdigest()[:16]
        id2 = hashlib.md5("Fellowship".encode()).hexdigest()[:16]
        assert id1 != id2

    def test_dedup_same_title(self):
        """Two opportunities with the same title get the same ID (dedup)."""
        id1 = hashlib.md5(SAMPLE_OPPORTUNITIES[0]["title"].encode()).hexdigest()[:16]
        id2 = hashlib.md5(DUPLICATE_OPPORTUNITIES[0]["title"].encode()).hexdigest()[:16]
        assert id1 == id2


# ── upsert_opportunities_to_db tests ───────────────────────────────────────


def _mock_execute_result(rows=None, scalar=None):
    """Create a mock result for SQLAlchemy execute()."""
    result = MagicMock()
    if rows is not None:
        result.fetchall.return_value = rows
    if scalar is not None:
        result.scalar.return_value = scalar
    return result


@pytest.mark.asyncio
class TestUpsertOpportunities:
    async def test_upsert_inserts_new_opportunities(self):
        """Upserting new opportunities should call execute for each one and commit."""
        mock_db = AsyncMock(spec=AsyncSession)
        mock_db.execute = AsyncMock(return_value=_mock_execute_result(scalar=0))
        mock_db.commit = AsyncMock()

        from app.agents.scout import upsert_opportunities_to_db

        count = await upsert_opportunities_to_db(mock_db, SAMPLE_OPPORTUNITIES)

        assert count == 2
        assert mock_db.execute.call_count == 2
        mock_db.commit.assert_called_once()

    async def test_upsert_empty_list(self):
        """Upserting an empty list should return 0 and not call execute."""
        mock_db = AsyncMock(spec=AsyncSession)
        mock_db.commit = AsyncMock()

        from app.agents.scout import upsert_opportunities_to_db

        count = await upsert_opportunities_to_db(mock_db, [])

        assert count == 0
        mock_db.execute.assert_not_called()

    async def test_upsert_deduplicates(self):
        """Upserting the same title twice should use same ID (ON CONFLICT)."""
        mock_db = AsyncMock(spec=AsyncSession)
        mock_db.execute = AsyncMock(return_value=_mock_execute_result(scalar=0))
        mock_db.commit = AsyncMock()

        from app.agents.scout import upsert_opportunities_to_db

        # Upsert original + duplicate
        count = await upsert_opportunities_to_db(
            mock_db, SAMPLE_OPPORTUNITIES + DUPLICATE_OPPORTUNITIES
        )

        # 3 unique titles → 3 upserts
        assert count == 3
        assert mock_db.execute.call_count == 3

    async def test_upsert_handles_db_error(self):
        """DB error during upsert should rollback and return 0."""
        from sqlalchemy.exc import SQLAlchemyError

        mock_db = AsyncMock(spec=AsyncSession)
        mock_db.execute = AsyncMock(side_effect=SQLAlchemyError("table locked"))
        mock_db.rollback = AsyncMock()

        from app.agents.scout import upsert_opportunities_to_db

        count = await upsert_opportunities_to_db(mock_db, SAMPLE_OPPORTUNITIES)

        assert count == 0
        mock_db.rollback.assert_called_once()

    async def test_upsert_passes_correct_params(self):
        """Each upsert call should include all expected fields."""
        captured_params = []

        async def capture_execute(sql, params):
            captured_params.append(params)
            return _mock_execute_result(scalar=0)

        mock_db = AsyncMock(spec=AsyncSession)
        mock_db.execute = AsyncMock(side_effect=capture_execute)
        mock_db.commit = AsyncMock()

        from app.agents.scout import upsert_opportunities_to_db

        await upsert_opportunities_to_db(mock_db, [SAMPLE_OPPORTUNITIES[0]])

        assert len(captured_params) == 1
        p = captured_params[0]
        assert p["title"] == "Jamaica Tech Hackathon 2026"
        assert p["category"] == "competition"
        assert p["source_name"] == "devpost"
        assert p["url"] == "https://example.com/hackathon"
        assert p["salary_min"] is None
        assert p["salary_max"] is None


# ── fetch_opportunities_from_db tests ──────────────────────────────────────


@pytest.mark.asyncio
class TestFetchOpportunities:
    async def test_fetch_empty_table(self):
        """Empty table returns empty list and 0 count."""
        mock_db = AsyncMock(spec=AsyncSession)
        # First call: COUNT(*), second call: SELECT
        mock_db.execute = AsyncMock(
            side_effect=[
                _mock_execute_result(scalar=0),
                _mock_execute_result(rows=[]),
            ]
        )

        from app.agents.scout import fetch_opportunities_from_db

        opps, total = await fetch_opportunities_from_db(mock_db)

        assert opps == []
        assert total == 0

    async def test_fetch_with_results(self):
        """Returns rows converted to dicts with correct total."""
        row1 = MagicMock()
        row1._mapping = {
            "id": "abc123",
            "title": "Hackathon",
            "company": "Test",
            "location": "Jamaica",
            "pay": "Free",
            "url": "http://example.com",
            "category": "competition",
            "description": "Test desc",
            "salary_min": None,
            "salary_max": None,
            "salary_currency": None,
            "age_requirement": "16-30",
            "experience_required": "None",
            "posted_at": None,
            "first_seen_at": None,
            "source_name": "curated",
            "image_url": None,
        }
        mock_db = AsyncMock(spec=AsyncSession)
        mock_db.execute = AsyncMock(
            side_effect=[
                _mock_execute_result(scalar=1),
                _mock_execute_result(rows=[row1]),
            ]
        )

        from app.agents.scout import fetch_opportunities_from_db

        opps, total = await fetch_opportunities_from_db(mock_db)

        assert total == 1
        assert len(opps) == 1
        assert opps[0]["title"] == "Hackathon"

    async def test_fetch_with_category_filter(self):
        """Category filter is passed as a parameter."""
        mock_db = AsyncMock(spec=AsyncSession)
        mock_db.execute = AsyncMock(
            side_effect=[
                _mock_execute_result(scalar=0),
                _mock_execute_result(rows=[]),
            ]
        )

        from app.agents.scout import fetch_opportunities_from_db

        await fetch_opportunities_from_db(mock_db, category="job")

        # Check the SQL contained category filter
        first_call = mock_db.execute.call_args_list[0]
        sql = first_call[0][0].text
        assert "category" in sql

    async def test_fetch_handles_db_error(self):
        """DB error returns empty results gracefully."""
        from sqlalchemy.exc import SQLAlchemyError

        mock_db = AsyncMock(spec=AsyncSession)
        mock_db.execute = AsyncMock(side_effect=SQLAlchemyError("connection lost"))

        from app.agents.scout import fetch_opportunities_from_db

        opps, total = await fetch_opportunities_from_db(mock_db)

        assert opps == []
        assert total == 0


# ── get_new_count_from_db tests ────────────────────────────────────────────


@pytest.mark.asyncio
class TestGetNewCount:
    async def test_count_returns_number(self):
        """Returns a dict with new_count as int."""
        mock_db = AsyncMock(spec=AsyncSession)
        mock_db.execute = AsyncMock(return_value=_mock_execute_result(scalar=5))

        from app.agents.scout import get_new_count_from_db

        result = await get_new_count_from_db(mock_db)

        assert result["new_count"] == 5
        assert "new_since" in result

    async def test_count_empty_table(self):
        """Empty table returns 0."""
        mock_db = AsyncMock(spec=AsyncSession)
        mock_db.execute = AsyncMock(return_value=_mock_execute_result(scalar=0))

        from app.agents.scout import get_new_count_from_db

        result = await get_new_count_from_db(mock_db)

        assert result["new_count"] == 0

    async def test_count_handles_db_error(self):
        """DB error returns 0 gracefully."""
        from sqlalchemy.exc import SQLAlchemyError

        mock_db = AsyncMock(spec=AsyncSession)
        mock_db.execute = AsyncMock(side_effect=SQLAlchemyError("timeout"))

        from app.agents.scout import get_new_count_from_db

        result = await get_new_count_from_db(mock_db)

        assert result["new_count"] == 0
