"""Career Architect Agent — generates personalized roadmaps."""
from __future__ import annotations
import json
import logging
import uuid
from datetime import datetime, timezone
from openai import OpenAI
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config import settings
from app.models.db_models import Roadmap, Step, Task, User

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are a career advisor for young people in the Caribbean. Generate a personalized career roadmap as JSON."""

RESPONSE_FORMAT_INSTRUCTIONS = """Return a JSON object with exactly this structure:
{"steps": [{"title": "...", "description": "...", "tasks": [{"title": "...", "description": "..."}]}]}"""


async def generate_roadmap(db: AsyncSession, user_id: str) -> dict:
    user = await db.get(User, user_id)
    if not user:
        raise ValueError("user_not_found: no user with this ID")
    if not user.career_path:
        raise ValueError("incomplete_profile: career_path is required")
    client = OpenAI(api_key=settings.LLM_API_KEY, base_url=settings.LLM_API_BASE_URL)
    result = client.chat.completions.create(
        model=settings.LLM_MODEL,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT + "\n\n" + RESPONSE_FORMAT_INSTRUCTIONS},
            {"role": "user", "content": f"Create a roadmap for someone who wants to be a {user.career_path}. They are {user.age} years old, in {user.country}, with {user.education_level} education."},
        ],
        temperature=0.7,
        max_tokens=2048,
    )
    response_text = result.choices[0].message.content or "{}"
    try:
        roadmap_data = json.loads(response_text)
    except json.JSONDecodeError:
        roadmap_data = {"steps": [{"title": "Get Started", "description": "Begin your journey", "tasks": [{"title": "First step", "description": "Take the first step"}]}]}

    # Deactivate old roadmaps
    from sqlalchemy import update
    await db.execute(update(Roadmap).where(Roadmap.user_id == user_id, Roadmap.is_active == True).values(is_active=False))

    roadmap = Roadmap(id=str(uuid.uuid4()), user_id=user_id, career_path=user.career_path, is_active=True)
    db.add(roadmap)
    await db.flush()

    for step_idx, step_data in enumerate(roadmap_data.get("steps", []), 1):
        step = Step(id=str(uuid.uuid4()), roadmap_id=roadmap.id, title=step_data["title"], description=step_data.get("description", ""), order=step_idx)
        db.add(step)
        await db.flush()
        for task_idx, task_data in enumerate(step_data.get("tasks", []), 1):
            task = Task(id=str(uuid.uuid4()), step_id=step.id, title=task_data["title"], description=task_data.get("description", ""), order=task_idx, status="pending")
            db.add(task)

    await db.commit()
    return {"roadmap_id": roadmap.id, "steps": [{"step_id": s.id, "title": s.title, "description": s.description, "order": s.order, "status": "pending", "tasks": [{"task_id": t.id, "title": t.title, "description": t.description, "order": t.order, "status": "pending"} for t in sorted(s.tasks, key=lambda x: x.order)]} for s in sorted(roadmap.steps, key=lambda x: x.order)]}