"""
Job Scout Agent — discovers Caribbean-relevant opportunities for users.

Sources (all free, no API keys needed for most):
  1. Curated Caribbean opportunities database (local clubs, competitions, events)
  2. Opportunity scraper (Devpost, Eventbrite, RSS, social media)
  3. LLM-powered recommendation from user profile

Flow:
  1. Load user profile (career_path, age, country, education_level)
  2. Query relevant opportunities from multiple sources
  3. Use LLM to filter and rank by relevance to the user
  4. Return structured opportunity objects matching API_CONTRACT.md

Caribbean focus:
  - Opportunities are tagged by country/region (CARICOM-wide, Jamaica, Barbados, etc.)
  - Age-appropriate filtering (high school vs. university vs. early career)
  - Includes non-traditional opportunities: clubs, competitions, workshops, volunteering
"""

from __future__ import annotations

import json
import logging
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from openai import APIError as OpenAIError, OpenAI
from sqlalchemy import func, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.db_models import User

logger = logging.getLogger(__name__)


# ── Opportunity dataclass ──────────────────────────────────────────────────


@dataclass
class Opportunity:
    id: str
    title: str
    company: str
    location: str
    pay: str
    age_requirement: str | None
    experience_required: str
    url: str
    category: str  # job, club, competition, scholarship, event, volunteer
    source: str    # local_db, llm_generated, devpost_api, etc.
    # New fields
    description: str = ""
    salary_min: float | None = None
    salary_max: float | None = None
    salary_currency: str | None = None
    posted_at: str | None = None
    first_seen_at: str | None = None
    source_name: str = "curated"
    image_url: str | None = None


# ── Helpers ────────────────────────────────────────────────────────────────


def get_timeframe_cutoff(timeframe: str) -> datetime:
    """Return the cutoff datetime for a timeframe filter."""
    now = datetime.now(timezone.utc)
    match timeframe:
        case "day":
            return now - timedelta(days=1)
        case "week":
            return now - timedelta(weeks=1)
        case "month":
            return now - timedelta(days=30)
        case "quarter":
            return now - timedelta(days=90)
        case "all" | _:
            return datetime.min.replace(tzinfo=timezone.utc)


def _parse_posted_at(posted_at: str | None) -> datetime | None:
    """Parse an ISO date string to datetime for comparison."""
    if not posted_at:
        return None
    try:
        return datetime.fromisoformat(posted_at.replace("Z", "+00:00"))
    except (ValueError, AttributeError):
        return None


# ── Curated Caribbean opportunities database ───────────────────────────────

