"""
Resume API routes — generate and retrieve resumes.

POST /resume/generate  → generate a resume from user profile + portfolio
GET  /resume           → get the user's latest resume
"""

from __future__ import annotations

import asyncio
import json
import logging
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from openai import OpenAI
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.agents.portfolio_manager import get_user_portfolio
from app.core.config import settings
from app.core.security import get_current_user_id
from app.db.postgres import get_db
from app.models.db_models import Resume, Roadmap, Step, Task, User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/resume", tags=["resume"])


# ── LLM resume generation ──────────────────────────────────────────────────

SYSTEM_PROMPT = """\
You are a professional resume writer for Caribbean young people.

Given a user's profile, roadmap, and portfolio of completed tasks with evidence, \
generate a structured resume as a JSON object.

## Output format

Return a JSON object with this exact structure:

{
  "name": "string",
  "email": "string",
  "objective": "string (2-3 sentence career objective)",
  "education": [
    {
      "institution": "string",
      "level": "string",
      "details": "string"
    }
  ],
  "skills": ["string"],
  "experience": [
    {
      "title": "string",
      "organization": "string",
      "description": "string"
    }
  ],
  "projects": [
    {
      "title": "string",
      "description": "string",
      "skills_used": ["string"]
    }
  ],
  "certifications": ["string"],
  "interests": ["string"]
}

## Rules
- Skills should be derived from completed tasks and career path
- Projects should come from the portfolio evidence (completed tasks)
- Keep descriptions concise but impactful
- Use action verbs (Built, Developed, Implemented, Led, Designed)
- Tailor to the user's career path
- Return ONLY valid JSON, no markdown fences
"""


def _build_resume_prompt(user, portfolio, roadmap) -> str:
    parts = [
        f"## User Profile\n- Name: {user.name}\n- Email: {user.email}\n- Country: {user.country}\n- Education: {user.education_level}\n- Career path: {user.career_path}\n- Interests: {', '.join(user.interests) if user.interests else 'N/A'}"
    ]

    if portfolio:
        parts.append("\n## Completed Tasks (with evidence)")
        for item in portfolio:
            ev_count = len(item.get("evidence", []))
            parts.append(f"- {item['title']} ({ev_count} evidence files)")

    if roadmap:
        parts.append(f"\n## Career Roadmap: {roadmap.career_path}")
        for step in roadmap.steps:
            completed = [t.title for t in step.tasks if t.status == "complete"]
            if completed:
                parts.append(f"- Step {step.order}: {step.title} — completed: {', '.join(completed)}")

    return "\n".join(parts)


# ── Routes ──────────────────────────────────────────────────────────────────


@router.post("/generate", status_code=201)
async def generate_resume(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Generate a resume from the user's profile, portfolio, and roadmap."""
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    portfolio = await get_user_portfolio(db, user_id)

    result = await db.execute(
        select(Roadmap)
        .options(selectinload(Roadmap.steps).selectinload(Step.tasks))
        .where(Roadmap.user_id == user_id, Roadmap.is_active)
    )
    roadmap = result.scalar_one_or_none()

    user_prompt = _build_resume_prompt(user, portfolio, roadmap)

    def _call_llm_sync() -> str:
        client = OpenAI(
            api_key=settings.LLM_API_KEY,
            base_url=settings.LLM_API_BASE_URL,
            timeout=30.0,
            max_retries=1,
        )
        response = client.chat.completions.create(
            model=settings.LLM_MODEL,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.5,
            max_tokens=4096,
        )
        content = response.choices[0].message.content
        if not content:
            raise ValueError("LLM returned empty response — possibly rate limited")
        return content.strip()

    try:
        raw_content = await asyncio.to_thread(_call_llm_sync)
    except ValueError as e:
        logger.error("Resume LLM returned empty response: %s", e)
        raise HTTPException(status_code=429, detail={
            "error": {"code": "rate_limited", "message": "LLM rate limit exceeded. Please try again in a minute."}
        })
    except Exception as e:
        if "rate" in str(e).lower() or "429" in str(e):
            raise HTTPException(status_code=429, detail={
                "error": {"code": "rate_limited", "message": "LLM rate limit exceeded. Please try again in a minute."}
            })
        logger.error("Resume LLM call failed: %s", e)
        raise HTTPException(status_code=500, detail={
            "error": {"code": "llm_error", "message": "Failed to generate resume. Please try again."}
        })

    if raw_content.startswith("```"):
        lines = raw_content.split("\n")
        lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        raw_content = "\n".join(lines)

    try:
        resume_data = json.loads(raw_content)
    except json.JSONDecodeError as e:
        logger.error("LLM returned invalid JSON for resume: %s | Raw: %s", e, raw_content[:500])
        raise HTTPException(status_code=500, detail={
            "error": {"code": "resume_parse_error", "message": "The AI returned an invalid response. Please try again."}
        })

    resume = Resume(
        id=str(uuid.uuid4()),
        user_id=user_id,
        content=resume_data,
    )
    db.add(resume)
    await db.commit()
    await db.refresh(resume)

    return {
        "resume_id": resume.id,
        "content": resume_data,
        "created_at": resume.created_at.isoformat() if resume.created_at else None,
    }


@router.get("")
async def get_resume(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Get the user's latest resume."""
    result = await db.execute(
        select(Resume).where(Resume.user_id == user_id).order_by(Resume.created_at.desc()).limit(1)
    )
    resume = result.scalar_one_or_none()
    if not resume:
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": "no_resume", "message": "No resume found. Call POST /resume/generate first."}},
        )

    return {
        "resume_id": resume.id,
        "content": resume.content,
        "created_at": resume.created_at.isoformat() if resume.created_at else None,
        "updated_at": resume.updated_at.isoformat() if resume.updated_at else None,
    }


class ResumeUpdateRequest(BaseModel):
    content: dict


@router.patch("")
async def update_resume(
    body: ResumeUpdateRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Update the user's resume content (user-edited fields)."""
    result = await db.execute(
        select(Resume).where(Resume.user_id == user_id).order_by(Resume.created_at.desc()).limit(1)
    )
    resume = result.scalar_one_or_none()
    if not resume:
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": "no_resume", "message": "No resume found. Create one first."}},
        )

    resume.content = body.content
    await db.commit()
    await db.refresh(resume)

    return {
        "resume_id": resume.id,
        "content": resume.content,
        "created_at": resume.created_at.isoformat() if resume.created_at else None,
        "updated_at": resume.updated_at.isoformat() if resume.updated_at else None,
    }