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

import asyncio
import hashlib
import json
import logging
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from app.services.model_router import call_llm
from sqlalchemy import func, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.db_models import User
from app.services.scoring import score_all_opportunities, get_personal_matches, MATCH_THRESHOLD

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
    source: str  # local_db, llm_generated, devpost_api, etc.
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
    # ── Clubs & Organizations ─────────────────────────────────────────────
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
        user_message = (
            f"User profile:\n{json.dumps(profile, indent=2)}\n\n"
            f"Available opportunities:\n{json.dumps(prompt_pool, indent=2)}\n\n"
            "Select and rank the 5-10 most relevant opportunities for this user. "
            "Return a JSON array of the full opportunity objects."
        )

        raw_content, _, _ = call_llm(
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_message},
            ],
            temperature=0.4,
            max_tokens=4096,
        )

        raw_content = raw_content.strip()

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

    except (RuntimeError, json.JSONDecodeError) as e:
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


# ── DB opportunity helpers ──────────────────────────────────────────────────


def _row_to_dict(row) -> dict:
    """Convert a SQLAlchemy Row to a plain dict."""
    return dict(row._mapping)


async def fetch_opportunities_from_db(
    db: AsyncSession,
    category: str | None = None,
    timeframe: str | None = None,
    sort: str = "relevance",
    page: int = 1,
    limit: int = 20,
) -> tuple[list[dict], int]:
    """Query the opportunities table with filtering, sorting, and pagination.

    Returns (opportunities, total_count).
    Falls back to empty list if the table doesn't exist or is empty.
    """
    from sqlalchemy import text as sql_text

    try:
        # Build WHERE clause
        conditions = []
        params: dict = {}

        if category:
            conditions.append("category = :category")
            params["category"] = category

        if timeframe:
            cutoff = get_timeframe_cutoff(timeframe)
            conditions.append("posted_at >= :cutoff")
            params["cutoff"] = cutoff

        where = ("WHERE " + " AND ".join(conditions)) if conditions else ""

        # Count total
        count_sql = f"SELECT COUNT(*) FROM opportunities {where}"
        count_result = await db.execute(sql_text(count_sql), params)
        total = count_result.scalar() or 0

        # Sort
        order = {
            "recent": "posted_at DESC NULLS LAST",
            "salary": "salary_max DESC NULLS LAST",
        }.get(sort, "posted_at DESC NULLS LAST")

        # Paginate
        offset = (page - 1) * limit
        query_sql = f"""
            SELECT id, title, company, location, pay, url, category,
                   description, salary_min, salary_max, salary_currency,
                   age_requirement, experience_required, posted_at,
                   first_seen_at, source_name, image_url
            FROM opportunities {where}
            ORDER BY {order}
            LIMIT :limit OFFSET :offset
        """
        params["limit"] = limit
        params["offset"] = offset

        result = await db.execute(sql_text(query_sql), params)
        rows = result.fetchall()

        opportunities = [_row_to_dict(row) for row in rows]
        return opportunities, total

    except (SQLAlchemyError, AttributeError) as e:
        logger.warning("Could not query opportunities table: %s", e)
        return [], 0


async def fetch_all_opportunities_from_db(db: AsyncSession) -> list[dict]:
    """Fetch all opportunities from the DB (for scoring)."""
    from sqlalchemy import text as sql_text

    try:
        result = await db.execute(sql_text("""
            SELECT id, title, company, location, pay, url, category,
                   description, salary_min, salary_max, salary_currency,
                   age_requirement, experience_required, posted_at,
                   first_seen_at, source_name, image_url
            FROM opportunities
            ORDER BY posted_at DESC NULLS LAST
        """))
        rows = result.fetchall()
        return [_row_to_dict(row) for row in rows]
    except (SQLAlchemyError, AttributeError) as e:
        logger.warning("Could not query opportunities table: %s", e)
        return []


async def get_new_count_from_db(db: AsyncSession) -> dict:
    """Count opportunities first seen in the last 24 hours from the DB."""
    from sqlalchemy import text as sql_text

    cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
    try:
        result = await db.execute(
            sql_text("SELECT COUNT(*) FROM opportunities WHERE first_seen_at >= :cutoff"),
            {"cutoff": cutoff},
        )
        count = result.scalar() or 0
        return {"new_count": count, "new_since": cutoff.isoformat()}
    except (SQLAlchemyError, AttributeError) as e:
        logger.warning("Could not query new opportunity count: %s", e)
        return {"new_count": 0, "new_since": cutoff.isoformat()}


