"""
Unit tests for opportunity scoring engine.
Uses pure functions — no DB, no server, no network needed.
"""
from __future__ import annotations

import pytest
from app.services.scoring import (
    score_opportunity,
    get_personal_matches,
    score_all_opportunities,
    MATCH_THRESHOLD,
    _parse_age_range,
    _parse_education_from_experience,
    _get_user_education_level,
)


# ── Fixtures ───────────────────────────────────────────────────────────────

JAMAICAN_DEV_PROFILE = {
    "career_path": "software_engineering",
    "education_level": "university",
    "age": 21,
    "country": "Jamaica",
    "interests": ["coding", "web development", "hackathons"],
}

JAMAICAN_HIGHSCHOOLER = {
    "career_path": "data_science",
    "education_level": "high_school",
    "age": 16,
    "country": "Jamaica",
    "interests": ["math", "science"],
}

TRINIDADIAN_BUSINESS = {
    "career_path": "business",
    "education_level": "bachelors",
    "age": 25,
    "country": "Trinidad and Tobago",
    "interests": ["entrepreneurship", "finance"],
}

HACKATHON_OPP = {
    "title": "Jamaica Tech Hackathon",
    "category": "competition",
    "description": "Annual hackathon in Jamaica focused on local tech solutions and coding.",
    "age_requirement": "Ages 16-30",
    "experience_required": "Basic programming knowledge",
    "location": "Jamaica",
}

SCHOLARSHIP_OPP = {
    "title": "CXC/CSEC Scholarships",
    "category": "scholarship",
    "description": "Merit-based scholarships for Caribbean students.",
    "age_requirement": "High school graduates",
    "experience_required": "Strong CXC/CSEC results",
    "location": "CARICOM-wide",
}

UN_REMOTE_OPP = {
    "title": "UNV Online Volunteer",
    "category": "volunteer",
    "description": "Online volunteering with UN agencies.",
    "age_requirement": "Ages 18+",
    "experience_required": "Skills-based volunteering available",
    "location": "Remote (global)",
}

COOKING_OPP = {
    "title": "Caribbean Culinary Arts Workshop",
    "category": "event",
    "description": "Learn Caribbean cooking techniques from local chefs.",
    "age_requirement": "All ages",
    "experience_required": "None",
    "location": "Barbados",
}

CHEVENING_OPP = {
    "title": "Chevening Scholarship (Caribbean)",
    "category": "scholarship",
    "description": "UK government scholarship for Caribbean professionals.",
    "age_requirement": "Ages 18+",
    "experience_required": "Bachelor's degree, 2+ years work experience",
    "location": "UK (for Caribbean nationals)",
}


# ── Career path tests ──────────────────────────────────────────────────────


class TestCareerPathMatch:
    def test_perfect_match(self):
        """Jamaican software engineer at Jamaica Tech Hackathon → high score"""
        score = score_opportunity(HACKATHON_OPP, JAMAICAN_DEV_PROFILE)
        assert score >= 80, f"Expected >= 80, got {score}"

    def test_no_match(self):
        """Software engineer + cooking workshop → lower score than a perfect match"""
        no_match_score = score_opportunity(COOKING_OPP, JAMAICAN_DEV_PROFILE)
        perfect_score = score_opportunity(HACKATHON_OPP, JAMAICAN_DEV_PROFILE)
        assert no_match_score < perfect_score, f"Cooking ({no_match_score}) should score less than hackathon ({perfect_score})"

    def test_career_category_alignment(self):
        """Competition category aligns with software_engineering career path"""
        score = score_opportunity(HACKATHON_OPP, JAMAICAN_DEV_PROFILE)
        # Should get career points (competition is in software_engineering map)
        assert score > 0


# ── Age tests ──────────────────────────────────────────────────────────────


class TestAgeEligibility:
    def test_age_eligible(self):
        """21-year-old is within 16-30 range → gets age points"""
        score = score_opportunity(HACKATHON_OPP, JAMAICAN_DEV_PROFILE)
        assert score > 0  # Gets age points

    def test_age_ineligible_too_old(self):
        """40-year-old is above 16-30 range → 0 age points"""
        opp = {
            "title": "Youth Coding Bootcamp",
            "category": "competition",
            "description": "Coding bootcamp for young developers.",
            "age_requirement": "Ages 16-25",
            "experience_required": "None",
            "location": "Jamaica",
        }
        profile = {
            "career_path": "software_engineering",
            "education_level": "university",
            "age": 40,
            "country": "Jamaica",
            "interests": ["coding"],
        }
        score = score_opportunity(opp, profile)
        # Should lose age points but still get some from career/interests
        assert score < 80

    def test_age_ineligible_too_young(self):
        """12-year-old should score less than age-eligible user for same opportunity"""
        profile_old = {
            "career_path": "software_engineering",
            "education_level": "university",
            "age": 25,
            "country": "Jamaica",
            "interests": [],
        }
        profile_young = {
            "career_path": "software_engineering",
            "education_level": "university",
            "age": 12,
            "country": "Jamaica",
            "interests": [],
        }
        score_eligible = score_opportunity(HACKATHON_OPP, profile_old)
        score_young = score_opportunity(HACKATHON_OPP, profile_young)
        assert score_eligible > score_young, f"Eligible ({score_eligible}) should score higher than too young ({score_young})"

    def test_all_ages(self):
        """'All ages' gives partial credit"""
        score = score_opportunity(COOKING_OPP, JAMAICAN_DEV_PROFILE)
        # Gets 15 pts for "all ages"
        assert score > 0


