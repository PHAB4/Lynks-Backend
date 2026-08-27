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
from pathlib import Path

from openai import APIError as OpenAIError, OpenAI
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
    UserMemory,
)

_PROMPT_DIR = Path(__file__).resolve().parent / "prompts"

# ── Token estimation ───────────────────────────────────────────────────────


def estimate_tokens(text: str) -> int:
    """Rough token estimate: ~4 chars per token for English."""
    return len(text) // 4


MAX_CONTEXT_TOKENS = 8000

_RECENT_MESSAGE_LIMIT = 10
_SUMMARY_THRESHOLD = 15

logger = logging.getLogger(__name__)


# ── User context builder ────────────────────────────────────────────────────


async def _load_user_context(
    db: AsyncSession,
    user_id: str,
    conversation_id: str | None = None,
) -> str:
    """
    Build a rich context string about the user's current state.

    Priority order (highest to lowest):
    1. Profile (~200 tokens)
    2. Long-term memories (~300 tokens)
    3. Active roadmap summary (~400 tokens)
    4. Cross-conversation summaries (~300 tokens)
    5. Current conversation summary (~500 tokens, if exists)

    Total target: ~4,000 tokens (well within 8K budget).
    """
    user = await db.get(User, user_id)
    if not user:
        return "No user profile found."

    sections = []

    # ── 1. Profile (~200 tokens) ───────────────────────────────────────
    interests_str = "Not set"
    if user.interests:
        if isinstance(user.interests, str):
            try:
                parsed = json.loads(user.interests)
                interests_str = ", ".join(parsed) if isinstance(parsed, list) else user.interests
            except (json.JSONDecodeError, TypeError):
                interests_str = user.interests
        elif isinstance(user.interests, list):
            interests_str = ", ".join(str(i) for i in user.interests)

    sections.append(f"""## User Profile
- Name: {user.name or 'Not set'}
- Age: {user.age or 'Not set'}
- Country: {user.country or 'Not set'}
- Education: {user.education_level or 'Not set'}
- Career path: {user.career_path or 'Not set'}
- Interests: {interests_str}""")

    # ── 2. Long-term memories (~300 tokens) ────────────────────────────
    mem_result = await db.execute(
        select(UserMemory)
        .where(UserMemory.user_id == user_id)
        .order_by(UserMemory.created_at.desc())
        .limit(20)
    )
    memories = mem_result.scalars().all()

    if memories:
        memory_lines = ["\n## Things I Remember About This User"]
        for mem in memories:
            memory_lines.append(f"- [{mem.category}] {mem.fact}")
        sections.append("\n".join(memory_lines))

    # ── 3. Active roadmap summary (~400 tokens) ────────────────────────
    result = await db.execute(
        select(Roadmap)
        .options(selectinload(Roadmap.steps).selectinload(Step.tasks))
        .where(Roadmap.user_id == user_id, Roadmap.is_active == True)
    )
    roadmap = result.scalar_one_or_none()

    if roadmap:
        completed_tasks = 0
        total_tasks = 0
        roadmap_lines = [f"\n## Active Roadmap (career: {roadmap.career_path})"]

        for step in sorted(roadmap.steps, key=lambda s: s.order or 0):
            step_tasks = sorted(step.tasks, key=lambda t: t.order or 0)
            completed_in_step = sum(1 for t in step_tasks if t.status == "complete")
            total_in_step = len(step_tasks)
            completed_tasks += completed_in_step
            total_tasks += total_in_step

            step_status = "✅ DONE" if completed_in_step == total_in_step and total_in_step > 0 else "🔄 IN PROGRESS"
            roadmap_lines.append(
                f"\n### Step {step.order}: {step.title} [{step_status}]"
            )

            for t in step_tasks:
                task_icon = "✅" if t.status == "complete" else "⬜"
                roadmap_lines.append(f"  - {task_icon} {t.title} (Task ID: {t.id})")

        if total_tasks > 0:
            pct = int((completed_tasks / total_tasks) * 100)
            roadmap_lines.insert(2, f"Progress: {completed_tasks}/{total_tasks} tasks complete ({pct}%)")

        sections.append("\n".join(roadmap_lines))
    else:
        sections.append("\n## Active Roadmap\nNo roadmap generated yet.")

    # ── 4. Cross-conversation summaries (~300 tokens) ──────────────────
    cross_conv_text = await _load_previous_conversations(db, user_id, conversation_id, limit=3)
    if cross_conv_text:
        sections.append(cross_conv_text)

    # ── 5. Current conversation summary (~500 tokens, if exists) ────────
    if conversation_id:
        conv_summary_text = await _load_conversation_summary(db, conversation_id)
        if conv_summary_text:
            sections.append(conv_summary_text)

    # ── Token budget management ─────────────────────────────────────────
    full_text = "\n".join(sections)
    current_tokens = estimate_tokens(full_text)

    if current_tokens > MAX_CONTEXT_TOKENS:
        # Drop lowest-priority sections first (cross-conv summaries)
        # Then trim conversation summary
        logger.warning(
            "Context over budget: %d tokens (max %d). Trimming.",
            current_tokens,
            MAX_CONTEXT_TOKENS,
        )
        # Remove cross-conversation summaries if over budget
        sections = [s for s in sections if not s.startswith("## Previous Conversations")]
        full_text = "\n".join(sections)

    return full_text


