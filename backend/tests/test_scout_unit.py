"""
Lynks Backend — Scout Agent Unit Tests

Tests the filtering/sorting/pagination logic in isolation.
These test the helper functions and logic patterns used by the scout agent,
without requiring a database or network connection.

Run: python -m pytest tests/test_scout_unit.py -v
"""

from __future__ import annotations

from datetime import datetime, timezone, timedelta
from app.agents.scout import (
    get_timeframe_cutoff,
    _parse_posted_at,
    CARIBBEAN_OPPORTUNITIES,
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
#  3. Curated List Validation
# ══════════════════════════════════════════════════════════════════════════════


class TestCuratedList:
    """Tests for the CARIBBEAN_OPPORTUNITIES curated list."""

    VALID_CATEGORIES = {"job", "scholarship", "competition", "event", "club", "volunteer"}

    def test_list_not_empty(self):
        assert len(CARIBBEAN_OPPORTUNITIES) > 0

    def test_minimum_count(self):
        """Should have at least 30 curated opportunities."""
        assert len(CARIBBEAN_OPPORTUNITIES) >= 30

    def test_required_fields(self):
        """Every opportunity must have the required fields."""
        required = {"title", "company", "location", "pay", "category", "description"}
        for opp in CARIBBEAN_OPPORTUNITIES:
            for field in required:
                assert field in opp, f"Missing '{field}' in: {opp.get('title', '?')}"

    def test_valid_categories(self):
        """All categories should be from the accepted set."""
        for opp in CARIBBEAN_OPPORTUNITIES:
            assert opp["category"] in self.VALID_CATEGORIES, (
                f"Invalid category '{opp['category']}' in: {opp['title']}"
            )

    def test_no_duplicate_titles(self):
        """No two opportunities should have the same title."""
        titles = [o["title"] for o in CARIBBEAN_OPPORTUNITIES]
        assert len(titles) == len(set(titles)), "Duplicate titles found"

    def test_salary_fields_present(self):
        """Salary fields should be present on every opportunity."""
        for opp in CARIBBEAN_OPPORTUNITIES:
            assert "salary_min" in opp, f"Missing salary_min in: {opp['title']}"
            assert "salary_max" in opp, f"Missing salary_max in: {opp['title']}"
            assert "salary_currency" in opp, f"Missing salary_currency in: {opp['title']}"

    def test_categories_are_distributed(self):
        """Should have opportunities across multiple categories."""
        categories = {o["category"] for o in CARIBBEAN_OPPORTUNITIES}
        assert len(categories) >= 4, f"Only {len(categories)} categories represented"

    def test_has_competitions(self):
        competitions = [o for o in CARIBBEAN_OPPORTUNITIES if o["category"] == "competition"]
        assert len(competitions) >= 3

    def test_has_scholarships(self):
        scholarships = [o for o in CARIBBEAN_OPPORTUNITIES if o["category"] == "scholarship"]
        assert len(scholarships) >= 3

    def test_has_events(self):
        events = [o for o in CARIBBEAN_OPPORTUNITIES if o["category"] == "event"]
        assert len(events) >= 3

    def test_has_volunteer(self):
        volunteer = [o for o in CARIBBEAN_OPPORTUNITIES if o["category"] == "volunteer"]
        assert len(volunteer) >= 3

    def test_caribbean_locations(self):
        """At least half should mention Caribbean locations."""
        caribbean_keywords = [
            "jamaica", "barbados", "trinidad", "caribbean", "caricom",
            "uwi", "kingston", "montego", "online", "remote",
        ]
        caribbean_count = 0
        for opp in CARIBBEAN_OPPORTUNITIES:
            location_lower = opp["location"].lower()
            if any(kw in location_lower for kw in caribbean_keywords):
                caribbean_count += 1
        ratio = caribbean_count / len(CARIBBEAN_OPPORTUNITIES)
        assert ratio >= 0.5, f"Only {ratio:.0%} of opportunities are Caribbean-relevant"


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


# ══════════════════════════════════════════════════════════════════════════════
#  5. Pagination Logic (manual simulation)
# ══════════════════════════════════════════════════════════════════════════════


class TestPaginationLogic:
    """Tests that offset pagination works correctly."""

    def test_page_1(self):
        all_opps = [{"id": i} for i in range(25)]
        page, limit = 1, 20
        start = (page - 1) * limit
        end = start + limit
        page_opps = all_opps[start:end]
        assert len(page_opps) == 20

    def test_page_2(self):
        all_opps = [{"id": i} for i in range(25)]
        page, limit = 2, 10
        start = (page - 1) * limit
        end = start + limit
        page_opps = all_opps[start:end]
        assert len(page_opps) == 10
        assert page_opps[0]["id"] == 10

    def test_last_page(self):
        all_opps = [{"id": i} for i in range(25)]
        page, limit = 3, 10
        start = (page - 1) * limit
        end = start + limit
        page_opps = all_opps[start:end]
        assert len(page_opps) == 5
        has_more = end < len(all_opps)
        assert has_more is False

    def test_beyond_end(self):
        all_opps = [{"id": i} for i in range(10)]
        page, limit = 5, 10
        start = (page - 1) * limit
        end = start + limit
        page_opps = all_opps[start:end]
        assert len(page_opps) == 0

    def test_has_more_true(self):
        all_opps = [{"id": i} for i in range(25)]
        page, limit = 1, 20
        start = (page - 1) * limit
        end = start + limit
        assert (end < len(all_opps)) is True

    def test_has_more_false(self):
        all_opps = [{"id": i} for i in range(10)]
        page, limit = 1, 20
        start = (page - 1) * limit
        end = start + limit
        assert (end < len(all_opps)) is False


# ══════════════════════════════════════════════════════════════════════════════
#  6. Category Filtering (manual simulation)
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

    def test_filter_returns_all_when_none(self):
        opps = [
            {"id": "1", "category": "job"},
            {"id": "2", "category": "scholarship"},
        ]
        category = None
        filtered = [o for o in opps if category is None or o["category"] == category]
        assert len(filtered) == 2


# ══════════════════════════════════════════════════════════════════════════════
#  7. Curated List Category Distribution
# ══════════════════════════════════════════════════════════════════════════════


class TestCategoryDistribution:
    """Verify the curated list has good category coverage."""

    def _count(self, category: str) -> int:
        return len([o for o in CARIBBEAN_OPPORTUNITIES if o["category"] == category])

    def test_competitions_count(self):
        assert self._count("competition") >= 5

    def test_scholarships_count(self):
        assert self._count("scholarship") >= 4

    def test_events_count(self):
        assert self._count("event") >= 4

    def test_clubs_count(self):
        assert self._count("club") >= 4

    def test_volunteer_count(self):
        assert self._count("volunteer") >= 4

    def test_jobs_count(self):
        assert self._count("job") >= 1
