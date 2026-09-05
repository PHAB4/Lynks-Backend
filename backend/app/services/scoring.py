"""
Rule-based opportunity scoring engine.

Matches opportunities to users based on:
- Career path alignment (30 pts)
- Education level fit (20 pts)
- Age eligibility (20 pts)
- Interest overlap (15 pts)
- Location match (15 pts)

Total: 0–100. No LLM dependency.
"""
from __future__ import annotations

import logging

logger = logging.getLogger(__name__)

# ── Weight constants ───────────────────────────────────────────────────────

WEIGHT_CAREER = 30
WEIGHT_EDUCATION = 20
WEIGHT_AGE = 20
WEIGHT_INTEREST = 15
WEIGHT_LOCATION = 15
TOTAL_MAX = 100

# Minimum score to be considered a "match"
MATCH_THRESHOLD = 50

# ── Career path → category mapping ─────────────────────────────────────────

CAREER_CATEGORY_MAP: dict[str, set[str]] = {
    "software_engineering": {"competition", "job", "club", "scholarship"},
    "web_development": {"competition", "job", "club", "event"},
    "data_science": {"competition", "scholarship", "club", "event"},
    "cybersecurity": {"competition", "job", "club", "event"},
    "artificial_intelligence": {"competition", "scholarship", "club", "event"},
    "business": {"competition", "scholarship", "volunteer", "job"},
    "entrepreneurship": {"competition", "club", "volunteer", "event"},
    "design": {"competition", "club", "event", "job"},
    "finance": {"job", "scholarship", "event", "competition"},
    "education": {"volunteer", "scholarship", "event", "job"},
    "engineering": {"competition", "job", "scholarship", "event"},
    "healthcare": {"volunteer", "scholarship", "job", "event"},
    "marketing": {"job", "club", "event", "competition"},
}

# Keywords that link career paths to opportunity descriptions
CAREER_KEYWORDS: dict[str, list[str]] = {
    "software_engineering": ["coding", "programming", "developer", "software", "tech", "hackathon", "app"],
    "web_development": ["web", "frontend", "backend", "fullstack", "html", "javascript", "react"],
    "data_science": ["data", "analytics", "machine learning", "statistics", "python"],
    "cybersecurity": ["security", "cyber", "encryption", "hacking", "network"],
    "artificial_intelligence": ["ai", "artificial intelligence", "machine learning", "neural", "llm", "deep learning"],
    "business": ["business", "management", "leadership", "mba", "startup"],
    "entrepreneurship": ["entrepreneur", "startup", "founder", "innovation", "venture"],
    "design": ["design", "ux", "ui", "creative", "figma", "prototype"],
    "finance": ["finance", "banking", "investment", "accounting", "fintech"],
    "education": ["teaching", "education", "training", "mentorship", "learning"],
    "engineering": ["engineering", "robotics", "stem", "technical", "manufacturing"],
    "healthcare": ["health", "medical", "nursing", "pharmacy", "public health"],
    "marketing": ["marketing", "social media", "branding", "advertising", "content"],
}

# ── Education level hierarchy ──────────────────────────────────────────────

EDUCATION_HIERARCHY: dict[str, int] = {
    "none": 0,
    "high_school": 1,
    "some_university": 2,
    "university": 3,
    "bachelors": 3,
    "masters": 4,
    "phd": 5,
    "postdoctoral": 6,
}

# Maps experience_required text to minimum education level needed
EXPERIENCE_EDUCATION_MAP: dict[str, str] = {
    "none": "none",
    "open to all": "none",
    "no experience": "none",
    "basic": "high_school",
    "interest": "none",
    "self-motivated": "none",
    "enrolled": "high_school",
    "high school": "high_school",
    "bachelor": "bachelors",
    "university": "bachelors",
    "degree": "bachelors",
    "graduate": "masters",
    "2+ years": "bachelors",
    "work experience": "bachelors",
    "professional": "bachelors",
}

# ── CARICOM countries ──────────────────────────────────────────────────────

CARICOM_COUNTRIES: set[str] = {
    "antigua and barbuda", "bahamas", "barbados", "belize", "dominica",
    "grenada", "guyana", "haiti", "jamaica", "montserrat",
    "saint kitts and nevis", "saint lucia", "saint vincent and the grenadines",
    "suriname", "trinidad and tobago",
}


def _parse_age_range(age_req: str | None) -> tuple[int | None, int | None]:
    """Extract min and max age from an age requirement string.

    Examples:
        "Ages 15-25" -> (15, 25)
        "High school students (ages 13-19)" -> (13, 19)
        "All ages" -> (None, None)
        "University students" -> (None, None)
    """
    if not age_req:
        return None, None

    lower = age_req.lower()
    if "all ages" in lower:
        return None, None

    # Try to find "ages X-Y" or "age X-Y"
    numbers = []
    words = lower.replace("-", " ").replace("–", " ").split()
    for word in words:
        cleaned = word.strip("().,+")
        if cleaned.isdigit():
            numbers.append(int(cleaned))

    if len(numbers) >= 2:
        return numbers[0], numbers[1]
    if len(numbers) == 1:
        # "ages 18+" or just a single number
        if "+" in lower:
            return numbers[0], None
        return numbers[0], numbers[0]

    # Try "university students" or "high school students" as age hints
    if "university" in lower or "graduate" in lower:
        return 18, None
    if "high school" in lower:
        return 13, 19

    return None, None


def _parse_education_from_experience(experience: str | None) -> str | None:
    """Infer minimum education level from experience_required text."""
    if not experience:
        return None

    lower = experience.lower()

    # Check from most specific to least
    for keyword, level in sorted(EXPERIENCE_EDUCATION_MAP.items(), key=lambda x: -len(x[0])):
        if keyword in lower:
            return level

    return None


