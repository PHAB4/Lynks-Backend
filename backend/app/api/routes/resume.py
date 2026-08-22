"""
Resume API routes — LLM-powered resume builder.

POST /resume/generate  → build a resume from user profile + portfolio
GET  /resume           → get the latest resume for the authenticated user
"""

from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from openai import OpenAI
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import get_current_user_id
from app.db.postgres import get_db
from app.models.db_models import Evidence, Resume, Roadmap, Step, Task, User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/resume", tags=["resume"])


# ── LLM Resume Generation ──────────────────────────────────────────────────

SYSTEM_PROMPT = """\
You are a resume builder for young Caribbean professionals.

Given a user's profile and portfolio data, generate a structured resume in JSON format.

Rules:
1. Be concise — this is a 1-page resume
2. Use action verbs ("Built", "Led", "Developed", "Organized")
3. Highlight Caribbean-relevant achievements
4. Include technical skills, education, and project experience
5. Return ONLY valid JSON — no markdown, no commentary
6. Age-appropriate language (they may be a student)
"""

RESUME_SCHEMA = """\
{
  "name": "string",
  "email": "string",
  "objective": "string (1-2 sentence career objective)",
  "education": [
    {
      "institution": "string",
      "level": "string (e.g. High School, Bachelor's)",
      "field": "string",
      "status": "string (e.g. In Progress, Completed)"
    }
  ],
  "skills": ["string"],
  "experience": [
    {
      "title": "string",
      "organization": "string",
      "duration": "string",
      "description": "string"
    }
  ],
  "projects": [
    {
      "name": "string",
      "description": "string",
      "technologies": ["string"]
    }
  ],
  "achievements": ["string"]
}
"""


async def build_resume_with_llm(user: User, db: AsyncSession) -> dict:
    """Generate a resume using the LLM based on user profile and portfolio."""
    client = OpenAI(
        api_key=settings.LLM_API_KEY,
        base_url=settings.LLM_API_BASE_URL,
    )

    # Gather user data
    profile = {
        "name": user.name,
        "email": user.email,
        "age": user.age,
        "country": user.country,
        "education_level": user.education_level,
        "career_path": user.career_path,
        "interests": user.interests or [],
    }

    # Gather portfolio data (completed tasks with evidence)
    portfolio_items = []
    result = await db.execute(
        select(Task).where(Task.status == "completed")
    )
    tasks = result.scalars().all()
    for task in tasks:
        ev_result = await db.execute(
            select(Evidence).where(Evidence.task_id == task.id)
        )
        evidences = ev_result.scalars().all()
        portfolio_items.append({
            "task": task.title,
            "description": task.description,
            "evidence_count": len(evidences),
        })

    # Gather roadmap steps
    roadmap_result = await db.execute(
        select(Roadmap).where(Roadmap.user_id == user.id))
    roadmap = roadmap_result.scalars().first()
    steps_info = []
    if roadmap:
        step_result = await db.execute(
            select(Step).where(Step.roadmap_id == roadmap.id))
        steps = step_result.scalars().all()
        steps_info = [{"title": s.title, "description": s.description} for s in steps]

    user_data = (
        f"User profile:\n{json.dumps(profile, indent=2)}\n\n"
        f"Completed projects (from portfolio):\n{json.dumps(portfolio_items, indent=2)}\n\n"
        f"Roadmap steps:\n{json.dumps(steps_info, indent=2)}"
    )

    response = client.chat.completions.create(
        model=settings.LLM_MODEL,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT + "\n\nOutput schema:\n" + RESUME_SCHEMA},
            {"role": "user", "content": user_data},
        ],
        temperature=0.3,
        max_tokens=4096,
    )

    raw = response.choices[0].message.content.strip()

    # Strip markdown fences if present
    if raw.startswith("```"):
        lines = raw.split("\n")
        lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        raw = "\n".join(lines)

    return json.loads(raw)


# ── Routes ─────────────────────────────────────────────────────────────────


@router.post("/generate", status_code=201)
async def generate_resume(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Generate a new resume using the LLM."""
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="user_not_found")

    try:
        content = await build_resume_with_llm(user, db)
    except json.JSONDecodeError:
        raise HTTPException(status_code=502, detail="LLM returned invalid JSON")
    except Exception as e:
        logger.error("Resume generation failed: %s", e)
        raise HTTPException(status_code=502, detail=f"LLM error: {str(e)[:200]}")

    resume = Resume(
        id=str(uuid.uuid4()),
        user_id=user_id,
        content=content,
        created_at=datetime.now(timezone.utc),
    )
    db.add(resume)
    await db.commit()
    await db.refresh(resume)

    return {
        "resume_id": resume.id,
        "content": content,
        "created_at": resume.created_at.isoformat(),
    }


@router.get("")
async def get_resume(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Get the latest resume for the authenticated user."""
    result = await db.execute(
        select(Resume)
        .where(Resume.user_id == user_id)
        .order_by(Resume.created_at.desc())
        .limit(1)
    )
    resume = result.scalars().first()
    if not resume:
        raise HTTPException(status_code=404, detail="no_resume_found")

    return {
        "resume_id": resume.id,
        "content": resume.content,
        "created_at": resume.created_at.isoformat(),
    }
