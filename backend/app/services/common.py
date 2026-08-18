"""Services — shared business logic."""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.models.db_models import User


async def get_user_or_404(db: AsyncSession, user_id: str) -> User:
    user = await db.get(User, user_id)
    if not user:
        raise ValueError("user_not_found: no user with this ID")
    return user


def compute_step_status(tasks: list) -> str:
    if not tasks:
        return "pending"
    return "complete" if all(t.status == "complete" for t in tasks) else "pending"