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


# ── User context builder ────────────────────────────────────────────────────


async def _load_user_context(db: AsyncSession, user_id: str) -> str:
    """
    Build a rich context string about the user's current state:
    profile, active roadmap (with steps and tasks), portfolio, and
    recent conversation summaries.
    """
    user = await db.get(User, user_id)
    if not user:
        return "No user profile found."

    sections = []

    # Profile
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

    # Active roadmap
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
            roadmap_lines.append(f"{step.description}")

            for t in step_tasks:
                task_icon = "✅" if t.status == "complete" else "⬜"
                roadmap_lines.append(f"  - {task_icon} {t.title} (Task ID: {t.id})")

        if total_tasks > 0:
            pct = int((completed_tasks / total_tasks) * 100)
            roadmap_lines.insert(2, f"Progress: {completed_tasks}/{total_tasks} tasks complete ({pct}%)")

        sections.append("\n".join(roadmap_lines))
    else:
        sections.append("\n## Active Roadmap\nNo roadmap generated yet.")

    # Portfolio (tasks with evidence)
    try:
        portfolio = await get_user_portfolio(db, user_id)
        if portfolio:
            portfolio_lines = ["\n## Portfolio (Completed Tasks with Evidence)"]
            for item in portfolio:
                if isinstance(item, dict):
                    ev_count = len(item.get("evidence", []))
                    title = item.get("title", "Unknown task")
                    portfolio_lines.append(f"- {title} — {ev_count} evidence file(s)")
            sections.append("\n".join(portfolio_lines))
        else:
            sections.append("\n## Portfolio\nNo evidence uploaded yet.")
    except Exception as e:
        logger.warning("Failed to load portfolio for context: %s", e)
        sections.append("\n## Portfolio\nNo evidence uploaded yet.")

    # Recent conversation summaries (last 3 conversations)
    conv_result = await db.execute(
        select(Conversation)
        .where(Conversation.user_id == user_id)
        .order_by(Conversation.created_at.desc())
        .limit(3)
    )
    conversations = conv_result.scalars().all()

    if conversations:
        conv_lines = ["\n## Recent Conversations (summaries)"]
        for conv in conversations[:3]:
            msg_result = await db.execute(
                select(Message)
                .where(Message.conversation_id == conv.id, Message.role == "user")
                .order_by(Message.created_at)
                .limit(3)
            )
            user_msgs = msg_result.scalars().all()
            if user_msgs:
                topics = [m.content[:80] for m in user_msgs]
                conv_lines.append(f"- User asked about: {'; '.join(topics)}")
        sections.append("\n".join(conv_lines))

    return "\n".join(sections)


# ── System prompt — the Mentor's personality ───────────────────────────────

SYSTEM_PROMPT_BASE = """\
You are the Lynks Mentor — a warm, encouraging career guide for young people in the \
Caribbean. You help users understand their career path, celebrate their progress, and \
connect them with the right tools and opportunities.

## Your personality
- Speak like a supportive mentor, not a corporate assistant
- Explain concepts using first principles and concrete analogies, not jargon
- Be encouraging but honest — don't oversell or overpromise
- Be aware of Caribbean context — regional institutions, culture, and realities

## Your capabilities
You have access to tools that let you take real actions for the user:
- generate_roadmap: Creates or regenerates a personalized career roadmap
- get_portfolio: Retrieves the user's verified evidence and completed tasks
- find_opportunities: Searches for Caribbean-relevant jobs, competitions, scholarships, clubs, and events
- complete_task: Marks a task as complete in the user's roadmap

## When to use a tool vs. answer directly
- If the user asks for a roadmap, wants to change their career path, or asks \"what should I do\" → call generate_roadmap
- If the user asks about their progress, portfolio, or verified evidence → call get_portfolio
- If the user asks about jobs, competitions, scholarships, or opportunities → call find_opportunities
- If the user says they completed something or want to mark a task done → call complete_task with the task_id
- If the user asks a general question (explain a concept, general encouragement, small talk) → answer directly, no tool needed

## How to use the user context
You have access to the user's full context including their profile, active roadmap with all \
steps and tasks (marked with ✅ or ⬜), portfolio, and recent conversations. Use this context \
to give personalized, specific advice. Reference their actual roadmap steps, task progress, \
and career path in your responses. Don't give generic advice — tailor it to where they are \
in their journey.

## Rules
- Only call a tool when the user's intent clearly requires it
- After a tool returns data, explain it in your own words — don't just dump raw JSON
- If a tool fails (e.g., profile incomplete), explain the issue simply and tell them what to do next
- Reference the user's specific roadmap steps and progress when giving advice
- Celebrate completions enthusiastically — \"You just completed X! That's amazing!\"
"""


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
            category = tool_args.get("category") if isinstance(tool_args, dict) else None
            opportunities = await discover_opportunities(db, user_id, category)
            return {"opportunities": opportunities}

        if tool_name == "complete_task":
            task_id = tool_args.get("task_id") if isinstance(tool_args, dict) else None
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
    except Exception as e:
        logger.error("Tool execution error for %s: %s", tool_name, e)
        return {"error": f"tool_error: {str(e)[:200]}"}


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
    """
    conversation = await _get_or_create_conversation(db, user_id, conversation_id)
    history = await _load_conversation_history(db, conversation.id)

    # Save the user's message
    await _save_message(db, conversation.id, "user", message)

    # Load full user context (profile, roadmap, portfolio, past conversations)
    user_context = await _load_user_context(db, user_id)

    client = OpenAI(api_key=settings.LLM_API_KEY, base_url=settings.LLM_API_BASE_URL)

    system_prompt = SYSTEM_PROMPT_BASE + f"\n\n---\n\n# Current User Context\n\n{user_context}"

    messages = [{"role": "system", "content": system_prompt}] + history + [{"role": "user", "content": message}]

    # First LLM call — may request a tool call
    response = client.chat.completions.create(
        model=settings.LLM_MODEL,
        messages=messages,
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
        updated_context = await _load_user_context(db, user_id)
        messages[0] = {"role": "system", "content": SYSTEM_PROMPT_BASE + f"\n\n---\n\n# Current User Context\n\n{updated_context}"}

        # Second LLM call — generate the natural-language response using tool results
        final_response = client.chat.completions.create(
            model=settings.LLM_MODEL,
            messages=messages,
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

    return {
        "conversation_id": conversation.id,
        "response": response_text,
        "tool_calls": tool_calls_made,
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