async def _load_previous_conversations(
    db: AsyncSession,
    user_id: str,
    current_conversation_id: str | None,
    limit: int = 3,
) -> str:
    """Load summaries of previous conversations for cross-conversation context."""
    query = (
        select(Conversation)
        .where(Conversation.user_id == user_id)
        .order_by(Conversation.created_at.desc())
        .limit(limit + 1)
    )
    conv_result = await db.execute(query)
    conversations = conv_result.scalars().all()

    # Filter out the current conversation
    other_convs = [
        c for c in conversations
        if c.id != current_conversation_id
    ][:limit]

    if not other_convs:
        return ""

    lines = ["\n## Previous Conversations"]
    for conv in other_convs:
        if conv.summary:
            lines.append(f"- {conv.summary}")
        else:
            # Fallback: extract first few user messages as topic
            msg_result = await db.execute(
                select(Message)
                .where(Message.conversation_id == conv.id, Message.role == "user")
                .order_by(Message.created_at)
                .limit(3)
            )
            user_msgs = msg_result.scalars().all()
            if user_msgs:
                topics = [m.content[:60] for m in user_msgs]
                lines.append(f"- User discussed: {'; '.join(topics)}")

    return "\n".join(lines)


async def _load_conversation_summary(
    db: AsyncSession,
    conversation_id: str,
) -> str:
    """Load the summary for the current conversation if one exists."""
    conv = await db.get(Conversation, conversation_id)
    if conv and conv.summary:
        return f"\n## Current Conversation Summary\n{conv.summary}"
    return ""


# ── System prompt — the Mentor's personality ───────────────────────────────


def _load_system_prompt() -> str:
    """Load the system prompt from the external markdown file."""
    prompt_file = _PROMPT_DIR / "mentor_system.md"
    if prompt_file.exists():
        return prompt_file.read_text(encoding="utf-8")
    logger.warning("Prompt file not found at %s — using fallback", prompt_file)
    return (
        "You are the Lynks Mentor — a warm, encouraging career guide "
        "for young people in the Caribbean."
    )


SYSTEM_PROMPT_BASE = _load_system_prompt()


# ── Tool definitions (OpenAI function-calling format) ──────────────────────

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "generate_roadmap",
            "description": (
                "Generate or regenerate the user's personalized career roadmap. "
                "Use when the user asks for a roadmap, a career plan, what steps to take, "
                "or wants to change their career path."
            ),
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_portfolio",
            "description": (
                "Get the user's portfolio — their completed tasks and verified evidence. "
                "Use when the user asks about their progress, portfolio, or uploaded evidence."
            ),
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "find_opportunities",
            "description": (
                "Search for Caribbean-relevant opportunities: jobs, competitions, scholarships, "
                "clubs, or events. Use when the user asks about jobs, hackathons, scholarships, "
                "or anything opportunity-related."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "category": {
                        "type": "string",
                        "enum": ["job", "club", "competition", "scholarship", "event", "volunteer"],
                        "description": "Optional category filter. Omit to search all categories.",
                    }
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "complete_task",
            "description": (
                "Mark a task as complete in the user's roadmap. "
                "Use when the user says they finished something or wants to check off a task."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "task_id": {
                        "type": "string",
                        "description": "The UUID of the task to mark as complete.",
                    }
                },
                "required": ["task_id"],
            },
        },
    },
]


