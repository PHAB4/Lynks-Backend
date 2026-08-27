"""
Lynks Backend — Scout Agent Unit Tests

Tests the scouting/filtering/sorting/pagination logic in isolation.
These test the helper functions and logic patterns used by the scout agent,
without requiring a database or network connection.

Run: python -m pytest tests/test_scout_unit.py -v
"""

from __future__ import annotations

from datetime import datetime, timezone, timedelta
from app.agents.scout import (
    get_timeframe_cutoff,
    _parse_posted_at,
    RELEVANCE_KEYWORDS,
    compute_relevance_score,
)


# ══════════════════════════════════════════════════════════════════════════════
#  1. Timeframe Cutoff
# ══════════════════════════════════════════════════════════════════════════════


class TestTimeframeCutoff:
    """Tests for get_timeframe_cutoff() — calculates cutoff dates."""

    def test_day_returns_recent(self):
        cutoff = get_timeframe_cutoff("day")
        now = datetime.now(timezone.utc)
        assert cutoff > now - timedelta(days=2)
        assert cutoff <= now

    def test_week_returns_recent(self):
        cutoff = get_timeframe_cutoff("week")
        now = datetime.now(timezone.utc)
        assert cutoff > now - timedelta(days=8)
        assert cutoff <= now

    def test_month_returns_recent(self):
        cutoff = get_timeframe_cutoff("month")
        now = datetime.now(timezone.utc)
        assert cutoff > now - timedelta(days=32)
        assert cutoff <= now

    def test_quarter_returns_recent(self):
        cutoff = get_timeframe_cutoff("quarter")
        now = datetime.now(timezone.utc)
        assert cutoff > now - timedelta(days=95)
        assert cutoff <= now

    def test_all_returns_old(self):
        cutoff = get_timeframe_cutoff("all")
        now = datetime.now(timezone.utc)
        # "all" should return a very old date
        assert cutoff.year < 2000

    def test_invalid_returns_all(self):
        cutoff = get_timeframe_cutoff("invalid_value")
        now = datetime.now(timezone.utc)
        assert cutoff.year < 2000  # falls back to "all"


# ══════════════════════════════════════════════════════════════════════════════
#  2. Posted At Parsing
# ══════════════════════════════════════════════════════════════════════════════


class TestParsePostedAt:
    """Tests for _parse_posted_at() — converts ISO strings to datetime."""

    def test_valid_iso(self):
        result = _parse_posted_at("2026-08-20T10:00:00+00:00")
        assert result is not None
        assert result.year == 2026
        assert result.month == 8
        assert result.day == 20

    def test_valid_iso_with_z(self):
        result = _parse_posted_at("2026-08-20T10:00:00Z")
        assert result is not None
        assert result.year == 2026

    def test_none_input(self):
        assert _parse_posted_at(None) is None

    def test_empty_string(self):
        assert _parse_posted_at("") is None

    def test_garbage_string(self):
        assert _parse_posted_at("not-a-date") is None

    def test_returns_timezone_aware(self):
        result = _parse_posted_at("2026-08-20T10:00:00+00:00")
        assert result is not None
        assert result.tzinfo is not None

    def test_old_date(self):
        result = _parse_posted_at("2020-01-01T00:00:00+00:00")
        assert result is not None
        assert result.year == 2020


# ══════════════════════════════════════════════════════════════════════════════
#  3. Relevance Scoring
# ══════════════════════════════════════════════════════════════════════════════


class TestRelevanceScore:
    """Tests for compute_relevance_score() — rule-based relevance matching."""

    def test_perfect_match(self):
        """Opportunity matching all user interests should score high."""
        user_interests = ["software development", "python", "web development"]
        opp = {
            "title": "Python Web Developer Internship",
            "description": "Build web applications using Python and Django",
            "category": "job",
        }
        score = compute_relevance_score(opp, user_interests)
        assert score > 5

    def test_partial_match(self):
        """Opportunity matching one interest should score moderate."""
        user_interests = ["data science", "machine learning"]
        opp = {
            "title": "Data Science Bootcamp",
            "description": "Learn Python for data analysis",
            "category": "event",
        }
        score = compute_relevance_score(opp, user_interests)
        assert score > 0

    def test_no_match(self):
        """Opportunity with no matching interests should score 0."""
        user_interests = ["cooking", "culinary arts"]
        opp = {
            "title": "Python Developer Position",
            "description": "Build software applications",
            "category": "job",
        }
        score = compute_relevance_score(opp, user_interests)
        assert score == 0

    def test_empty_interests(self):
        """Empty user interests should return 0."""
        opp = {
            "title": "Amazing Opportunity",
            "description": "Great job",
            "category": "job",
        }
        score = compute_relevance_score(opp, [])
        assert score == 0

    def test_job_bonus(self):
        """Job category should get a bonus."""
        user_interests = ["python"]
        opp_job = {"title": "Python Developer", "description": "", "category": "job"}
        opp_event = {"title": "Python Event", "description": "", "category": "event"}
        score_job = compute_relevance_score(opp_job, user_interests)
        score_event = compute_relevance_score(opp_event, user_interests)
        assert score_job >= score_event

    def test_case_insensitive(self):
        """Matching should work regardless of case."""
        user_interests = ["python"]
        opp = {"title": "PYTHON DEVELOPER", "description": "", "category": "job"}
        score = compute_relevance_score(opp, user_interests)
        assert score > 0

    def test_keyword_list_not_empty(self):
        """The RELEVANCE_KEYWORDS constant should not be empty."""
        assert len(RELEVANCE_KEYWORDS) > 0


