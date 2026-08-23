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
