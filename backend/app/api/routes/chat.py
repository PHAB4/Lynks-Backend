"""
Chat API routes — matches API_CONTRACT.md exactly.

POST   /chat/message     → send a message, get a response (Mentor-Orchestrator)
GET    /chat/history      → get conversation history
DELETE /chat/history      → delete all conversation history
GET    /chat/conversations → list all conversations (sidebar)
GET    /chat/conversations/{id} → get messages for a specific conversation
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import func as sqlfunc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.mentor import delete_chat_history, get_chat_history, send_message
from app.core.security import get_current_user_id
from app.db.postgres import get_db
from app.models.db_models import Conversation, Message

router = APIRouter(prefix="/chat", tags=["chat"])


class ChatMessageRequest(BaseModel):
    conversation_id: str | None = None
    message: str


@router.post("/message")
async def post_chat_message(
    body: ChatMessageRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Send a message to the Mentor. The Mentor may call other agents
    (Career Architect, Portfolio Manager, Job Scout) depending on intent.
    """
    if not body.message or not body.message.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": {"code": "empty_message", "message": "message cannot be empty"}},
        )

    try:
        result = await send_message(db, user_id, body.message, body.conversation_id)
    except (ValueError, RuntimeError) as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error": {"code": "chat_error", "message": str(e)}},
        )

    return result


@router.get("/history")
async def get_chat_history_route(
    conversation_id: str | None = Query(None),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Get message history for a conversation, or the most recent one if not specified."""
    try:
        history = await get_chat_history(db, user_id, conversation_id)
    except ValueError as e:
        code = str(e).split(":")[0]
        message = str(e).split(":", 1)[1].strip() if ":" in str(e) else str(e)
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": code, "message": message}},
        )

    return history


@router.delete("/history")
async def delete_chat_history_route(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Delete all conversation history for the user."""
    await delete_chat_history(db, user_id)
    return {"success": True}


@router.get("/conversations")
async def list_conversations(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """List all conversations for the sidebar — titles, summaries, timestamps, message counts."""
    result = await db.execute(
        select(Conversation).where(Conversation.user_id == user_id).order_by(Conversation.created_at.desc()).limit(50)
    )
    conversations = result.scalars().all()

    items = []
    for conv in conversations:
        # Get message count
        count_result = await db.execute(select(sqlfunc.count(Message.id)).where(Message.conversation_id == conv.id))
        msg_count = count_result.scalar() or 0

        # Generate title from first user message if no summary
        title = conv.summary
        if not title:
            first_msg_result = await db.execute(
                select(Message)
                .where(Message.conversation_id == conv.id, Message.role == "user")
                .order_by(Message.created_at)
                .limit(1)
            )
            first_msg = first_msg_result.scalar_one_or_none()
            if first_msg:
                title = first_msg.content[:60] + ("..." if len(first_msg.content) > 60 else "")

        items.append(
            {
                "conversation_id": conv.id,
                "title": title,
                "summary": conv.summary,
                "message_count": msg_count,
                "created_at": conv.created_at,
            }
        )

    return {"conversations": items}


@router.get("/conversations/{conversation_id}")
async def get_conversation_messages(
    conversation_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Get all messages for a specific conversation (full scrollable history)."""
    conv = await db.get(Conversation, conversation_id)
    if not conv or conv.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "not_found", "message": "Conversation not found"}},
        )

    result = await db.execute(
        select(Message).where(Message.conversation_id == conversation_id).order_by(Message.created_at)
    )
    messages = result.scalars().all()

    return {
        "conversation_id": conv.id,
        "summary": conv.summary,
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
