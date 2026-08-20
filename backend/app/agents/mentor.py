"""Mentor-Orchestrator Agent — unified conversational interface."""
from __future__ import annotations
import json
import logging
import uuid
from datetime import datetime, timezone
from openai import OpenAI
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.agents.architect import generate_roadmap
from app.agents.portfolio_manager import get_user_portfolio
from app.agents.scout import discover_opportunities
from app.core.config import settings
from app.models.db_models import Conversation, Message, User

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are the Lynks Mentor — a warm, encouraging career guide for young people in the Caribbean. You have access to tools: generate_roadmap, get_portfolio, find_opportunities. Use them when the user's intent clearly requires it. Otherwise answer directly."""

TOOLS = [
    {"type": "function", "function": {"name": "generate_roadmap", "description": "Generate or regenerate the user's career roadmap.", "parameters": {"type": "object", "properties": {}, "required": []}}},
    {"type": "function", "function": {"name": "get_portfolio", "description": "Get the user's portfolio and verified evidence.", "parameters": {"type": "object", "properties": {}, "required": []}}},
    {"type": "function", "function": {"name": "find_opportunities", "description": "Search for Caribbean opportunities.", "parameters": {"type": "object", "properties": {"category": {"type": "string", "enum": ["job", "club", "competition", "scholarship", "event", "volunteer"]}}, "required": []}}},
]


async def _execute_tool(db, user_id, tool_name, tool_args):
    try:
        if tool_name == "generate_roadmap":
            return await generate_roadmap(db, user_id)
        if tool_name == "get_portfolio":
            return {"portfolio": await get_user_portfolio(db, user_id)}
        if tool_name == "find_opportunities":
            return {"opportunities": await discover_opportunities(db, user_id, tool_args.get("category"))}
        return {"error": f"unknown_tool: {tool_name}"}
    except Exception as e:
        return {"error": str(e)}


async def _get_or_create_conversation(db, user_id, conversation_id):
    if conversation_id:
        conv = await db.get(Conversation, conversation_id)
        if conv and conv.user_id == user_id:
            return conv
    conv = Conversation(id=str(uuid.uuid4()), user_id=user_id)
    db.add(conv)
    await db.commit()
    await db.refresh(conv)
    return conv


async def _load_history(db, conversation_id):
    result = await db.execute(select(Message).where(Message.conversation_id == conversation_id).order_by(Message.created_at))
    return [{"role": m.role, "content": m.content} for m in result.scalars().all()]


async def _save_message(db, conversation_id, role, content, tool_calls=None):
    msg = Message(id=str(uuid.uuid4()), conversation_id=conversation_id, role=role, content=content, tool_calls=tool_calls)
    db.add(msg)
    await db.commit()
    await db.refresh(msg)
    return msg


async def send_message(db, user_id, message, conversation_id=None):
    conv = await _get_or_create_conversation(db, user_id, conversation_id)
    history = await _load_history(db, conv.id)
    await _save_message(db, conv.id, "user", message)
    client = OpenAI(api_key=settings.LLM_API_KEY, base_url=settings.LLM_API_BASE_URL)
    messages = [{"role": "system", "content": SYSTEM_PROMPT}] + history + [{"role": "user", "content": message}]
    response = client.chat.completions.create(model=settings.LLM_MODEL, messages=messages, tools=TOOLS, tool_choice="auto", temperature=0.7, max_tokens=2048)
    choice = response.choices[0]
    tool_calls_made = None
    if choice.finish_reason == "tool_calls" and choice.message.tool_calls:
        tool_calls_made = []
        messages.append(choice.message.model_dump())
        for tc in choice.message.tool_calls:
            try:
                args = json.loads(tc.function.arguments or "{}")
            except json.JSONDecodeError:
                args = {}
            result = await _execute_tool(db, user_id, tc.function.name, args)
            tool_calls_made.append({"tool": tc.function.name, "args": args, "result": result})
            messages.append({"role": "tool", "tool_call_id": tc.id, "content": json.dumps(result)})
        final = client.chat.completions.create(model=settings.LLM_MODEL, messages=messages, temperature=0.7, max_tokens=2048)
        response_text = final.choices[0].message.content or ""
    else:
        response_text = choice.message.content or ""
    await _save_message(db, conv.id, "assistant", response_text, {"calls": tool_calls_made} if tool_calls_made else None)
    return {"conversation_id": conv.id, "response": response_text, "tool_calls": tool_calls_made}


async def get_chat_history(db, user_id, conversation_id=None):
    if conversation_id:
        conv = await db.get(Conversation, conversation_id)
        if not conv or conv.user_id != user_id:
            raise ValueError("conversation_not_found: no conversation with this ID")
    else:
        result = await db.execute(select(Conversation).where(Conversation.user_id == user_id).order_by(Conversation.created_at.desc()).limit(1))
        conv = result.scalar_one_or_none()
        if not conv:
            raise ValueError("no_conversations: no conversation history found")
    messages = await _load_history(db, conv.id)
    return {"conversation_id": conv.id, "messages": messages}


async def delete_chat_history(db, user_id):
    result = await db.execute(select(Conversation).where(Conversation.user_id == user_id))
    convs = result.scalars().all()
    for conv in convs:
        await db.execute(select(Message).where(Message.conversation_id == conv.id))
        await db.delete(conv)
    await db.commit()