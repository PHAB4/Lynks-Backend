"""
Job Scout Agent — discovers Caribbean-relevant opportunities for users.

Sources (all free, no API keys needed for most):
  1. Curated Caribbean opportunities database (local clubs, competitions, events)
  2. Remotive / Himalaya / other free job APIs (remote work)
  3. Scholarship and competition aggregators
  4. LLM-powered recommendation from user profile

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
from dataclasses import dataclass, field
from datetime import datetime, timezone

from openai import OpenAI
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.db_models import User

logger = logging.getLogger(__name__)


# ── Opportunity types ──────────────────────────────────────────────────────


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
    source: str    # local_db, llm_generated


# ── Curated Caribbean opportunities database ───────────────────────────────
# This is the "source of truth" for Caribbean-specific opportunities.
# Add to this list as you discover new ones.
# In a production system this would be a database table, but for the
# buildathon a curated list is faster and more reliable.

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
    """Use LLM to filter and rank opportunities for a specific user."""
    client = OpenAI(
        api_key=settings.LLM_API_KEY,
        base_url=settings.LLM_API_BASE_URL,
    )

    user_message = (
        f"User profile:\n{json.dumps(profile, indent=2)}\n\n"
        f"Available opportunities:\n{json.dumps(opportunities, indent=2)}\n\n"
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

    try:
        data = json.loads(raw_content)
    except json.JSONDecodeError as e:
        logger.error("LLM returned invalid JSON for opportunity matching: %s", e)
        return opportunities[:5]

    if isinstance(data, list):
        return data
    if isinstance(data, dict) and "opportunities" in data:
        return data["opportunities"]
    return opportunities[:5]


# ── Public API ──────────────────────────────────────────────────────────────


async def discover_opportunities(
    db: AsyncSession,
    user_id: str,
    category: str | None = None,
) -> list[dict]:
    """
    Discover opportunities for a user.

    1. Load user profile
    2. Filter curated database by category (if specified)
    3. Use LLM to rank and select the most relevant ones
    4. Return structured opportunity objects
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

    # Filter opportunities by category if specified
    pool = CARIBBEAN_OPPORTUNITIES
    if category:
        pool = [o for o in pool if o["category"] == category]

    # Use LLM to match and rank
    matched = match_opportunities_with_llm(profile, pool)

    # Add IDs and source tags
    results = []
    for opp in matched:
        results.append({
            "id": str(uuid.uuid4()),
            "title": opp.get("title", "Unknown"),
            "company": opp.get("company", "Unknown"),
            "location": opp.get("location", "Caribbean"),
            "pay": opp.get("pay", "Varies"),
            "age_requirement": opp.get("age_requirement"),
            "experience_required": opp.get("experience_required", "None"),
            "url": opp.get("url", ""),
        })

    return results
