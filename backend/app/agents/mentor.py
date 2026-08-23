"""
Mentor Chatbot — the conversational orchestrator for Lynks.

Enhanced version with:
- Roadmap context (knows user's active roadmap, steps, tasks, and progress)
- Portfolio awareness (knows completed tasks and evidence)
- Conversation memory (remembers previous conversations)
- Task completion tracking (can mark tasks complete from chat)

This is BOTH the "mentor" (friendly, Caribbean-aware career guide) AND the
"orchestrator" (routes user intent to the right agent). A single
conversational agent that:

  1. Knows the user's full context (profile, roadmap, progress, portfolio)
  2. Talks in a warm, encouraging, first-principles way
  3. Has access to all other agents as "tools" it can call
  4. Saves the full conversation history to the database
"""

from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime, timezone

from openai import OpenAI
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.agents.architect import generate_roadmap
from app.agents.portfolio_manager import get_user_portfolio
from app.agents.scout import discover_opportunities
from app.core.config import settings
from app.models.db_models import (
    Conversation,
    Evidence,
    Message,
    Roadmap,
    Step,
    Task,
    User,
)

logger = logging.getLogger(__name__)
