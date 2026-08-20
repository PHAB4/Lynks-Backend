"""Job Scout Agent — discovers Caribbean-relevant opportunities."""
from __future__ import annotations
import json
import logging
import uuid
from datetime import datetime, timezone
from openai import OpenAI
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config import settings
from app.models.db_models import User

logger = logging.getLogger(__name__)

CARIBBEAN_OPPORTUNITIES = [
    {"id": str(uuid.uuid4()), "title": "Jamaica Science Olympiad", "company": "Jamaica Science Teachers' Association", "location": "Jamaica", "pay": "Free", "experience_required": "None", "age_range": "Under 18", "url": "https://jamaicascienceolympiad.org", "category": "competition"},
    {"id": str(uuid.uuid4()), "title": "Caribbean Coding Challenge", "company": "Caribbean Tech Collective", "location": "Caribbean Regional", "pay": "Free", "experience_required": "Beginner", "age_range": "16-21", "url": "https://caribbeantech.org/challenge", "category": "competition"},
    {"id": str(uuid.uuid4()), "title": "UWI Coding Club", "company": "University of the West Indies", "location": "Jamaica", "pay": "Free", "experience_required": "None", "age_range": "16-21", "url": "https://uwi.edu/coding-club", "category": "club"},
    {"id": str(uuid.uuid4()), "title": "Caribbean AI Community", "company": "Caribbean AI Network", "location": "Caribbean Regional", "pay": "Free", "experience_required": "Beginner", "age_range": "16-25", "url": "https://caribbeanai.com", "category": "club"},
    {"id": str(uuid.uuid4()), "title": "CXC/CSEC Scholarship Program", "company": "Caribbean Examinations Council", "location": "Caribbean Regional", "pay": "Scholarship", "experience_required": "None", "age_range": "Under 18", "url": "https://cxc.org/scholarships", "category": "scholarship"},
    {"id": str(uuid.uuid4()), "title": "Chevening Scholarship (Caribbean)", "company": "UK Government", "location": "Caribbean Regional", "pay": "Full Scholarship", "experience_required": "Intermediate", "age_range": "21+", "url": "https://chevening.org/caribbean", "category": "scholarship"},
    {"id": str(uuid.uuid4()), "title": "Caribbean Tech Week", "company": "Caribbean Tech Network", "location": "Barbados", "pay": "Free", "experience_required": "None", "age_range": "16-25", "url": "https://caribbeantechweek.com", "category": "event"},
    {"id": str(uuid.uuid4()), "title": "Digicel Bright Stars", "company": "Digicel Foundation", "location": "Caribbean Regional", "pay": "Free", "experience_required": "None", "age_range": "Under 18", "url": "https://digicelfoundation.org/brightstars", "category": "competition"},
    {"id": str(uuid.uuid4()), "title": "Caribbean Volunteer Network", "company": "Caribbean Red Cross", "location": "Caribbean Regional", "pay": "Volunteer", "experience_required": "None", "age_range": "16+", "url": "https://caribbeanredcross.org/volunteer", "category": "volunteer"},
    {"id": str(uuid.uuid4()), "title": "Junior Developer (Remote)", "company": "Tech Caribbean Solutions", "location": "Remote", "pay": "Paid", "experience_required": "Beginner", "age_range": "18-25", "url": "https://techcaribbean.com/careers", "category": "job"},
    {"id": str(uuid.uuid4()), "title": "Caribbean Hackathon", "company": "Caribbean Tech Collective", "location": "Trinidad", "pay": "Free", "experience_required": "Beginner", "age_range": "16-21", "url": "https://caribbeantech.org/hackathon", "category": "competition"},
    {"id": str(uuid.uuid4()), "title": "Girl Geek Dinner Caribbean", "company": "Girl Geek Dinners", "location": "Jamaica", "pay": "Free", "experience_required": "None", "age_range": "16-25", "url": "https://girlgeekdinner.com/caribbean", "category": "club"},
]


def match_opportunity_to_user(opp: dict, user: User) -> float:
    score = 0.0
    if opp["category"] in ["competition", "scholarship"]:
        score += 0.3
    if opp["experience_required"] in ["None", "Beginner"]:
        score += 0.2
    if user.age and opp["age_range"]:
        score += 0.2
    if user.country and opp["location"]:
        score += 0.2
    if opp["pay"] == "Free":
        score += 0.1
    return min(score, 1.0)


async def discover_opportunities(db: AsyncSession, user_id: str, category: str | None = None) -> list[dict]:
    user = await db.get(User, user_id)
    if not user:
        raise ValueError("user_not_found: no user with this ID")
    opportunities = CARIBBEAN_OPPORTUNITIES
    if category:
        opportunities = [o for o in opportunities if o["category"] == category]
    scored = []
    for opp in opportunities:
        score = match_opportunity_to_user(opp, user)
        scored.append({**opp, "relevance_score": score})
    scored.sort(key=lambda x: x["relevance_score"], reverse=True)
    return scored