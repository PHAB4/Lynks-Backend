"""
Roadmap API routes — matches API_CONTRACT.md exactly.

POST /roadmap/generate  -> triggers the Career Architect
GET  /roadmap            -> returns the user's active roadmap
POST /roadmap/regenerate -> rebuilds after a career path change
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.agents.architect import generate_roadmap
from backend.app.core.security import get_current_user_id
from backend.app.db.postgres import get_db
from backend.app.models.db_models import Roadmap, Task, User

router = APIRouter(prefix="/roadmap", tags=["roadmap"])


def _roadmap_to_response(roadmap: Roadmap) -> dict:
    steps_response = []
    for step in sorted(roadmap.steps, key=lambda s: s.order):
        tasks = sorted(step.tasks, key=lambda t: t.order)
        step_status = "complete" if tasks and all(t.status == "complete" for t in tasks) else "pending"
        steps_response.append({
            "step_id": step.id,
            "title": step.title,
            "description": step.description,
            "order": step.order,
            "status": step_status,
            "tasks": [
                {"task_id": t.id, "title": t.title, "description": t.description, "order": t.order, "status": t.status}
                for t in tasks
            ],
        })
    return {"roadmap_id": roadmap.id, "steps": steps_response}


async def _get_active_roadmap(db: AsyncSession, user_id: str) -> Roadmap | None:
    result = await db.execute(
        select(Roadmap).where(Roadmap.user_id == user_id, Roadmap.is_active == True)
    )
    roadmap = result.scalar_one_or_none()
    if roadmap:
        await db.refresh(roadmap, ["steps"])
        for step in roadmap.steps:
            await db.refresh(step, ["tasks"])
    return roadmap


@router.post("/generate", status_code=status.HTTP_201_CREATED)
async def post_roadmap_generate(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    try:
        result = await generate_roadmap(db, user_id)
    except ValueError as e:
        code = str(e).split(":")[0]
        message = str(e).split(":", 1)[1].strip() if ":" in str(e) else str(e)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail={"error": {"code": code, "message": message}})
    except RuntimeError as e:
        code = str(e).split(":")[0]
        message = str(e).split(":", 1)[1].strip() if ":" in str(e) else str(e)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail={"error": {"code": code, "message": message}})
    return result


@router.get("")
async def get_roadmap(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    roadmap = await _get_active_roadmap(db, user_id)
    if not roadmap:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"error": {"code": "no_roadmap_found", "message": "No roadmap found. Generate one first."}})
    return _roadmap_to_response(roadmap)


@router.post("/regenerate", status_code=status.HTTP_201_CREATED)
async def post_roadmap_regenerate(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    try:
        result = await generate_roadmap(db, user_id)
    except ValueError as e:
        code = str(e).split(":")[0]
        message = str(e).split(":", 1)[1].strip() if ":" in str(e) else str(e)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail={"error": {"code": code, "message": message}})
    except RuntimeError as e:
        code = str(e).split(":")[0]
        message = str(e).split(":", 1)[1].strip() if ":" in str(e) else str(e)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail={"error": {"code": code, "message": message}})
    return result