"""
Memory API routes — user memory management.

GET    /memory          → list user's memories
POST   /memory          → manually add a memory
PATCH  /memory/{id}     → edit a memory
DELETE /memory/{id}     → delete a memory
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user_id
from app.db.postgres import get_db
from app.models.db_models import UserMemory
from app.models.schemas import MemoryCreateRequest, MemoryResponse, MemoryUpdateRequest

router = APIRouter(prefix="/memory", tags=["memory"])


@router.get("")
async def list_memories(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """List all memories for the current user."""
    result = await db.execute(
        select(UserMemory).where(UserMemory.user_id == user_id).order_by(UserMemory.created_at.desc()).limit(30)
    )
    memories = result.scalars().all()

    return {
        "memories": [
            MemoryResponse(
                id=m.id,
                fact=m.fact,
                category=m.category,
                source=m.source,
                created_at=m.created_at,
            )
            for m in memories
        ]
    }


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_memory(
    body: MemoryCreateRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Manually add a memory (e.g. from onboarding or user correction)."""
    valid_categories = {"preference", "goal", "context", "milestone", "personality", "general"}
    category = body.category if body.category in valid_categories else "general"

    memory = UserMemory(
        user_id=user_id,
        fact=body.fact,
        category=category,
        source=body.source,
    )
    db.add(memory)
    await db.commit()
    await db.refresh(memory)

    return MemoryResponse(
        id=memory.id,
        fact=memory.fact,
        category=memory.category,
        source=memory.source,
        created_at=memory.created_at,
    )


@router.patch("/{memory_id}")
async def update_memory(
    memory_id: str,
    body: MemoryUpdateRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Edit a specific memory."""
    memory = await db.get(UserMemory, memory_id)
    if not memory or memory.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "not_found", "message": "Memory not found"}},
        )

    if body.fact is not None:
        memory.fact = body.fact
    if body.category is not None:
        valid_categories = {"preference", "goal", "context", "milestone", "personality", "general"}
        memory.category = body.category if body.category in valid_categories else "general"

    await db.commit()
    await db.refresh(memory)

    return MemoryResponse(
        id=memory.id,
        fact=memory.fact,
        category=memory.category,
        source=memory.source,
        created_at=memory.created_at,
    )


@router.delete("/{memory_id}")
async def delete_memory(
    memory_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Delete a specific memory."""
    memory = await db.get(UserMemory, memory_id)
    if not memory or memory.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "not_found", "message": "Memory not found"}},
        )

    await db.delete(memory)
    await db.commit()

    return {"success": True}
