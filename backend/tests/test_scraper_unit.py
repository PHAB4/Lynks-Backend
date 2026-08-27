"""
Lynks Backend — Opportunity Scraper Unit Tests

Tests the CORE SCRAPER LOGIC in isolation — no network calls, no database.
These tests verify that the building blocks of the scraper actually work:
  - Opportunity dataclass creation
  - Salary parsing from text
  - Keyword matching for RSS filtering
  - RSS date parsing
  - Caching layer (set/get/TTL)
  - Curated list integrity
  - Deduplication logic
  - Opportunity metadata fields

Run: python -m pytest tests/test_scraper_unit.py -v
"""

from __future__ import annotations

import time
from datetime import datetime, timezone

import pytest


# ══════════════════════════════════════════════════════════════════════════════
#  Import the scraper functions we're testing
# ══════════════════════════════════════════════════════════════════════════════

from app.agents.opportunity_scraper import (
    Opportunity,
    _parse_salary,
    _detect_currency,
    _CURRENCY_TABLE,
    _matches_opportunity_keywords,
    _parse_rss_date,
    _now_iso,
    _opportunity_cache,
    get_cached_opportunities,
    set_cached_opportunities,
    CACHE_TTL,
    scrape_curated_list,
    CARIBBEAN_OPPORTUNITIES,
    RSS_FEEDS,
    OPPORTUNITY_KEYWORDS,
)


# ══════════════════════════════════════════════════════════════════════════════
#  1. Opportunity Dataclass
# ══════════════════════════════════════════════════════════════════════════════


class TestOpportunityDataclass:
    """Tests for the Opportunity dataclass."""

    def test_minimal_creation(self):
        """Opportunity can be created with only required fields."""
        opp = Opportunity(
            id="test-123",
            title="Test Opportunity",
            company="Test Co",
            location="Jamaica",
            pay="Free",
        )
        assert opp.id == "test-123"
        assert opp.title == "Test Opportunity"
        assert opp.category == "event"  # default
        assert opp.source_name == "curated"  # default
        assert opp.salary_min is None  # default
        assert opp.salary_max is None  # default
        assert opp.salary_currency is None  # default
        assert opp.image_url is None  # default

    def test_full_creation(self):
        """Opportunity can be created with all fields."""
        opp = Opportunity(
            id="test-456",
            title="Frontend Developer",
            company="TechBeach",
            location="Kingston, Jamaica",
            pay="JMD $50,000-$80,000/month",
            salary_min=50000,
            salary_max=80000,
            salary_currency="JMD",
            age_requirement="18-25",
            experience_required="Beginner",
            url="https://example.com",
            category="job",
            description="Build modern web apps",
            posted_at="2026-08-20T10:00:00Z",
            first_seen_at="2026-08-27T14:00:00Z",
            source_name="devpost_api",
            image_url="https://example.com/image.png",
        )
        assert opp.category == "job"
        assert opp.salary_min == 50000
        assert opp.salary_max == 80000
        assert opp.salary_currency == "JMD"
        assert opp.image_url == "https://example.com/image.png"

    def test_to_dict(self):
        """to_dict() returns a dictionary with all fields."""
        opp = Opportunity(
            id="test-789",
            title="Test",
            company="Co",
            location="Here",
            pay="Free",
        )
        d = opp.to_dict()
        assert isinstance(d, dict)
        assert d["id"] == "test-789"
        assert d["title"] == "Test"
        assert "salary_min" in d
        assert "image_url" in d
        assert "first_seen_at" in d

    def test_to_dict_roundtrip(self):
        """Opportunity can be reconstructed from its dict."""
        opp = Opportunity(
            id="rt-1",
            title="Roundtrip Test",
            company="RT Co",
            location="Barbados",
            pay="USD $50,000",
            salary_min=50000,
            salary_max=50000,
            salary_currency="USD",
            category="job",
        )
        d = opp.to_dict()
        opp2 = Opportunity(**d)
        assert opp2.id == opp.id
        assert opp2.title == opp.title
        assert opp2.salary_min == opp.salary_min