async def upsert_opportunities_to_db(
    db: AsyncSession, opportunities: list[dict]
) -> int:
    """Upsert a list of opportunities into the DB.

    Uses title-based dedup (md5 hash as id). Returns count of upserted rows.
    Per-row error handling — one bad row doesn't abort the whole batch.
    """
    from sqlalchemy import text as sql_text

    upserted = 0
    failed = 0
    for opp in opportunities:
        opp_id = hashlib.md5(opp["title"].encode()).hexdigest()[:16]
        try:
            await db.execute(
                sql_text("""
                    INSERT INTO opportunities
                        (id, title, company, location, pay, url, category,
                         description, salary_min, salary_max, salary_currency,
                         age_requirement, experience_required, posted_at,
                         first_seen_at, source_name, image_url)
                    VALUES
                        (:id, :title, :company, :location, :pay, :url, :category,
                         :description, :salary_min, :salary_max, :salary_currency,
                         :age_requirement, :experience_required, :posted_at,
                         :first_seen_at, :source_name, :image_url)
                    ON CONFLICT (id) DO UPDATE SET
                        title = EXCLUDED.title,
                        company = EXCLUDED.company,
                        location = EXCLUDED.location,
                        pay = EXCLUDED.pay,
                        url = EXCLUDED.url,
                        category = EXCLUDED.category,
                        description = EXCLUDED.description,
                        salary_min = EXCLUDED.salary_min,
                        salary_max = EXCLUDED.salary_max,
                        salary_currency = EXCLUDED.salary_currency,
                        age_requirement = EXCLUDED.age_requirement,
                        experience_required = EXCLUDED.experience_required,
                        posted_at = EXCLUDED.posted_at,
                        source_name = EXCLUDED.source_name,
                        image_url = EXCLUDED.image_url
                """),
                {
                    "id": opp_id,
                    "title": opp.get("title", "Unknown"),
                    "company": opp.get("company", "Unknown"),
                    "location": opp.get("location", "Caribbean"),
                    "pay": opp.get("pay", "Varies"),
                    "url": opp.get("url", ""),
                    "category": opp.get("category", "event"),
                    "description": opp.get("description", ""),
                    "salary_min": opp.get("salary_min"),
                    "salary_max": opp.get("salary_max"),
                    "salary_currency": opp.get("salary_currency"),
                    "age_requirement": opp.get("age_requirement"),
                    "experience_required": opp.get("experience_required", "None"),
                    "posted_at": opp.get("posted_at"),
                    "first_seen_at": opp.get("first_seen_at") or _now_iso(),
                    "source_name": opp.get("source_name", "curated"),
                    "image_url": opp.get("image_url"),
                },
            )
            upserted += 1
        except Exception as e:
            failed += 1
            logger.warning("Failed to upsert opportunity '%s': %s", opp.get("title", "?"), e)
            try:
                await db.rollback()
            except Exception:
                pass

    if upserted > 0:
        try:
            await db.commit()
        except Exception as e:
            logger.warning("Failed to commit upserted opportunities: %s", e)
            await db.rollback()
            return 0

    logger.info("Upsert result: %d upserted, %d failed out of %d total", upserted, failed, len(opportunities))
    return upserted


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


async def get_available_categories(db: AsyncSession) -> list[str]:
    """Get all unique categories from the DB, falling back to curated list."""
    from sqlalchemy import text as sql_text

    try:
        result = await db.execute(sql_text("SELECT DISTINCT category FROM opportunities"))
        categories = {row[0] for row in result.fetchall()}
        if categories:
            return sorted(categories)
    except (SQLAlchemyError, AttributeError):
        pass

    # Fallback to curated list
    categories = set()
    for opp in CARIBBEAN_OPPORTUNITIES:
        categories.add(opp.get("category", "event"))
    return sorted(categories)


# ── New count helper ──────────────────────────────────────────────────────