# ── Tool execution ──────────────────────────────────────────────────────────


async def _execute_tool(
    db: AsyncSession,
    user_id: str,
    tool_name: str,
    tool_args: dict,
) -> dict:
    """Execute the requested tool and return its result as a dict."""
    try:
        if tool_name == "generate_roadmap":
            return await generate_roadmap(db, user_id)

        if tool_name == "get_portfolio":
            portfolio = await get_user_portfolio(db, user_id)
            return {"portfolio": portfolio}

        if tool_name == "find_opportunities":
            category = tool_args.get("category")
            opportunities = await discover_opportunities(db, user_id, category)
            return {"opportunities": opportunities}

        if tool_name == "complete_task":
            task_id = tool_args.get("task_id")
            if not task_id:
                return {"error": "task_id is required"}
            task = await db.get(Task, task_id)
            if not task:
                return {"error": f"task_not_found: no task with id {task_id}"}
            task.status = "complete"
            task.completed_at = datetime.now(timezone.utc)
            await db.commit()
            return {
                "success": True,
                "task_id": task.id,
                "title": task.title,
                "message": f"Task '{task.title}' marked as complete!",
            }

        return {"error": f"unknown_tool: {tool_name}"}
    except ValueError as e:
        return {"error": str(e)}
    except RuntimeError as e:
        return {"error": str(e)}


# ── Conversation management ─────────────────────────────────────────────────


async def _get_or_create_conversation(
    db: AsyncSession,
    user_id: str,
    conversation_id: str | None,
) -> Conversation:
    if conversation_id:
        conversation = await db.get(Conversation, conversation_id)
        if conversation and conversation.user_id == user_id:
            return conversation

    conversation = Conversation(id=str(uuid.uuid4()), user_id=user_id)
    db.add(conversation)
    await db.commit()
    await db.refresh(conversation)
    return conversation


async def _load_conversation_history(db: AsyncSession, conversation_id: str) -> list[dict]:
    result = await db.execute(
        select(Message).where(Message.conversation_id == conversation_id).order_by(Message.created_at)
    )
    messages = result.scalars().all()

    history = []
    for msg in messages:
        history.append({"role": msg.role, "content": msg.content})
    return history


async def _load_conversation_history_optimized(
    db: AsyncSession,
    conversation_id: str,
) -> list[dict]:
    """
    Load conversation history with summarization.

    If the conversation has >15 messages:
    - Load the conversation summary (if exists) as a system-style context message
    - Load only the last 10 messages verbatim

    Otherwise, load all messages (conversation is short enough).
    """
    result = await db.execute(
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .order_by(Message.created_at)
    )
    messages = result.scalars().all()

    if len(messages) <= _RECENT_MESSAGE_LIMIT:
        # Short conversation — load everything
        return [{"role": msg.role, "content": msg.content} for msg in messages]

    # Long conversation — use summary + recent messages
    conv = await db.get(Conversation, conversation_id)
    history = []

    if conv and conv.summary:
        history.append({
            "role": "system",
            "content": f"[Summary of earlier messages in this conversation: {conv.summary}]",
        })

    # Last 10 messages verbatim
    recent = messages[-_RECENT_MESSAGE_LIMIT:]
    for msg in recent:
        history.append({"role": msg.role, "content": msg.content})

    return history


async def _get_message_count(db: AsyncSession, conversation_id: str) -> int:
    """Count messages in a conversation."""
    from sqlalchemy import func as sqlfunc
    result = await db.execute(
        select(sqlfunc.count(Message.id))
        .where(Message.conversation_id == conversation_id)
    )
    return result.scalar() or 0