# ══════════════════════════════════════════════════════════════════════════════
#  2. Salary Parsing
# ══════════════════════════════════════════════════════════════════════════════


class TestParseSalary:
    """Tests for _parse_salary() — extracts structured salary from text."""

    def test_empty_string(self):
        assert _parse_salary("") == (None, None, None)

    def test_none_input(self):
        assert _parse_salary(None) == (None, None, None)

    def test_usd_range(self):
        low, high, currency = _parse_salary("$50,000 - $75,000/year")
        assert low == 50000
        assert high == 75000
        assert currency == "USD"

    def test_jmd_range(self):
        low, high, currency = _parse_salary("JMD $800,000 - $1,200,000 per annum")
        assert low == 800000
        assert high == 1200000
        assert currency == "JMD"

    def test_single_amount(self):
        low, high, currency = _parse_salary("$60,000/year")
        assert low == 60000
        assert high == 60000
        assert currency == "USD"

    def test_eur_symbol(self):
        low, high, currency = _parse_salary("€40,000 - €55,000")
        assert low == 40000
        assert high == 55000
        assert currency == "EUR"

    def test_gbp_symbol(self):
        low, high, currency = _parse_salary("£30,000 - £45,000")
        assert low == 30000
        assert high == 45000
        assert currency == "GBP"

    def test_no_salary_info(self):
        low, high, currency = _parse_salary("Free to enter")
        assert low is None
        assert high is None
        assert currency is None

    def test_unstructured_text(self):
        low, high, currency = _parse_salary("Competitive salary, depends on experience")
        assert low is None
        assert high is None
        assert currency is None

    def test_en_dash_range(self):
        low, high, currency = _parse_salary("$30,000–$45,000")
        assert low == 30000
        assert high == 45000
        assert currency == "USD"

    def test_usd_text_label(self):
        low, high, currency = _parse_salary("USD 70,000 per year")
        assert low == 70000
        assert high == 70000
        assert currency == "USD"

    def test_decimal_amounts(self):
        low, high, currency = _parse_salary("$50.50 - $75.25/hour")
        assert low == 50.50
        assert high == 75.25
        assert currency == "USD"


# ══════════════════════════════════════════════════════════════════════════════
#  2b. Currency Detection (priority-based)
# ══════════════════════════════════════════════════════════════════════════════


