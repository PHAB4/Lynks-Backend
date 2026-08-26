"""
Memory Extractor — extracts key facts from conversations and stores them
as long-term user memories.

After every 10 messages, this module runs a lightweight LLM call to pull out
lasting user facts (career interests, preferences, milestones, personality traits)
and saves them to the user_memories table.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone

from openai import OpenAI
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.db_models import Message, UserMemory

logger = logging.getLogger(__name__)

EXTRACTION_PROMPT = """\
You are a memory extraction system for a career mentoring chatbot.

Analyze the following conversation and extract key facts about the user that would
be useful to remember in future career mentoring sessions.

Return a JSON array of facts. Each fact must have:
- "fact": a clear, concise statement (e.g. "Interested in web development, specifically React")
- "category": one of "preference", "goal", "context", "milestone", "personality"

Rules:
- Only extract facts the user explicitly stated or strongly implied
- Don't duplicate facts already in the existing_memories list
- Maximum 5 new facts per conversation
- Don't extract temporary things (mood, "I'm tired today", "I'm bored right now")
- DO extract lasting things (career interests, learning style, completed milestones, location, education)
- Be specific — "Interested in web development, specifically React" is better than "Likes coding"

Existing memories (don't duplicate these):
{existing_memories}

Conversation:
{conversation}

Return ONLY a valid JSON array. No other text. Example:
[
  {{"fact": "Interested in web development, specifically React", "category": "preference"}},
  {{"fact": "Currently studying computer science at university", "category": "context"}}
]"""


def _format_messages(messages: list[Message]) -> str:
    """Format conversation messages into a readable string for the LLM."""
    lines = []
    for msg in messages:
        role = "User" if msg.role == "user" else "Mentor"
        lines.append(f"{role}: {msg.content}")
    return "\n".join(lines)


def _format_existing_memories(memories: list[UserMemory]) -> str:
    """Format existing memories into a readable string."""
    if not memories:
        return "(none)"
    return "\n".join(
        f"- [{m.category}] {m.fact}" for m in memories
    )


async def extract_and_save_memories(
    db: AsyncSession,
    user_id: str,
    conversation_id: str,
) -> list[UserMemory]:
    """
    Extract key facts from a conversation and save them as user memories.
    Returns the list of newly created memories (may be empty).
    """
    # Load existing memories to avoid duplication
    existing_result = await db.execute(
        select(UserMemory)
        .where(UserMemory.user_id == user_id)
        .order_by(UserMemory.created_at.desc())
        .limit(30)
    )
    existing_memories = list(existing_result.scalars().all())

    # Load conversation messages
    msg_result = await db.execute(
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .order_by(Message.created_at)
    )
    messages = list(msg_result.scalars().all())

    if not messages or len(messages) < 2:
        return []

    # Build the extraction prompt
    prompt = EXTRACTION_PROMPT.format(
        existing_memories=_format_existing_memories(existing_memories),
        conversation=_format_messages(messages),
    )

    try:
        client = OpenAI(
            api_key=settings.LLM_API_KEY,
            base_url=settings.LLM_API_BASE_URL,
        )
        response = client.chat.completions.create(
            model=settings.LLM_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
            max_tokens=500,
        )
        raw = response.choices[0].message.content or "[]"

        # Parse the JSON response
        raw = raw.strip()
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[-1].rsplit("```", 1)[0].strip()

        extracted = json.loads(raw)
        if not isinstance(extracted, list):
            logger.warning("Extraction returned non-list: %s", type(extracted))
            return []

    except json.JSONDecodeError as e:
        logger.error("Failed to parse extraction JSON: %s", e)
        return []
    except Exception as e:
        logger.error("Memory extraction failed: %s", e)
        return []

    # Save new memories
    saved = []
    for item in extracted[:5]:
        fact = item.get("fact", "").strip()
        category = item.get("category", "general").strip()

        if not fact:
            continue

        valid_categories = {"preference", "goal", "context", "milestone", "personality"}
        if category not in valid_categories:
            category = "general"

        # Double-check deduplication against existing facts
        fact_lower = fact.lower()
        is_duplicate = any(
            fact_lower in m.fact.lower() or m.fact.lower() in fact_lower
            for m in existing_memories
        )
        if is_duplicate:
            continue

        memory = UserMemory(
            user_id=user_id,
            fact=fact,
            category=category,
            source="conversation",
        )
        db.add(memory)
        saved.append(memory)

    if saved:
        await db.commit()
        for m in saved:
            await db.refresh(m)
        logger.info("Saved %d new memories for user %s", len(saved), user_id)

    # Prune if over 30 memories (keep newest 30)
    if len(existing_memories) + len(saved) > 30:
        all_result = await db.execute(
            select(UserMemory)
            .where(UserMemory.user_id == user_id)
            .order_by(UserMemory.created_at.desc())
            .limit(30)
        )
        keep_ids = {m.id for m in all_result.scalars().all()}
        delete_result = await db.execute(
            select(UserMemory)
            .where(
                UserMemory.user_id == user_id,
                ~UserMemory.id.in_(keep_ids),
            )
        )
        for old_memory in delete_result.scalars().all():
            await db.delete(old_memory)
        await db.commit()

    return saved


async def should_extract(user_id: str, conversation_id: str, db: AsyncSession) -> bool:
    """Check if we should run extraction — every 10 messages."""
    from sqlalchemy import func as sqlfunc

    result = await db.execute(
        select(sqlfunc.count(Message.id))
        .where(Message.conversation_id == conversation_id)
    )
    count = result.scalar() or 0
    return count > 0 and count % 10 == 0