async def _generate_conversation_summary(
    db: AsyncSession,
    conversation: Conversation,
) -> str | None:
    """
    Generate a summary of the conversation using the LLM.
    Summarizes messages 1 through N-5 (keeping last 5 for recency).
    Saves the summary to the conversation record.
    """
    result = await db.execute(
        select(Message)
        .where(Message.conversation_id == conversation.id)
        .order_by(Message.created_at)
    )
    messages = list(result.scalars().all())

    if len(messages) < _SUMMARY_THRESHOLD:
        return None

    # Summarize all but the last 5 messages
    to_summarize = messages[:-5]
    conv_text = "\n".join(
        f"{'User' if m.role == 'user' else 'Mentor'}: {m.content}"
        for m in to_summarize
    )

    SUMMARY_PROMPT = f"""Summarize this conversation segment in 2-3 sentences.
Focus on: what the user asked, what advice was given, what decisions were made.
Be concise but capture key facts, preferences, and constraints.

Conversation:
{conv_text}

Summary:"""

    try:
        client = OpenAI(
            api_key=settings.LLM_API_KEY,
            base_url=settings.LLM_API_BASE_URL,
        )
        response = client.chat.completions.create(
            model=settings.LLM_MODEL,
            messages=[{"role": "user", "content": SUMMARY_PROMPT}],
            temperature=0.3,
            max_tokens=200,
        )
        summary = response.choices[0].message.content or ""

        if summary:
            conversation.summary = summary.strip()
            await db.commit()
            await db.refresh(conversation)
            logger.info("Generated summary for conversation %s", conversation.id)
            return summary.strip()

    except (OpenAIError, OSError) as e:
        logger.warning("Failed to generate conversation summary: %s", e)

    return None


def _sanitize_messages(messages: list[dict]) -> list[dict]:
    """Strip fields unsupported by Groq (annotations, etc.) before sending to LLM."""
    cleaned = []
    for msg in messages:
        clean = {"role": msg["role"], "content": msg.get("content", "") or ""}
        if msg.get("tool_calls"):
            clean["tool_calls"] = msg["tool_calls"]
        if msg.get("tool_call_id"):
            clean["tool_call_id"] = msg["tool_call_id"]
        cleaned.append(clean)
    return cleaned


async def _save_message(
    db: AsyncSession,
    conversation_id: str,
    role: str,
    content: str,
    tool_calls: dict | None = None,
) -> Message:
    message = Message(
        id=str(uuid.uuid4()),
        conversation_id=conversation_id,
        role=role,
        content=content,
        tool_calls=tool_calls,
    )
    db.add(message)
    await db.commit()
    await db.refresh(message)
    return message


# ── Main chat function ──────────────────────────────────────────────────────