CARIBBEAN_OPPORTUNITIES: list[dict] = [
    # ── Competitions ───────────────────────────────────────────────────────
    {
        "title": "Jamaica National Science Olympiad",
        "company": "Jamaica Science Teachers' Association",
        "location": "Jamaica",
        "pay": "Free to enter",
        "age_requirement": "High school students (ages 13-19)",
        "experience_required": "None — open to all high school students",
        "url": "https://jamaicaletters.com",
        "category": "competition",
        "description": "Annual science competition for Jamaican high school students.",
        "salary_min": None,
        "salary_max": None,
        "salary_currency": None,
    },
    {
        "title": "Caribbean Computing Challenge (CCC)",
        "company": "Caribbean Examination Council",
        "location": "CARICOM-wide",
        "pay": "Free to enter",
        "age_requirement": "High school students",
        "experience_required": "None — introductory level problems provided",
        "url": "https://cxc.org",
        "category": "competition",
        "description": "Programming competition for Caribbean high school students.",
        "salary_min": None,
        "salary_max": None,
        "salary_currency": None,
    },
    {
        "title": "Digicel Foundation Bright Stars Challenge",
        "company": "Digicel Foundation",
        "location": "CARICOM-wide",
        "pay": "Funding for winning projects",
        "age_requirement": "Youth ages 15-25",
        "experience_required": "Social impact project idea",
        "url": "https://digicelfoundation.com",
        "category": "competition",
        "description": "Youth entrepreneurship challenge supporting social impact projects.",
        "salary_min": None,
        "salary_max": None,
        "salary_currency": None,
    },
    {
        "title": "Hackathon Caribbean",
        "company": "Community-organized",
        "location": "Various Caribbean countries",
        "pay": "Free to enter, prizes for winners",
        "age_requirement": "Ages 16+",
        "experience_required": "Basic coding skills recommended",
        "url": "https://devpost.com",
        "category": "competition",
        "description": "Regional hackathon bringing together Caribbean developers.",
        "salary_min": None,
        "salary_max": None,
        "salary_currency": None,
    },
    {
        "title": "Jamaica Tech Hackathon",
        "company": "Jamaica Innovation Hub",
        "location": "Jamaica",
        "pay": "Prizes for top 3 teams",
        "age_requirement": "Ages 16-30",
        "experience_required": "Basic programming knowledge",
        "url": "https://devpost.com",
        "category": "competition",
        "description": "Annual hackathon in Jamaica focused on local tech solutions.",
        "salary_min": None,
        "salary_max": None,
        "salary_currency": None,
    },
    {
        "title": "Trinidad & Tobago Game Jam",
        "company": "TT Game Developers Association",
        "location": "Trinidad and Tobago",
        "pay": "Free to enter",
        "age_requirement": "All ages",
        "experience_required": "Interest in game development",
        "url": "https://itch.io/jams",
        "category": "competition",
        "description": "Game development competition for T&T game creators.",
        "salary_min": None,
        "salary_max": None,
        "salary_currency": None,
    },
    {
        "title": "Barbados Robotics Challenge",
        "company": "Barbados Robotics Club",
        "location": "Barbados",
        "pay": "Prizes and sponsorships",
        "age_requirement": "Ages 14-25",
        "experience_required": "Interest in robotics/engineering",
        "url": "",
        "category": "competition",
        "description": "Robotics competition for young Barbadians.",
        "salary_min": None,
        "salary_max": None,
        "salary_currency": None,
    },
    # ── Clubs & Organizations ─────────────────────────────────────────────
    {
        "title": "UWI Coding Club",
        "company": "University of the West Indies",
        "location": "UWI campuses (Jamaica, Barbados, Trinidad)",
        "pay": "Free",
        "age_requirement": "University students",
        "experience_required": "None",
        "url": "https://uwi.edu",
        "category": "club",
        "description": "Student-led coding club at UWI.",
        "salary_min": None,
        "salary_max": None,
        "salary_currency": None,
    },
    {
        "title": "Caribbean AI & Data Science Community",
        "company": "Community-run",
        "location": "Online (Caribbean-based)",
        "pay": "Free",
        "age_requirement": "Ages 16+",
        "experience_required": "Interest in AI/data science",
        "url": "https://www.linkedin.com/groups",
        "category": "club",
        "description": "Online community for Caribbean AI/data science enthusiasts.",
        "salary_min": None,
        "salary_max": None,
        "salary_currency": None,
    },
    {
        "title": "Girl Geek Dinner Caribbean",
        "company": "Girl Geek Dinner",
        "location": "Various Caribbean cities",
        "pay": "Free",
        "age_requirement": "Women and non-binary in tech",
        "experience_required": "None",
        "url": "https://girlgeekdinner.com",
        "category": "club",
        "description": "Networking events for women in Caribbean tech.",
        "salary_min": None,
        "salary_max": None,
        "salary_currency": None,
    },
    {
        "title": "Jamaica Developers Community",
        "company": "Jamaica Tech Community",
        "location": "Jamaica (Kingston, Montego Bay)",
        "pay": "Free",
        "age_requirement": "Ages 16+",
        "experience_required": "Interest in software development",
        "url": "https://www.meetup.com",
        "category": "club",
        "description": "Developer meetup group for Jamaican software engineers.",
        "salary_min": None,
        "salary_max": None,
        "salary_currency": None,
    },
    {
        "title": "Barbados Innovation Hub",
        "company": "Barbados Entrepreneurship Foundation",
        "location": "Barbados",
        "pay": "Free membership",
        "age_requirement": "Ages 18-35",
        "experience_required": "Interest in entrepreneurship",
        "url": "",
        "category": "club",
        "description": "Innovation hub for young Barbadian entrepreneurs.",
        "salary_min": None,
        "salary_max": None,
        "salary_currency": None,
    },
    {
        "title": "Trinidad Youth in Tech",
        "company": "TT Ministry of Digital Transformation",
        "location": "Trinidad and Tobago",
        "pay": "Free",
        "age_requirement": "Ages 15-25",
        "experience_required": "None",
        "url": "https://www.mdt.gov.tt",
        "category": "club",
        "description": "Government initiative connecting young Trinidadians with tech.",
        "salary_min": None,
        "salary_max": None,
        "salary_currency": None,
    },
    # ── Scholarships ──────────────────────────────────────────────────────
    {
        "title": "CXC/CSEC Scholarships",
        "company": "Caribbean Examination Council",
        "location": "CARICOM-wide",
        "pay": "Full tuition scholarship",
        "age_requirement": "High school graduates",
        "experience_required": "Strong CXC/CSEC results",
        "url": "https://cxc.org",
        "category": "scholarship",
        "description": "Merit-based scholarships for Caribbean students.",
        "salary_min": None,
        "salary_max": None,
        "salary_currency": None,
    },
    {
        "title": "Chevening Scholarship (Caribbean)",
        "company": "UK Government",
        "location": "UK (for Caribbean nationals)",
        "pay": "Full funding for UK Master's degree",
        "age_requirement": "Ages 18+",
        "experience_required": "Bachelor's degree, 2+ years work experience",
        "url": "https://chevening.org",
        "category": "scholarship",
        "description": "UK government scholarship for Caribbean professionals.",
        "salary_min": None,
        "salary_max": None,
        "salary_currency": None,
    },
    {
        "title": "AASD Scholarship Program",
        "company": "African Academy of Sciences",
        "location": "International (Caribbean eligible)",
        "pay": "Variable",
        "age_requirement": "Graduate students",
        "experience_required": "Bachelor's degree in STEM",
        "url": "https://aasciences.africa",
        "category": "scholarship",
        "description": "STEM scholarship for graduate students.",
        "salary_min": None,
        "salary_max": None,
        "salary_currency": None,
    },
    {
        "title": "MIT OpenCourseWare Scholarship",
        "company": "MIT",
        "location": "Online (global)",
        "pay": "Free access to courses, certificates available",
        "age_requirement": "All ages",
        "experience_required": "Self-motivated learners",
        "url": "https://ocw.mit.edu",
        "category": "scholarship",
        "description": "Free access to MIT course materials.",
        "salary_min": None,
        "salary_max": None,
        "salary_currency": None,
    },
    {
        "title": "Google Generation Scholarship (Caribbean)",
        "company": "Google",
        "location": "Remote / Caribbean",
        "pay": "$10,000 USD scholarship",
        "age_requirement": "University students in STEM",
        "experience_required": "Enrolled in CS or related field",
        "url": "https://buildyourfuture.withgoogle.com/scholarships",
        "category": "scholarship",
        "description": "Google scholarship for underrepresented CS students.",
        "salary_min": 10000,
        "salary_max": 10000,
        "salary_currency": "USD",
    },
    {
        "title": "Coursera Financial Aid",
        "company": "Coursera",
        "location": "Online (global)",
        "pay": "Free courses with financial aid",
        "age_requirement": "All ages",
        "experience_required": "None",
        "url": "https://www.coursera.org/financial-aid",
        "category": "scholarship",
        "description": "Financial aid for Coursera courses.",
        "salary_min": None,
        "salary_max": None,
        "salary_currency": None,
    },
    # ── Events & Workshops ────────────────────────────────────────────────
    {
        "title": "Caribbean Tech Week",
        "company": "Community-organized",
        "location": "Various Caribbean cities",
        "pay": "Free / low-cost tickets",
        "age_requirement": "All ages",
        "experience_required": "Interest in technology",
        "url": "https://twitter.com/search?q=caribbean+tech+week",
        "category": "event",
        "description": "Annual week of tech events and networking across the Caribbean.",
        "salary_min": None,
        "salary_max": None,
        "salary_currency": None,
    },
    {
        "title": "WIPO Hackathon for IP (Caribbean Edition)",
        "company": "World Intellectual Property Organization",
        "location": "Online / Caribbean hubs",
        "pay": "Free to enter, prizes",
        "age_requirement": "Ages 18-35",
        "experience_required": "Innovation or business idea",
        "url": "https://wipo.int",
        "category": "event",
        "description": "Global IP hackathon with Caribbean track.",
        "salary_min": None,
        "salary_max": None,
        "salary_currency": None,
    },
    {
        "title": "Jamaica UX Design Workshop",
        "company": "Jamaica Design Association",
        "location": "Jamaica",
        "pay": "Free workshop",
        "age_requirement": "Ages 16+",
        "experience_required": "Interest in design",
        "url": "",
        "category": "event",
        "description": "Hands-on UX design workshop in Jamaica.",
        "salary_min": None,
        "salary_max": None,
        "salary_currency": None,
    },
    {
        "title": "Caribbean Data Science Bootcamp",
        "company": "Data Caribbean",
        "location": "Online / Jamaica",
        "pay": "Subsidized for Caribbean residents",
        "age_requirement": "Ages 18+",
        "experience_required": "Basic Python knowledge",
        "url": "",
        "category": "event",
        "description": "Intensive data science bootcamp for Caribbean participants.",
        "salary_min": None,
        "salary_max": None,
        "salary_currency": None,
    },
    {
        "title": "Barbados Fintech Summit",
        "company": "Barbados Fintech Association",
        "location": "Barbados",
        "pay": "Free for students",
        "age_requirement": "All ages",
        "experience_required": "Interest in fintech",
        "url": "",
        "category": "event",
        "description": "Annual fintech summit in Barbados.",
        "salary_min": None,
        "salary_max": None,
        "salary_currency": None,
    },
    # ── Volunteer / Internship ────────────────────────────────────────────
    {
        "title": "UNV Online Volunteer",
        "company": "United Nations Volunteers",
        "location": "Remote (global)",
        "pay": "Volunteer (unpaid)",
        "age_requirement": "Ages 18+",
        "experience_required": "Skills-based volunteering available",
        "url": "https://onlinevolunteering.org",
        "category": "volunteer",
        "description": "Online volunteering with UN agencies.",
        "salary_min": None,
        "salary_max": None,
        "salary_currency": None,
    },
    {
        "title": "Code for the Caribbean Fellowship",
        "company": "Code for the Caribbean",
        "location": "Caribbean (various countries)",
        "pay": "Fellowship stipend",
        "age_requirement": "Ages 18-30",
        "experience_required": "Basic coding skills",
        "url": "https://codeforthecaribbean.org",
        "category": "volunteer",
        "description": "Fellowship placing developers with Caribbean government agencies.",
        "salary_min": None,
        "salary_max": None,
        "salary_currency": None,
    },
    {
        "title": "Teach For Jamaica",
        "company": "Teach For All",
        "location": "Jamaica",
        "pay": "Teaching stipend",
        "age_requirement": "University graduates",
        "experience_required": "Bachelor's degree",
        "url": "https://teachforall.org",
        "category": "volunteer",
        "description": "Teaching fellowship in underserved Jamaican schools.",
        "salary_min": None,
        "salary_max": None,
        "salary_currency": None,
    },
    {
        "title": "Peace Corps Caribbean",
        "company": "Peace Corps",
        "location": "Dominican Republic, Jamaica, Guyana",
        "pay": "Living stipend + readjustment allowance",
        "age_requirement": "Ages 18-34",
        "experience_required": "Bachelor's degree preferred",
        "url": "https://peacecorps.gov",
        "category": "volunteer",
        "description": "Peace Corps service in Caribbean countries.",
        "salary_min": None,
        "salary_max": None,
        "salary_currency": None,
    },
    {
        "title": "Caribbean Red Cross Youth Volunteer",
        "company": "International Red Cross",
        "location": "CARICOM-wide",
        "pay": "Volunteer (unpaid)",
        "age_requirement": "Ages 15-30",
        "experience_required": "None",
        "url": "https://icrc.org",
        "category": "volunteer",
        "description": "Youth volunteering with Red Cross societies across the Caribbean.",
        "salary_min": None,
        "salary_max": None,
        "salary_currency": None,
    },
    {
        "title": "Digital Jobs Africa (Caribbean Remote)",
        "company": "Global Innovation Fund",
        "location": "Remote",
        "pay": "Paid remote work",
        "age_requirement": "Ages 18-35",
        "experience_required": "Digital skills (design, dev, content)",
        "url": "",
        "category": "job",
        "description": "Remote digital work opportunities for Caribbean youth.",
        "salary_min": None,
        "salary_max": None,
        "salary_currency": None,
    },
]