def _get_user_education_level(education: str | None) -> str:
    """Normalize user education level to our hierarchy key."""
    if not education:
        return "none"

    lower = education.lower().strip()
    # Direct match
    if lower in EDUCATION_HIERARCHY:
        return lower

    # Partial matches
    if "phd" in lower or "doctoral" in lower:
        return "phd"
    if "master" in lower:
        return "masters"
    if "bachelor" in lower or "university" in lower or "degree" in lower:
        return "bachelors"
    if "high school" in lower or "secondary" in lower:
        return "high_school"
    if "some" in lower and ("university" in lower or "college" in lower):
        return "some_university"

    return "none"


def _normalize_country(country: str | None) -> str:
    """Normalize country name for comparison."""
    if not country:
        return ""
    return country.lower().strip()


def score_opportunity(opportunity: dict, profile: dict) -> int:
    """Score an opportunity against a user profile. Returns 0-100.

    Args:
        opportunity: dict with title, category, description, age_requirement,
                     experience_required, location fields
        profile: dict with career_path, education_level, age, country, interests
    """
    score = 0

    # ── 1. Career path match (30 pts) ──────────────────────────────────
    career_path = (profile.get("career_path") or "").lower()
    category = (opportunity.get("category") or "").lower()
    description = (opportunity.get("description") or "").lower()
    title = (opportunity.get("title") or "").lower()

    if career_path:
        # Category alignment: does this opportunity type match the career path?
        aligned_categories = CAREER_CATEGORY_MAP.get(career_path, set())
        if category in aligned_categories:
            score += 20

        # Keyword match: do career keywords appear in the opportunity?
        keywords = CAREER_KEYWORDS.get(career_path, [])
        combined_text = f"{title} {description}"
        keyword_hits = sum(1 for kw in keywords if kw.lower() in combined_text)
        if keyword_hits > 0:
            score += min(keyword_hits * 5, 10)

    # ── 2. Education level fit (20 pts) ────────────────────────────────
    user_edu = _get_user_education_level(profile.get("education_level"))
    required_edu = _parse_education_from_experience(opportunity.get("experience_required"))

    if required_edu is None:
        # No education requirement = everyone qualifies
        score += 15
    elif user_edu != "none":
        user_level = EDUCATION_HIERARCHY.get(user_edu, 0)
        required_level = EDUCATION_HIERARCHY.get(required_edu, 0)
        if user_level >= required_level:
            score += 20
        elif user_level == required_level - 1:
            # Close enough (e.g., some_university vs bachelors)
            score += 10

    # ── 3. Age eligibility (20 pts) ────────────────────────────────────
    user_age = profile.get("age")
    min_age, max_age = _parse_age_range(opportunity.get("age_requirement"))

    if min_age is None and max_age is None:
        # No age requirement or "all ages"
        score += 15
    elif user_age is not None:
        min_check = min_age or 0
        max_check = max_age or 999
        if min_check <= user_age <= max_check:
            score += 20
    else:
        # No age in profile — give partial credit
        score += 10

    # ── 4. Interest alignment (15 pts) ─────────────────────────────────
    user_interests = [i.lower() for i in (profile.get("interests") or [])]
    combined_text = f"{title} {description}"

    if user_interests:
        matches = sum(1 for interest in user_interests if interest in combined_text)
        score += min(matches * 5, 15)
    # No interests in profile = no points, no penalty

    # ── 5. Location match (15 pts) ─────────────────────────────────────
    user_country = _normalize_country(profile.get("country"))
    opp_location = _normalize_country(opportunity.get("location") or "")

    if user_country and opp_location:
        # Exact country match
        if user_country in opp_location or opp_location in user_country:
            score += 15
        # CARICOM-wide (bonus for all Caribbean users)
        elif "caricom" in opp_location:
            score += 12
        # Online / Remote
        elif "online" in opp_location or "remote" in opp_location:
            score += 10
        # User's country is in CARICOM and opportunity is in a CARICOM country
        elif user_country in CARICOM_COUNTRIES:
            # Check if the opportunity location mentions any CARICOM country
            for cc in CARICOM_COUNTRIES:
                if cc in opp_location:
                    score += 8
                    break

    return min(score, TOTAL_MAX)


def get_personal_matches(
    opportunities: list[dict],
    profile: dict,
    threshold: int = MATCH_THRESHOLD,
) -> list[dict]:
    """Score all opportunities and return those above the threshold, sorted by score.

    Each opportunity dict gets a 'relevance_score' field added.

    Args:
        opportunities: list of opportunity dicts
        profile: user profile dict
        threshold: minimum score to be included (default 50)

    Returns:
        list of opportunity dicts with relevance_score, sorted descending
    """
    scored = []
    for opp in opportunities:
        opp_score = score_opportunity(opp, profile)
        opp_with_score = {**opp, "relevance_score": opp_score}
        scored.append(opp_with_score)

    # Filter to threshold and sort by score descending
    matches = [o for o in scored if o["relevance_score"] >= threshold]
    matches.sort(key=lambda o: o["relevance_score"], reverse=True)

    return matches


def score_all_opportunities(
    opportunities: list[dict],
    profile: dict,
) -> list[dict]:
    """Score all opportunities and return them sorted by score (descending).

    Unlike get_personal_matches, this returns ALL opportunities regardless of
    threshold — useful for the main /opportunities endpoint.

    Each opportunity dict gets a 'relevance_score' field added.
    """
    scored = []
    for opp in opportunities:
        opp_score = score_opportunity(opp, profile)
        scored.append({**opp, "relevance_score": opp_score})

    scored.sort(key=lambda o: o["relevance_score"], reverse=True)
    return scored