async def send_message(
    db: AsyncSession,
    user_id: str,
    message: str,
    conversation_id: str | None = None,
) -> dict:
    """
    Process a user's chat message: load full user context, run it through
    the LLM with tool access, execute any tool calls, and return the
    final response.

    Context is optimized:
    - Profile + memories + roadmap summaries (always)
    - Cross-conversation summaries (compressed, not full messages)
    - Current conversation: summary of old messages + last 10 messages verbatim
    """
    from app.agents.memory_extractor import extract_and_save_memories, should_extract

    conversation = await _get_or_create_conversation(db, user_id, conversation_id)
    history = await _load_conversation_history_optimized(db, conversation.id)

    # Save the user's message
    await _save_message(db, conversation.id, "user", message)

    # Load full user context (profile, memories, roadmap, cross-conversation summaries)
    user_context = await _load_user_context(db, user_id, conversation.id)

    client = OpenAI(api_key=settings.LLM_API_KEY, base_url=settings.LLM_API_BASE_URL)

    system_prompt = SYSTEM_PROMPT_BASE + f"\n\n---\n\n# Current User Context\n\n{user_context}"

    messages = [{"role": "system", "content": system_prompt}] + history + [{"role": "user", "content": message}]

    # First LLM call — may request a tool call
    response = client.chat.completions.create(
        model=settings.LLM_MODEL,
        messages=_sanitize_messages(messages),
        tools=TOOLS,
        tool_choice="auto",
        temperature=0.7,
        max_tokens=2048,
    )

    choice = response.choices[0]
    tool_calls_made = None

    if choice.finish_reason == "tool_calls" and choice.message.tool_calls:
        # The LLM wants to call one or more tools
        tool_calls_made = []
        messages.append(choice.message.model_dump())

        for tool_call in choice.message.tool_calls:
            tool_name = tool_call.function.name
            try:
                tool_args = json.loads(tool_call.function.arguments or "{}")
            except json.JSONDecodeError:
                tool_args = {}

            result = await _execute_tool(db, user_id, tool_name, tool_args)
            tool_calls_made.append({"tool": tool_name, "args": tool_args, "result": result})

            messages.append({
                "role": "tool",
                "tool_call_id": tool_call.id,
                "content": json.dumps(result),
            })

        # After tool execution, reload context (roadmap may have changed)
        updated_context = await _load_user_context(db, user_id, conversation.id)
        messages[0] = {"role": "system", "content": SYSTEM_PROMPT_BASE + f"\n\n---\n\n# Current User Context\n\n{updated_context}"}

        # Second LLM call — generate the natural-language response using tool results
        final_response = client.chat.completions.create(
            model=settings.LLM_MODEL,
            messages=_sanitize_messages(messages),
            temperature=0.7,
            max_tokens=2048,
        )
        response_text = final_response.choices[0].message.content or ""
    else:
        response_text = choice.message.content or ""

    # Save the assistant's response
    await _save_message(
        db,
        conversation.id,
        "assistant",
        response_text,
        tool_calls={"calls": tool_calls_made} if tool_calls_made else None,
    )

    # ── Post-response: summarization + memory extraction (background tasks) ──

    # Check if we should summarize the conversation
    msg_count = await _get_message_count(db, conversation.id)
    if msg_count >= _SUMMARY_THRESHOLD and not conversation.summary:
        await _generate_conversation_summary(db, conversation)

    # Check if we should extract memories (every 10 messages)
    if await should_extract(user_id, conversation.id, db):
        try:
            await extract_and_save_memories(db, user_id, conversation.id)
        except (OpenAIError, OSError, ValueError) as e:
            logger.warning("Memory extraction failed (non-fatal): %s", e)

    return {
        "conversation_id": conversation.id,
        "response": response_text,
        "tool_calls": tool_calls_made,
        "summary_updated": conversation.summary is not None,
    }


async def get_chat_history(db: AsyncSession, user_id: str, conversation_id: str | None) -> dict:
    """Get the message history for a conversation."""
    if conversation_id:
        conversation = await db.get(Conversation, conversation_id)
        if not conversation or conversation.user_id != user_id:
            raise ValueError("conversation_not_found: no conversation with this ID")
    else:
        # Get the user's most recent conversation
        result = await db.execute(
            select(Conversation)
            .where(Conversation.user_id == user_id)
            .order_by(Conversation.created_at.desc())
            .limit(1)
        )
        conversation = result.scalar_one_or_none()
        if not conversation:
            raise ValueError("conversation_not_found: no conversation history yet")

    result = await db.execute(
        select(Message).where(Message.conversation_id == conversation.id).order_by(Message.created_at)
    )
    messages = result.scalars().all()

    return {
        "conversation_id": conversation.id,
        "messages": [
            {
                "role": m.role,
                "content": m.content,
                "tool_calls": m.tool_calls,
                "created_at": m.created_at.isoformat() if m.created_at else None,
            }
            for m in messages
        ],
    }


async def delete_chat_history(db: AsyncSession, user_id: str) -> None:
    """Delete all conversations and messages for a user."""
    result = await db.execute(select(Conversation).where(Conversation.user_id == user_id))
    conversations = result.scalars().all()

    for conversation in conversations:
        msg_result = await db.execute(select(Message).where(Message.conversation_id == conversation.id))
        for message in msg_result.scalars().all():
            await db.delete(message)
        await db.delete(conversation)

    await db.commit()