# ══════════════════════════════════════════════════════════════════════════════
#  4. Sorting Logic (manual simulation)
# ══════════════════════════════════════════════════════════════════════════════


class TestSortingLogic:
    """Tests that sorting logic works as expected (simulated, no DB)."""

    def _make_opp(self, posted_at: str | None, salary_min: float | None = None):
        return {
            "id": "test",
            "title": "Test",
            "posted_at": posted_at,
            "salary_min": salary_min,
        }

    def test_sort_by_recent(self):
        """Most recent should come first."""
        opps = [
            self._make_opp("2026-08-20T10:00:00+00:00"),
            self._make_opp("2026-08-27T10:00:00+00:00"),
            self._make_opp("2026-08-25T10:00:00+00:00"),
        ]
        opps.sort(
            key=lambda o: _parse_posted_at(o.get("posted_at")) or datetime.min.replace(tzinfo=timezone.utc),
            reverse=True,
        )
        assert opps[0]["posted_at"] == "2026-08-27T10:00:00+00:00"

    def test_sort_by_recent_with_none(self):
        """None posted_at should sort to the end."""
        opps = [
            self._make_opp("2026-08-20T10:00:00+00:00"),
            self._make_opp(None),
            self._make_opp("2026-08-27T10:00:00+00:00"),
        ]
        opps.sort(
            key=lambda o: _parse_posted_at(o.get("posted_at")) or datetime.min.replace(tzinfo=timezone.utc),
            reverse=True,
        )
        assert opps[0]["posted_at"] == "2026-08-27T10:00:00+00:00"
        assert opps[-1]["posted_at"] is None

    def test_sort_by_salary(self):
        """Higher salary should come first."""
        opps = [
            self._make_opp("2026-08-20T10:00:00+00:00", salary_min=50000),
            self._make_opp("2026-08-20T10:00:00+00:00", salary_min=100000),
            self._make_opp("2026-08-20T10:00:00+00:00", salary_min=None),
        ]
        opps.sort(key=lambda o: o.get("salary_min") or 0, reverse=True)
        assert opps[0]["salary_min"] == 100000
        assert opps[-1]["salary_min"] is None

    def test_pagination_slice(self):
        """Offset pagination should return the correct slice."""
        all_opps = [{"id": i} for i in range(25)]
        page = 2
        limit = 10
        start = (page - 1) * limit
        end = start + limit
        page_opps = all_opps[start:end]
        assert len(page_opps) == 10
        assert page_opps[0]["id"] == 10
        assert page_opps[-1]["id"] == 19

    def test_pagination_last_page(self):
        """Last page may have fewer items."""
        all_opps = [{"id": i} for i in range(25)]
        page = 3
        limit = 10
        start = (page - 1) * limit
        end = start + limit
        page_opps = all_opps[start:end]
        assert len(page_opps) == 5
        has_more = end < len(all_opps)
        assert has_more is False

    def test_pagination_beyond_end(self):
        """Page beyond available data returns empty."""
        all_opps = [{"id": i} for i in range(10)]
        page = 5
        limit = 10
        start = (page - 1) * limit
        end = start + limit
        page_opps = all_opps[start:end]
        assert len(page_opps) == 0

    def test_has_more_correct(self):
        """has_more should be True when there are more items."""
        all_opps = [{"id": i} for i in range(25)]
        page = 1
        limit = 20
        start = (page - 1) * limit
        end = start + limit
        has_more = end < len(all_opps)
        assert has_more is True


# ══════════════════════════════════════════════════════════════════════════════
#  5. Category Filtering (manual simulation)
# ══════════════════════════════════════════════════════════════════════════════


class TestCategoryFiltering:
    """Tests that category filtering works correctly."""

    def test_filter_by_category(self):
        opps = [
            {"id": "1", "category": "job"},
            {"id": "2", "category": "scholarship"},
            {"id": "3", "category": "job"},
            {"id": "4", "category": "competition"},
        ]
        filtered = [o for o in opps if o["category"] == "job"]
        assert len(filtered) == 2

    def test_filter_no_match(self):
        opps = [
            {"id": "1", "category": "job"},
            {"id": "2", "category": "scholarship"},
        ]
        filtered = [o for o in opps if o["category"] == "volunteer"]
        assert len(filtered) == 0

    def test_valid_categories(self):
        """All categories should be from the accepted set."""
        valid = {"job", "scholarship", "competition", "event", "club", "volunteer"}
        opps = [
            {"category": "job"},
            {"category": "scholarship"},
            {"category": "competition"},
            {"category": "event"},
            {"category": "club"},
            {"category": "volunteer"},
        ]
        for opp in opps:
            assert opp["category"] in valid