# ── LLM-powered opportunity matching ──────────────────────────────────────

SYSTEM_PROMPT = """\
You are the Job Scout for Lynks — a Caribbean career platform for young people.

Your job: given a user's profile and a list of available opportunities, select and
rank the opportunities most relevant to them.

Context about the user:
- They are in the Caribbean
- They may be a high school student, university student, or early-career professional
- Opportunities should be age-appropriate and relevant to their career path
- Include a mix of types: jobs, clubs, competitions, scholarships, events

Rules:
1. Return 5-10 of the most relevant opportunities
2. Include at least one non-job opportunity (club, competition, or event)
3. All opportunities must be accessible to someone in their country
4. Return the full opportunity object as provided (do not fabricate URLs)
5. Return a JSON array of opportunity objects
6. Return ONLY valid JSON — no markdown fences, no commentary
"""


def match_opportunities_with_llm(
    profile: dict,
    opportunities: list[dict],
) -> list[dict]:
    """Use LLM to filter and rank opportunities for a specific user.

    Falls back to returning the first N opportunities directly if the LLM
    call fails or times out, so the endpoint never hangs.
    """
    prompt_pool = opportunities[:15]

    try:
        client = OpenAI(
            api_key=settings.LLM_API_KEY,
            base_url=settings.LLM_API_BASE_URL,
            timeout=15.0,
        )

        user_message = (
            f"User profile:\n{json.dumps(profile, indent=2)}\n\n"
            f"Available opportunities:\n{json.dumps(prompt_pool, indent=2)}\n\n"
            "Select and rank the 5-10 most relevant opportunities for this user. "
            "Return a JSON array of the full opportunity objects."
        )

        response = client.chat.completions.create(
            model=settings.LLM_MODEL,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_message},
            ],
            temperature=0.4,
            max_tokens=4096,
        )

        raw_content = response.choices[0].message.content.strip()

        if raw_content.startswith("```"):
            lines = raw_content.split("\n")
            lines = lines[1:]
            if lines and lines[-1].strip() == "```":
                lines = lines[:-1]
            raw_content = "\n".join(lines)

        data = json.loads(raw_content)

        if isinstance(data, list):
            return data
        if isinstance(data, dict) and "opportunities" in data:
            return data["opportunities"]
        return opportunities[:8]

    except (OpenAIError, json.JSONDecodeError) as e:
        logger.warning("LLM opportunity matching failed, returning curated list: %s", e)
        return opportunities[:8]


