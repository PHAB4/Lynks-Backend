"""
Dashboard summary route — single-call aggregation for the home screen.

GET /dashboard/summary → profile, roadmap progress, opportunities, notifications, onboarding state
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user_id
from app.db.postgres import get_db
from app.models.db_models import (
    Conversation,
    Message,
    Notification,
    Roadmap,
    Step,
    Task,
    User,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


def _calc_roadmap_progress(roadmap: Roadmap) -> dict:
    """Compute task-level progress for a roadmap.

    Step status is computed dynamically from child tasks — we never
    store it.  A step is "complete" only when ALL its tasks are complete.
    """
    total_tasks = 0
    completed_tasks = 0
    current_step_title = None
    current_step_index = 0

    for step_idx, step in enumerate(roadmap.steps):
        step_tasks = step.tasks
        total_tasks += len(step_tasks)
        completed_tasks += sum(1 for t in step_tasks if t.status == "complete")
        step_complete = all(t.status == "complete" for t in step_tasks) if step_tasks else False

        if current_step_title is None and not step_complete:
            current_step_title = step.title
            current_step_index = step_idx

    # If all steps are complete (or there are no tasks), current_step = last step
    if current_step_title is None:
        if roadmap.steps:
            last_step = roadmap.steps[-1]
            current_step_title = last_step.title
            current_step_index = len(roadmap.steps) - 1
        else:
            current_step_title = ""
            current_step_index = 0

    progress_percent = (
        round((completed_tasks / total_tasks) * 100) if total_tasks > 0 else 0
    )

    return {
        "has_roadmap": True,
        "career_path": roadmap.career_path,
        "total_tasks": total_tasks,
        "completed_tasks": completed_tasks,
        "progress_percent": progress_percent,
        "current_step": current_step_title,
        "current_step_index": current_step_index,
        "total_steps": len(roadmap.steps),
    }


def _build_onboarding_checklist(
    user: User,
    has_roadmap: bool,
    has_chat: bool,
) -> dict:
    """Determine which onboarding steps the user has completed."""
    has_profile = bool(user.career_path and user.interests and len(user.interests) > 0)
    return {
        "complete_profile": has_profile,
        "start_chat": has_chat,
        "generate_roadmap": has_roadmap,
        "browse_opportunities": False,
    }


@router.get("/summary")
async def dashboard_summary(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Aggregate everything the dashboard needs in one call.

    Each section is fetched independently — a failure in one section
    does not prevent the others from returning.
    """
    result: dict = {}

    # ── Profile ─────────────────────────────────────────────────────────
    try:
        user_result = await db.execute(select(User).where(User.id == user_id))
        user = user_result.scalar_one_or_none()
        if user:
            result["profile"] = {
                "name": user.name,
                "email": user.email,
                "role": user.education_level or "student",
                "interests": user.interests or [],
                "career_path": user.career_path,
                "has_completed_onboarding": bool(
                    user.career_path and user.interests and len(user.interests) > 0
                ),
            }
        else:
            result["profile"] = None
    except Exception:
        logger.exception("Failed to fetch profile for dashboard")
        result["profile"] = None

    # ── Roadmap ─────────────────────────────────────────────────────────
    roadmap_section: dict = {
        "has_roadmap": False,
        "career_path": None,
        "total_tasks": 0,
        "completed_tasks": 0,
        "progress_percent": 0,
        "current_step": None,
        "current_step_index": 0,
        "total_steps": 0,
    }
    try:
        roadmap_result = await db.execute(
            select(Roadmap)
            .where(Roadmap.user_id == user_id, Roadmap.is_active == True)  # noqa: E712
            .order_by(Roadmap.created_at.desc())
            .limit(1)
        )
        roadmap = roadmap_result.scalar_one_or_none()
        if roadmap:
            # Eagerly load steps and tasks
            steps_result = await db.execute(
                select(Step)
                .where(Step.roadmap_id == roadmap.id)
                .order_by(Step.order)
            )
            steps = steps_result.scalars().all()

            for step in steps:
                tasks_result = await db.execute(
                    select(Task)
                    .where(Task.step_id == step.id)
                    .order_by(Task.order)
                )
                step.tasks = list(tasks_result.scalars().all())

            roadmap.steps = list(steps)
            roadmap_section = _calc_roadmap_progress(roadmap)
    except Exception:
        logger.exception("Failed to fetch roadmap for dashboard")
    result["roadmap"] = roadmap_section

    # ── Opportunities ───────────────────────────────────────────────────
    try:
        from app.agents.scout import CARIBBEAN_OPPORTUNITIES

        # Use the curated list — top 3 by first_seen_at desc
        sorted_opps = sorted(
            CARIBBEAN_OPPORTUNITIES,
            key=lambda o: o.get("first_seen_at") or "",
            reverse=True,
        )
        recent = [
            {
                "id": hashlib.md5(o["title"].encode()).hexdigest()[:16],
                "title": o.get("title", "Unknown"),
                "company": o.get("company", "Unknown"),
                "location": o.get("location", "Caribbean"),
                "salary_min": o.get("salary_min"),
                "salary_max": o.get("salary_max"),
                "currency": o.get("salary_currency", "USD"),
                "category": o.get("category", "event"),
                "posted_at": o.get("posted_at"),
            }
            for o in sorted_opps[:3]
        ]
        result["opportunities"] = {
            "new_count": len(CARIBBEAN_OPPORTUNITIES),
            "recent": recent,
        }
    except Exception:
        logger.exception("Failed to fetch opportunities for dashboard")
        result["opportunities"] = {"new_count": 0, "recent": []}

    # ── Notifications ───────────────────────────────────────────────────
    try:
        unread_result = await db.execute(
            select(func.count(Notification.id)).where(
                Notification.user_id == user_id,
                Notification.is_read == False,  # noqa: E712
            )
        )
        unread_count = unread_result.scalar() or 0

        recent_notifs_result = await db.execute(
            select(Notification)
            .where(Notification.user_id == user_id)
            .order_by(Notification.created_at.desc())
            .limit(3)
        )
        recent_notifs = recent_notifs_result.scalars().all()
        result["notifications"] = {
            "unread_count": unread_count,
            "recent": [
                {
                    "id": n.id,
                    "title": n.title,
                    "body": n.body,
                    "type": n.type,
                    "is_read": n.is_read,
                    "created_at": n.created_at.isoformat() if n.created_at else None,
                }
                for n in recent_notifs
            ],
        }
    except Exception:
        logger.exception("Failed to fetch notifications for dashboard")
        result["notifications"] = {"unread_count": 0, "recent": []}

    # ── Onboarding checklist ────────────────────────────────────────────
    try:
        has_roadmap = result["roadmap"].get("has_roadmap", False)
        has_chat = False
        chat_result = await db.execute(
            select(func.count(Message.id))
            .join(Conversation, Message.conversation_id == Conversation.id)
            .where(Conversation.user_id == user_id)
        )
        chat_count = chat_result.scalar() or 0
        has_chat = chat_count > 0

        user_obj = None
        if result.get("profile"):
            user_result2 = await db.execute(select(User).where(User.id == user_id))
            user_obj = user_result2.scalar_one_or_none()

        result["onboarding_checklist"] = _build_onboarding_checklist(
            user_obj, has_roadmap, has_chat
        ) if user_obj else {
            "complete_profile": False,
            "start_chat": False,
            "generate_roadmap": False,
            "browse_opportunities": False,
        }
    except Exception:
        logger.exception("Failed to compute onboarding checklist")
        result["onboarding_checklist"] = {
            "complete_profile": False,
            "start_chat": False,
            "generate_roadmap": False,
            "browse_opportunities": False,
        }

    return result


# hashlib is needed for opportunity IDs — import at module level
import hashlib  # noqa: E402