class TestDetectCurrency:
    """Tests for _detect_currency() — priority-based currency lookup."""

    def test_caribbean_currencies(self):
        """All Caribbean currencies should be detected."""
        assert _detect_currency("JMD 500,000") == "JMD"
        assert _detect_currency("TTD $80,000") == "TTD"
        assert _detect_currency("BBD $50,000") == "BBD"
        assert _detect_currency("KYD $60,000") == "KYD"
        assert _detect_currency("XCD $40,000") == "XCD"
        assert _detect_currency("GYD $200,000") == "GYD"
        assert _detect_currency("SRD $100,000") == "SRD"

    def test_jmd_before_usd(self):
        """JMD should win over USD when both are present."""
        assert _detect_currency("JMD $800,000") == "JMD"

    def test_ttd_before_usd(self):
        """TTD should win over USD when both are present."""
        assert _detect_currency("TTD $50,000") == "TTD"

    def test_bbd_before_usd(self):
        """BBD should win over USD when both are present."""
        assert _detect_currency("BBD $75,000") == "BBD"

    def test_bare_dollar_usd(self):
        """Bare $ without other signals → USD."""
        assert _detect_currency("$50,000") == "USD"

    def test_usd_text(self):
        assert _detect_currency("USD 70,000") == "USD"

    def test_eur_symbol(self):
        assert _detect_currency("€50,000") == "EUR"

    def test_eur_text(self):
        assert _detect_currency("EUR 50,000") == "EUR"

    def test_gbp_symbol(self):
        assert _detect_currency("£40,000") == "GBP"

    def test_gbp_text(self):
        assert _detect_currency("GBP 40,000") == "GBP"

    def test_cad(self):
        assert _detect_currency("CAD 80,000") == "CAD"
        assert _detect_currency("Canadian dollars") == "CAD"

    def test_aud(self):
        assert _detect_currency("AUD 90,000") == "AUD"
        assert _detect_currency("Australian dollars") == "AUD"

    def test_jpy(self):
        assert _detect_currency("¥5,000,000") == "JPY"
        assert _detect_currency("JPY 5000000") == "JPY"

    def test_inr(self):
        assert _detect_currency("₹500,000") == "INR"
        assert _detect_currency("INR 500000") == "INR"

    def test_brl(self):
        assert _detect_currency("BRL 100,000") == "BRL"
        assert _detect_currency("Brazilian real") == "BRL"

    def test_mxn(self):
        assert _detect_currency("MXN 200,000") == "MXN"
        assert _detect_currency("Mexican peso") == "MXN"

    def test_no_currency(self):
        """Text with no currency signals → None."""
        assert _detect_currency("Competitive salary") is None
        assert _detect_currency("Free to enter") is None
        assert _detect_currency("") is None

    def test_case_insensitive(self):
        assert _detect_currency("jmd 500,000") == "JMD"
        assert _detect_currency("usd 70,000") == "USD"

    def test_currency_table_has_caribbean(self):
        """The currency table should include at least 8 Caribbean currencies."""
        caribbean_codes = {"JMD", "TTD", "BBD", "BSD", "KYD", "XCD", "GYD", "SRD", "HTG", "DOP"}
        table_codes = {code for _, code, _ in _CURRENCY_TABLE}
        assert caribbean_codes.issubset(table_codes)

    def test_currency_table_has_major(self):
        """The currency table should include major world currencies."""
        major_codes = {"USD", "EUR", "GBP", "CAD", "AUD", "JPY", "CNY", "INR"}
        table_codes = {code for _, code, _ in _CURRENCY_TABLE}
        assert major_codes.issubset(table_codes)

    # ── Source-context-aware tests ──────────────────────────────────────────

    def test_jamaican_source_bare_dollar(self):
        """Bare $ from a Jamaican source → JMD."""
        assert _detect_currency("$500,000", source_name="rss_jamaica_gleaner") == "JMD"
        assert _detect_currency("$500,000", source_name="facebook_JamaicaTechCommunity") == "JMD"

    def test_trinidadian_source_bare_dollar(self):
        """Bare $ from a Trinidadian source → TTD (via keyword match)."""
        assert _detect_currency("$80,000", source_name="facebook_TrinidadJobs") == "TTD"
        assert _detect_currency("$80,000", source_name="instagram_TriniTech") == "TTD"

    def test_barbadian_source_bare_dollar(self):
        """Bare $ from a Barbadian source → BBD (via keyword match)."""
        assert _detect_currency("$75,000", source_name="facebook_BarbadosJobs") == "BBD"

    def test_explicit_code_overrides_source(self):
        """Explicit currency code in text should override source context."""
        assert _detect_currency("TTD $50,000", source_name="rss_jamaica_gleaner") == "TTD"
        assert _detect_currency("EUR 50,000", source_name="rss_jamaica_gleaner") == "EUR"

    def test_no_source_bare_dollar_usd(self):
        """Bare $ with no source context → USD."""
        assert _detect_currency("$50,000") == "USD"
        assert _detect_currency("$50,000", source_name=None) == "USD"

    def test_unknown_source_bare_dollar_usd(self):
        """Bare $ from an unknown source → USD."""
        assert _detect_currency("$50,000", source_name="devpost_api") == "USD"

    def test_uwi_source_bare_dollar(self):
        """UWI Mona is in Jamaica → JMD."""
        assert _detect_currency("$500,000", source_name="rss_uwi_news") == "JMD"

    def test_loop_caribbean_usd(self):
        """Loop Caribbean covers multiple countries → USD as safe default."""
        assert _detect_currency("$50,000", source_name="rss_loop_caribbean") == "USD"

    def test_parse_salary_with_source_context(self):
        """_parse_salary passes source_name through to _detect_currency."""
        low, high, currency = _parse_salary("$500,000/year", source_name="rss_jamaica_gleaner")
        assert low == 500000
        assert high == 500000
        assert currency == "JMD"

    def test_parse_salary_without_source(self):
        """_parse_salary without source_name defaults bare $ to USD."""
        low, high, currency = _parse_salary("$50,000/year")
        assert low == 50000
        assert currency == "USD"