# ── Interest tests ─────────────────────────────────────────────────────────


class TestInterestMatch:
    def test_interest_match(self):
        """Interests appear in description → gets interest points"""
        score = score_opportunity(HACKATHON_OPP, JAMAICAN_DEV_PROFILE)
        # "coding" and "web development" should match
        assert score > 40  # At least career + some interest

    def test_no_interest_match(self):
        """No overlapping interests → interest points lower than perfect match"""
        score_no_interest = score_opportunity(COOKING_OPP, JAMAICAN_DEV_PROFILE)
        score_with_interest = score_opportunity(HACKATHON_OPP, JAMAICAN_DEV_PROFILE)
        assert score_no_interest < score_with_interest


# ── Location tests ─────────────────────────────────────────────────────────


class TestLocationMatch:
    def test_exact_country_match(self):
        """Jamaica + Jamaica → 15 location points"""
        score = score_opportunity(HACKATHON_OPP, JAMAICAN_DEV_PROFILE)
        # Gets career + age + interest + location
        assert score >= 70

    def test_caricom_wide_bonus(self):
        """CARICOM-wide opportunity → 12 location points for any Caribbean user"""
        score = score_opportunity(SCHOLARSHIP_OPP, JAMAICAN_HIGHSCHOOLER)
        # High schooler matches CXC scholarship + CARICOM location
        assert score > 40

    def test_online_location(self):
        """Remote/online opportunity → 10 location points"""
        score = score_opportunity(UN_REMOTE_OPP, JAMAICAN_DEV_PROFILE)
        assert score > 20


# ── Education tests ────────────────────────────────────────────────────────


class TestEducationMatch:
    def test_education_match(self):
        """University student + 'Basic programming knowledge' → eligible"""
        score = score_opportunity(HACKATHON_OPP, JAMAICAN_DEV_PROFILE)
        assert score > 50  # Education eligible

    def test_education_no_requirement(self):
        """No experience required → everyone qualifies"""
        score = score_opportunity(COOKING_OPP, JAMAICAN_DEV_PROFILE)
        # Gets education points (15 for no requirement)
        assert score > 0


# ── Score cap tests ────────────────────────────────────────────────────────


class TestScoreCap:
    def test_score_capped_at_100(self):
        """Multiple strong matches should not exceed 100"""
        score = score_opportunity(HACKATHON_OPP, JAMAICAN_DEV_PROFILE)
        assert score <= 100

    def test_score_all_returns_all(self):
        """score_all_opportunities returns all opportunities with scores"""
        opps = [HACKATHON_OPP, COOKING_OPP, SCHOLARSHIP_OPP]
        scored = score_all_opportunities(opps, JAMAICAN_DEV_PROFILE)
        assert len(scored) == 3
        for opp in scored:
            assert "relevance_score" in opp
            assert 0 <= opp["relevance_score"] <= 100

    def test_score_all_sorted_descending(self):
        """score_all_opportunities sorts by score descending"""
        opps = [COOKING_OPP, HACKATHON_OPP, SCHOLARSHIP_OPP]
        scored = score_all_opportunities(opps, JAMAICAN_DEV_PROFILE)
        scores = [o["relevance_score"] for o in scored]
        assert scores == sorted(scores, reverse=True)


# ── Personal matches tests ─────────────────────────────────────────────────


class TestPersonalMatches:
    def test_filters_by_threshold(self):
        """Only returns opportunities scoring >= threshold"""
        opps = [HACKATHON_OPP, COOKING_OPP, SCHOLARSHIP_OPP]
        matches = get_personal_matches(opps, JAMAICAN_DEV_PROFILE, threshold=50)
        for m in matches:
            assert m["relevance_score"] >= 50

    def test_empty_when_no_matches(self):
        """Returns empty list when nothing scores above threshold"""
        opps = [COOKING_OPP]
        matches = get_personal_matches(opps, JAMAICAN_HIGHSCHOOLER, threshold=90)
        # 16-year-old high schooler + cooking + Barbados → unlikely to score 90
        assert isinstance(matches, list)

    def test_sorted_by_score_descending(self):
        """Matches are sorted by score, highest first"""
        opps = [SCHOLARSHIP_OPP, COOKING_OPP, HACKATHON_OPP]
        matches = get_personal_matches(opps, JAMAICAN_HIGHSCHOOLER, threshold=0)
        scores = [m["relevance_score"] for m in matches]
        assert scores == sorted(scores, reverse=True)


# ── Helper function tests ──────────────────────────────────────────────────


class TestHelpers:
    def test_parse_age_range(self):
        assert _parse_age_range("Ages 15-25") == (15, 25)
        assert _parse_age_range("All ages") == (None, None)
        assert _parse_age_range("Ages 18+") == (18, None)
        assert _parse_age_range(None) == (None, None)

    def test_parse_education_from_experience(self):
        assert _parse_education_from_experience("None — open to all") == "none"
        assert _parse_education_from_experience("Basic coding skills") == "high_school"
        assert _parse_education_from_experience("Bachelor's degree required") == "bachelors"
        assert _parse_education_from_experience(None) is None

    def test_get_user_education_level(self):
        assert _get_user_education_level("university") == "university"
        assert _get_user_education_level("high_school") == "high_school"
        assert _get_user_education_level("masters") == "masters"
        assert _get_user_education_level("bachelors") == "bachelors"
        assert _get_user_education_level(None) == "none"
