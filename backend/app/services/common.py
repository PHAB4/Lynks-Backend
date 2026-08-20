"""
Services — business logic that's more than a couple of lines
but doesn't belong in a route file.
"""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.db_models import User


async def get_user_or_404(db: AsyncSession, user_id: str) -> User:
    """Load a user by ID, or raise ValueError if not found."""
    user = await db.get(User, user_id)
    if not user:
        raise ValueError("user_not_found: no user with this ID")
    return user


def compute_step_status(tasks: list) -> str:
    """
    Compute a step's status from its child tasks.
    "complete" only if ALL tasks are complete; "pending" otherwise.
    This is the proposal from SCHEMA.md — status is derived, not stored.
    """
    if not tasks:
        return "pending"
    return "complete" if all(t.status == "complete" for t in tasks) else "pending"