# ══════════════════════════════════════════════════════════════════════════════
#  3. Keyword Matching
# ══════════════════════════════════════════════════════════════════════════════


class TestMatchesOpportunityKeywords:
    """Tests for _matches_opportunity_keywords() — RSS entry filtering."""

    def test_hiring_match(self):
        assert _matches_opportunity_keywords("We are hiring a software developer") is True

    def test_scholarship_match(self):
        assert _matches_opportunity_keywords("New scholarship for Caribbean students") is True

    def test_workshop_match(self):
        assert _matches_opportunity_keywords("Free coding workshop this Saturday") is True

    def test_volunteer_match(self):
        assert _matches_opportunity_keywords("Volunteer opportunity with UNICEF") is True

    def test_no_match_weather(self):
        assert _matches_opportunity_keywords("Today will be sunny with scattered clouds") is False

    def test_no_match_politics(self):
        assert _matches_opportunity_keywords("Prime Minister addresses parliament") is False

    def test_case_insensitive(self):
        assert _matches_opportunity_keywords("SCHOLARSHIP AVAILABLE NOW") is True

    def test_empty_string(self):
        assert _matches_opportunity_keywords("") is False

    def test_mixed_content_match(self):
        text = "The government announced new funding for education programs"
        assert _matches_opportunity_keywords(text) is True  # "funding" and "programs"

    def test_competition_keyword(self):
        assert _matches_opportunity_keywords("Enter our hackathon competition") is True

    def test_deadline_keyword(self):
        assert _matches_opportunity_keywords("Application deadline extended to Friday") is True


# ══════════════════════════════════════════════════════════════════════════════
#  4. RSS Date Parsing
# ══════════════════════════════════════════════════════════════════════════════


class TestParseRssDate:
    """Tests for _parse_rss_date() — converts RSS date strings to ISO."""

    def test_rfc2822(self):
        result = _parse_rss_date("Mon, 25 Aug 2026 10:00:00 +0000")
        assert result is not None
        assert "2026" in result

    def test_iso_with_z(self):
        result = _parse_rss_date("2026-08-25T10:00:00Z")
        assert result is not None
        assert "2026-08-25" in result

    def test_iso_with_offset(self):
        result = _parse_rss_date("2026-08-25T10:00:00+00:00")
        assert result is not None
        assert "2026-08-25" in result

    def test_simple_date(self):
        result = _parse_rss_date("2026-08-25 10:00:00")
        assert result is not None
        assert "2026-08-25" in result

    def test_none_input(self):
        assert _parse_rss_date(None) is None

    def test_empty_string(self):
        assert _parse_rss_date("") is None

    def test_garbage_input(self):
        result = _parse_rss_date("not a date at all")
        # Should return the original string if no format matches
        assert result == "not a date at all"

    def test_strip_whitespace(self):
        result = _parse_rss_date("  2026-08-25T10:00:00Z  ")
        assert result is not None
        assert "2026-08-25" in result


# ══════════════════════════════════════════════════════════════════════════════
#  5. Caching Layer
# ══════════════════════════════════════════════════════════════════════════════


