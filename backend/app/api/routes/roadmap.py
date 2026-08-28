"""
Roadmap API routes — matches API_CONTRACT.md exactly.

POST /roadmap/generate  → triggers the Career Architect
GET  /roadmap            → returns the user's active roadmap
POST /roadmap/regenerate → rebuilds after a career path change
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.architect import generate_roadmap
from app.core.security import get_current_user_id
from app.db.postgres import get_db
from app.models.db_models import Roadmap, Task, User

router = APIRouter(prefix="/roadmap", tags=["roadmap"])


# ── Helpers ────────────────────────────────────────────────────────────────


def _roadmap_to_response(roadmap: Roadmap) -> dict:
    """Convert a loaded Roadmap ORM object to the API_CONTRACT.md response shape."""
    steps_response = []
    for step in sorted(roadmap.steps, key=lambda s: s.order):
        tasks = sorted(step.tasks, key=lambda t: t.order)
        if tasks and all(t.status == "complete" for t in tasks):
            step_status = "complete"
        else:
            step_status = "pending"

        steps_response.append(
            {
                "step_id": step.id,
                "title": step.title,
                "description": step.description,
                "order": step.order,
                "status": step_status,
                "tasks": [
                    {
                        "task_id": t.id,
                        "title": t.title,
                        "description": t.description,
                        "order": t.order,
                        "status": t.status,
                    }
                    for t in tasks
                ],
            }
        )

    return {
        "roadmap_id": roadmap.id,
        "steps": steps_response,
    }


async def _get_active_roadmap(db: AsyncSession, user_id: str) -> Roadmap | None:
    """Load the user's active roadmap with steps + tasks eagerly loaded."""
    result = await db.execute(
        select(Roadmap).where(
            Roadmap.user_id == user_id,
            Roadmap.is_active == True,  # noqa: E712
        )
    )
    roadmap = result.scalar_one_or_none()
    if roadmap:
        # Eagerly load steps and tasks so we don't get async lazy-load issues
        await db.refresh(roadmap, ["steps"])
        for step in roadmap.steps:
            await db.refresh(step, ["tasks"])
    return roadmap


# ── POST /roadmap/generate ─────────────────────────────────────────────────


@router.post("/generate", status_code=status.HTTP_201_CREATED)
async def post_roadmap_generate(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Trigger the Career Architect agent to build a roadmap from the user's profile.

    Returns 201 with the full roadmap on success.
    Returns 400 if the profile is missing required fields.
    """
    try:
        result = await generate_roadmap(db, user_id)
    except ValueError as e:
        code = str(e).split(":")[0]
        message = str(e).split(":", 1)[1].strip() if ":" in str(e) else str(e)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": {"code": code, "message": message}},
        )
    except RuntimeError as e:
        code = str(e).split(":")[0]
        message = str(e).split(":", 1)[1].strip() if ":" in str(e) else str(e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error": {"code": code, "message": message}},
        )

    return result


# ── GET /roadmap ───────────────────────────────────────────────────────────


@router.get("")
async def get_roadmap(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Return the user's current (active) roadmap with nested steps and tasks.
    """
    roadmap = await _get_active_roadmap(db, user_id)
    if not roadmap:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": {
                    "code": "no_roadmap_found",
                    "message": "No roadmap found for this user. Generate one first.",
                }
            },
        )
    return _roadmap_to_response(roadmap)


# ── POST /roadmap/regenerate ───────────────────────────────────────────────


@router.post("/regenerate", status_code=status.HTTP_201_CREATED)
async def post_roadmap_regenerate(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Regenerate the roadmap after the user changes their career path.
    Deactivates the old roadmap and creates a new one.
    """
    try:
        result = await generate_roadmap(db, user_id)
    except ValueError as e:
        code = str(e).split(":")[0]
        message = str(e).split(":", 1)[1].strip() if ":" in str(e) else str(e)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": {"code": code, "message": message}},
        )
    except RuntimeError as e:
        code = str(e).split(":")[0]
        message = str(e).split(":", 1)[1].strip() if ":" in str(e) else str(e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error": {"code": code, "message": message}},
        )

    return result