# ── Saved opportunities helpers ───────────────────────────────────────────


async def get_saved_opportunity_ids(db: AsyncSession, user_id: str) -> set[str]:
    """Get the set of opportunity IDs that a user has saved."""
    try:
        from sqlalchemy import text
        result = await db.execute(
            text("SELECT opportunity_id FROM saved_opportunities WHERE user_id = :uid"),
            {"uid": user_id},
        )
        return {row[0] for row in result.fetchall()}
    except (SQLAlchemyError, AttributeError) as e:
        logger.warning("Could not query saved_opportunities: %s (table may not exist yet)", e)
        return set()


async def get_available_categories(db: AsyncSession) -> list[str]:
    """Get all unique categories from the curated list."""
    categories = set()
    for opp in CARIBBEAN_OPPORTUNITIES:
        categories.add(opp.get("category", "event"))
    return sorted(categories)


# ── New count helper ──────────────────────────────────────────────────────


async def get_new_count(db: AsyncSession) -> dict:
    """Count opportunities first seen in the last 24 hours.

    For now, counts from the curated list (which uses a static timestamp).
    In production, this would query the opportunities table.
    """
    # Since we're using a curated list (not a DB table), we return 0
    # Once the opportunities table is populated by the scraper,
    # this will query first_seen_at >= cutoff
    cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
    return {
        "new_count": 0,
        "new_since": cutoff.isoformat(),
    }