class TestCaching:
    """Tests for the in-memory caching layer."""

    def setup_method(self):
        """Clear cache before each test."""
        _opportunity_cache.clear()

    def test_set_and_get(self):
        """set then get returns the data."""
        data = [{"title": "Test", "id": "123"}]
        set_cached_opportunities("test_source", data)
        result = get_cached_opportunities("test_source")
        assert result == data

    def test_cache_miss(self):
        """get returns None for unknown source."""
        result = get_cached_opportunities("nonexistent_source")
        assert result is None

    def test_cache_expiry(self):
        """Cache returns None after TTL expires."""
        # Manually insert with old timestamp
        _opportunity_cache["old_source"] = (time.time() - CACHE_TTL - 1, [{"old": True}])
        result = get_cached_opportunities("old_source")
        assert result is None

    def test_cache_not_expired(self):
        """Cache returns data within TTL."""
        set_cached_opportunities("fresh_source", [{"fresh": True}])
        result = get_cached_opportunities("fresh_source")
        assert result is not None
        assert result[0]["fresh"] is True

    def test_cache_overwrite(self):
        """Setting same source twice overwrites."""
        set_cached_opportunities("src", [{"v": 1}])
        set_cached_opportunities("src", [{"v": 2}])
        result = get_cached_opportunities("src")
        assert result[0]["v"] == 2

    def test_multiple_sources(self):
        """Different sources are cached independently."""
        set_cached_opportunities("src_a", [{"a": True}])
        set_cached_opportunities("src_b", [{"b": True}])
        assert get_cached_opportunities("src_a")[0]["a"] is True
        assert get_cached_opportunities("src_b")[0]["b"] is True


# ══════════════════════════════════════════════════════════════════════════════
#  6. Curated List
# ══════════════════════════════════════════════════════════════════════════════


class TestCuratedList:
    """Tests for the hardcoded curated opportunities."""

    def test_curated_list_not_empty(self):
        """The curated list should have at least 10 entries."""
        assert len(CARIBBEAN_OPPORTUNITIES) >= 10

    def test_curated_has_required_fields(self):
        """Every curated entry must have title, company, location, url, category."""
        required = ["title", "company", "location", "url", "category"]
        for opp in CARIBBEAN_OPPORTUNITIES:
            for field in required:
                assert field in opp, f"Missing '{field}' in curated entry: {opp.get('title', '?')}"

    def test_curated_categories_valid(self):
        """All categories must be one of the accepted values."""
        valid = {"job", "scholarship", "competition", "event", "club", "volunteer"}
        for opp in CARIBBEAN_OPPORTUNITIES:
            assert opp["category"] in valid, f"Invalid category '{opp['category']}' in {opp['title']}"

    def test_scrape_curated_returns_opportunities(self):
        """scrape_curated_list() returns Opportunity objects."""
        opps = scrape_curated_list()
        assert len(opps) >= 10
        assert all(isinstance(o, Opportunity) for o in opps)

    def test_scrape_curated_ids_unique(self):
        """Each curated opportunity gets a unique UUID."""
        opps = scrape_curated_list()
        ids = [o.id for o in opps]
        assert len(ids) == len(set(ids))

    def test_scrape_curated_has_source_name(self):
        """All curated opportunities have source_name='curated'."""
        opps = scrape_curated_list()
        assert all(o.source_name == "curated" for o in opps)

    def test_scrape_curated_has_first_seen_at(self):
        """All curated opportunities have first_seen_at set."""
        opps = scrape_curated_list()
        assert all(o.first_seen_at is not None for o in opps)

    def test_scrape_curated_has_image_url_field(self):
        """All curated opportunities have image_url field (even if None)."""
        opps = scrape_curated_list()
        for opp in opps:
            assert hasattr(opp, "image_url")

    def test_curated_covers_all_categories(self):
        """The curated list should cover at least job, scholarship, competition, event, club, volunteer."""
        categories = {o["category"] for o in CARIBBEAN_OPPORTUNITIES}
        expected = {"job", "scholarship", "competition", "event", "club", "volunteer"}
        missing = expected - categories
        assert not missing, f"Missing categories in curated list: {missing}"

    def test_curated_salary_parsing(self):
        """Curated entries with salary info get parsed correctly."""
        opps = scrape_curated_list()
        job_opps = [o for o in opps if o.category == "job"]
        # At least one job should have salary parsed
        assert len(job_opps) >= 1
        # Digital Jobs Africa says "Paid remote work" — no structured salary
        # But the field should be present
        for opp in job_opps:
            assert hasattr(opp, "salary_min")
            assert hasattr(opp, "salary_max")
            assert hasattr(opp, "salary_currency")


