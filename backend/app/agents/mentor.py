"""
Mentor Chatbot — the conversational orchestrator for Lynks.

This is BOTH the "mentor" (friendly, Caribbean-aware career guide) AND the
"orchestrator" (routes user intent to the right agent). These aren't separate
pieces — a single conversational agent that:

  1. Talks to the user in a warm, encouraging, first-principles way
  2. Has access to all other agents as "tools" it can call
  3. Infers from the user's message whether it should:
     a) Answer directly (general questions, encouragement, explanations)
     b) Call the Career Architect (roadmap generation/regeneration)
     c) Call the Portfolio Manager (evidence status, portfolio questions)
     d) Call the Job Scout (opportunity discovery)
  4. Saves the full conversation history to the database

This uses the OpenAI SDK's function-calling ("tools") feature — the same
pattern used by ChatGPT plugins and Claude tools. The LLM decides which
tool to call based on the conversation; we execute it and feed the result
back to the LLM to generate the final natural-language response.
"""

from __future__ import annotations

import json
import logging
import uuid

from openai import OpenAI
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.agents.architect import generate_roadmap
from backend.app.agents.portfolio_manager import get_user_portfolio
from backend.app.agents.scout import discover_opportunities
from backend.app.core.config import settings
from backend.app.models.db_models import Conversation, Message

logger = logging.getLogger(__name__)


SYSTEM_PROMPT = """\
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

## When to use a tool vs. answer directly
- If the user asks for a roadmap, wants to change their career path, or asks "what should I do" -> call generate_roadmap
- If the user asks about their progress, portfolio, or verified evidence -> call get_portfolio
- If the user asks about jobs, competitions, scholarships, or opportunities -> call find_opportunities
- If the user asks a general question (explain a concept, general encouragement, small talk) -> answer directly, no tool needed

## Rules
- Only call a tool when the user's intent clearly requires it
- After a tool returns data, explain it in your own words — don't just dump raw JSON
- If a tool fails (e.g., profile incomplete), explain the issue simply and tell them what to do next
"""


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
]


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

        return {"error": f"unknown_tool: {tool_name}"}
    except ValueError as e:
        return {"error": str(e)}
    except RuntimeError as e:
        return {"error": str(e)}


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


async def send_message(
    db: AsyncSession,
    user_id: str,
    message: str,
    conversation_id: str | None = None,
) -> dict:
    """
    Process a user's chat message: run it through the LLM with tool access,
    execute any tool calls, and return the final response.
    """
    conversation = await _get_or_create_conversation(db, user_id, conversation_id)
    history = await _load_conversation_history(db, conversation.id)

    await _save_message(db, conversation.id, "user", message)

    client = OpenAI(api_key=settings.LLM_API_KEY, base_url=settings.LLM_API_BASE_URL)

    messages = [{"role": "system", "content": SYSTEM_PROMPT}] + history + [{"role": "user", "content": message}]

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

        final_response = client.chat.completions.create(
            model=settings.LLM_MODEL,
            messages=messages,
            temperature=0.7,
            max_tokens=2048,
        )
        response_text = final_response.choices[0].message.content or ""
    else:
        response_text = choice.message.content or ""

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