async def get_new_count(db: AsyncSession) -> dict:
    """Count opportunities first seen in the last 24 hours."""
    return await get_new_count_from_db(db)


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

    # Try to load opportunities from DB first
    db_pool, db_total = await fetch_opportunities_from_db(
        db, category=category, timeframe=timeframe, sort=sort, page=page, limit=limit
    )

    if db_pool:
        # Opportunities exist in DB — use them directly
        # For relevance sort, we still need to score and LLM-rank
        if sort == "relevance":
            db_pool = score_all_opportunities(db_pool, profile)
            matched = await asyncio.to_thread(match_opportunities_with_llm, profile, db_pool)
            score_map = {o["title"]: o.get("relevance_score", 0) for o in db_pool}
            for m in matched:
                m["relevance_score"] = score_map.get(m["title"], m.get("relevance_score", 0))
            # Re-paginate after LLM ranking
            total_available = len(matched)
            start_idx = (page - 1) * limit
            end_idx = start_idx + limit
            paginated = matched[start_idx:end_idx]
        else:
            total_available = db_total
            paginated = db_pool

        saved_ids = await get_saved_opportunity_ids(db, user_id)
        results = []
        for opp in paginated:
            opp_id = opp.get("id") or hashlib.md5(opp["title"].encode()).hexdigest()[:16]
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
        return {
            "opportunities": results,
            "metadata": {
                "total_available": total_available,
                "returned": len(results),
                "page": page,
                "limit": limit,
                "has_more": end_idx < total_available if sort == "relevance" else (page * limit) < total_available,
                "available_categories": await get_available_categories(db),
                "filters_applied": {
                    "category": category,
                    "timeframe": timeframe,
                    "sort": sort,
                },
            },
        }

    # Fallback: use hardcoded curated list when DB is empty
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
        pool.sort(
            key=lambda o: _parse_posted_at(o.get("posted_at")) or datetime.min.replace(tzinfo=timezone.utc),
            reverse=True,
        )
    elif sort == "salary":
        pool.sort(key=lambda o: o.get("salary_max") or 0, reverse=True)
    else:
        # relevance — use rule-based scoring first, then LLM for top results
        pool = score_all_opportunities(pool, profile)
        matched = await asyncio.to_thread(match_opportunities_with_llm, profile, pool)
        # Preserve scores from rule-based scoring
        score_map = {o["title"]: o.get("relevance_score", 0) for o in pool}
        for m in matched:
            m["relevance_score"] = score_map.get(m["title"], m.get("relevance_score", 0))
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
    results = []
    for opp in paginated:
        opp_id = hashlib.md5(opp["title"].encode()).hexdigest()[:16]
        results.append(
            {
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
            }
        )

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


async def get_user_matches(
    db: AsyncSession,
    user_id: str,
    page: int = 1,
    limit: int = 20,
) -> dict:
    """Get personal opportunity matches for a user.

    Uses rule-based scoring (no LLM). Returns opportunities with
    relevance_score >= MATCH_THRESHOLD, sorted by score descending.
    """
    user = await db.get(User, user_id)
    if not user:
        raise ValueError("user_not_found: no user with this ID")

    profile = {
        "career_path": user.career_path,
        "education_level": user.education_level,
        "age": user.age,
        "country": user.country,
        "interests": user.interests or [],
    }

    # Score all opportunities — try DB first, fall back to curated
    all_from_db = await fetch_all_opportunities_from_db(db)
    source_pool = all_from_db if all_from_db else CARIBBEAN_OPPORTUNITIES

    all_scored = score_all_opportunities(source_pool, profile)

    # Filter to matches above threshold
    matches = [o for o in all_scored if o.get("relevance_score", 0) >= MATCH_THRESHOLD]

    total = len(matches)

    # Paginate
    start = (page - 1) * limit
    end = start + limit
    paginated = matches[start:end]

    # Get saved IDs
    saved_ids = await get_saved_opportunity_ids(db, user_id)

    # Build results
    results = []
    for opp in paginated:
        opp_id = opp.get("id") or hashlib.md5(opp["title"].encode()).hexdigest()[:16]
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
            "relevance_score": opp.get("relevance_score", 0),
        })

    return {
        "opportunities": results,
        "metadata": {
            "total_available": total,
            "returned": len(results),
            "page": page,
            "limit": limit,
            "has_more": end < total,
            "available_categories": await get_available_categories(db),
            "filters_applied": {
                "category": None,
                "timeframe": None,
                "sort": "relevance",
                "personal_match": True,
            },
        },
    }