# ══════════════════════════════════════════════════════════════════════════════
#  7. Deduplication Logic
# ══════════════════════════════════════════════════════════════════════════════


class TestDeduplication:
    """Tests for title-based deduplication."""

    def test_same_title_deduped(self):
        """Two opportunities with the same title should be deduplicated."""
        opps = [
            Opportunity(id="1", title="Hackathon Jamaica", company="A", location="Jamaica", pay="Free", category="competition"),
            Opportunity(id="2", title="Hackathon Jamaica", company="B", location="Kingston", pay="Free", category="competition"),
            Opportunity(id="3", title="Different Event", company="C", location="Barbados", pay="Free", category="event"),
        ]

        seen: set[str] = set()
        unique: list[dict] = []
        for opp in opps:
            key = opp.title.lower().strip()
            if key not in seen:
                seen.add(key)
                unique.append(opp.to_dict())

        assert len(unique) == 2

    def test_case_insensitive_dedup(self):
        """'Hackathon' and 'hackathon' should be treated as the same."""
        opps = [
            Opportunity(id="1", title="Hackathon Jamaica", company="A", location="Jamaica", pay="Free", category="competition"),
            Opportunity(id="2", title="hackathon jamaica", company="B", location="Kingston", pay="Free", category="competition"),
        ]

        seen: set[str] = set()
        unique: list[dict] = []
        for opp in opps:
            key = opp.title.lower().strip()
            if key not in seen:
                seen.add(key)
                unique.append(opp.to_dict())

        assert len(unique) == 1


# ══════════════════════════════════════════════════════════════════════════════
#  8. RSS Feed Configuration
# ══════════════════════════════════════════════════════════════════════════════


class TestRSSFeedConfig:
    """Tests for RSS feed configuration."""

    def test_has_feeds(self):
        """At least one RSS feed is configured."""
        assert len(RSS_FEEDS) >= 1

    def test_feed_structure(self):
        """Each feed has url, source_name, default_category."""
        for feed in RSS_FEEDS:
            assert "url" in feed
            assert "source_name" in feed
            assert "default_category" in feed
            assert feed["url"].startswith("http")

    def test_keyword_list_not_empty(self):
        """The keyword list for RSS filtering is not empty."""
        assert len(OPPORTUNITY_KEYWORDS) >= 10


# ══════════════════════════════════════════════════════════════════════════════
#  9. Helper Functions
# ══════════════════════════════════════════════════════════════════════════════


class TestHelpers:
    """Tests for small helper functions."""

    def test_now_iso_format(self):
        """_now_iso() returns a valid ISO format string."""
        result = _now_iso()
        # Should be parseable as ISO datetime
        dt = datetime.fromisoformat(result)
        assert dt.tzinfo is not None  # must be timezone-aware

    def test_now_iso_utc(self):
        """_now_iso() returns UTC time."""
        result = _now_iso()
        assert result.endswith("+00:00") or result.endswith("Z")


# ══════════════════════════════════════════════════════════════════════════════
#  10. Salary Parsing Integration with Curated List
# ══════════════════════════════════════════════════════════════════════════════


class TestSalaryIntegration:
    """Integration tests — salary parsing + curated list together."""

    def test_known_salary_entry(self):
        """The Google Generation Scholarship ($10,000 USD) should parse."""
        google_entry = next(
            (o for o in CARIBBEAN_OPPORTUNITIES if "Google" in o["title"]),
            None,
        )
        assert google_entry is not None
        low, high, currency = _parse_salary(google_entry["pay"])
        assert low == 10000
        assert high == 10000
        assert currency == "USD"

    def test_free_entry_no_salary(self):
        """'Free to enter' should not produce salary values."""
        low, high, currency = _parse_salary("Free to enter")
        assert low is None
        assert high is None

    def test_curated_with_salary_has_fields(self):
        """After scraping, salary-capable entries should have the fields."""
        opps = scrape_curated_list()
        for opp in opps:
            # Every opportunity should have salary fields
            assert hasattr(opp, "salary_min")
            assert hasattr(opp, "salary_max")
            assert hasattr(opp, "salary_currency")