# ── Public API ──────────────────────────────────────────────────────────────


async def discover_opportunities(
    db: AsyncSession,
    user_id: str,
    category: str | None = None,
    timeframe: str | None = None,
    sort: str = "relevance",
    page: int = 1,
    limit: int = 20,
) -> dict:
    """
    Discover opportunities for a user with filtering, sorting, and pagination.

    1. Load user profile
    2. Filter curated database by category and timeframe
    3. Use LLM to rank and select the most relevant ones (if sort=relevance)
    4. Apply sort and pagination
    5. Attach is_saved flags
    6. Return results with metadata
    """
    user = await db.get(User, user_id)
    if not user:
        raise ValueError("user_not_found: no user with this ID")

    # Build profile for the LLM
    profile = {
        "career_path": user.career_path,
        "education_level": user.education_level,
        "age": user.age,
        "country": user.country,
        "interests": user.interests or [],
    }

    # Start with curated opportunities
    pool = list(CARIBBEAN_OPPORTUNITIES)

    # Filter by category if specified
    if category:
        pool = [o for o in pool if o["category"] == category]

    # Filter by timeframe if specified
    if timeframe:
        cutoff = get_timeframe_cutoff(timeframe)
        filtered = []
        for o in pool:
            posted = _parse_posted_at(o.get("posted_at"))
            if posted is None or posted >= cutoff:
                filtered.append(o)
        pool = filtered

    # Apply sorting
    if sort == "recent":
        pool.sort(key=lambda o: _parse_posted_at(o.get("posted_at")) or datetime.min.replace(tzinfo=timezone.utc), reverse=True)
    elif sort == "salary":
        pool.sort(key=lambda o: o.get("salary_max") or 0, reverse=True)
    else:
        # relevance — use LLM to rank
        matched = match_opportunities_with_llm(profile, pool)
        pool = matched

    # Get total before pagination
    total_available = len(pool)

    # Apply offset pagination
    start = (page - 1) * limit
    end = start + limit
    paginated = pool[start:end]

    # Get user's saved opportunity IDs
    saved_ids = await get_saved_opportunity_ids(db, user_id)

    # Build results with is_saved flag
    # Generate deterministic IDs based on title hash
    import hashlib

    results = []
    for opp in paginated:
        opp_id = hashlib.md5(opp["title"].encode()).hexdigest()[:16]
        results.append({
            "id": opp_id,
            "title": opp.get("title", "Unknown"),
            "company": opp.get("company", "Unknown"),
            "location": opp.get("location", "Caribbean"),
            "pay": opp.get("pay", "Varies"),
            "salary_min": opp.get("salary_min"),
            "salary_max": opp.get("salary_max"),
            "salary_currency": opp.get("salary_currency"),
            "age_requirement": opp.get("age_requirement"),
            "experience_required": opp.get("experience_required", "None"),
            "url": opp.get("url", ""),
            "category": opp.get("category", "event"),
            "description": opp.get("description", ""),
            "posted_at": opp.get("posted_at"),
            "first_seen_at": opp.get("first_seen_at"),
            "source_name": opp.get("source_name", "curated"),
            "image_url": opp.get("image_url"),
            "is_saved": opp_id in saved_ids,
            "relevance_score": opp.get("relevance_score"),
        })

    available_categories = await get_available_categories(db)

    return {
        "opportunities": results,
        "metadata": {
            "total_available": total_available,
            "returned": len(results),
            "page": page,
            "limit": limit,
            "has_more": end < total_available,
            "available_categories": available_categories,
            "filters_applied": {
                "category": category,
                "timeframe": timeframe,
                "sort": sort,
            },
        },
    }
