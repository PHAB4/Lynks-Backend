"""
Career Architect Agent — generates personalized roadmaps from user profile data.

Uses the OpenAI Python SDK talking to an OpenAI-compatible compute gateway
(Highrise / Impala AI). No LangChain or CrewAI dependency — intentionally
kept self-contained so the orchestration library decision doesn't block this.

Flow:
  1. Validate the user's profile is complete enough to generate a roadmap
  2. Call the LLM with a structured prompt + the user's profile
  3. Parse the LLM's JSON response into Roadmap → Steps → Tasks
  4. Save everything to Postgres (deactivate old roadmaps, insert new ones)
  5. Return the structured roadmap matching API_CONTRACT.md
"""

from __future__ import annotations

import json
import logging
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone

from openai import OpenAI
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.db_models import Roadmap, Step, Task, User

logger = logging.getLogger(__name__)


# ── Types ──────────────────────────────────────────────────────────────────


@dataclass
class ProfileData:
    """What the agent needs from the user's profile to generate a roadmap."""

    career_path: str
    education_level: str
    age: int
    country: str
    employment_status: str
    interests: list[str]


@dataclass
class GeneratedTask:
    title: str
    description: str
    order: int


@dataclass
class GeneratedStep:
    title: str
    description: str
    order: int
    tasks: list[GeneratedTask]


@dataclass
class GeneratedRoadmap:
    steps: list[GeneratedStep]


# ── Profile validation ─────────────────────────────────────────────────────


def validate_profile(user: User) -> None:
    """
    Check that the user has enough profile data to generate a roadmap.
    Raises ValueError with a code the route can catch.
    """
    required_fields = ["career_path", "education_level", "country"]
    missing = [f for f in required_fields if not getattr(user, f, None)]
    if missing:
        raise ValueError(f"profile_incomplete: missing {', '.join(missing)}")


def user_to_profile(user: User) -> ProfileData:
    return ProfileData(
        career_path=user.career_path,
        education_level=user.education_level or "unknown",
        age=user.age or 0,
        country=user.country or "unknown",
        employment_status="unknown",
        interests=user.interests or [],
    )


# ── LLM call ───────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """\
You are the Career Architect for Lynks — a platform helping young people in the Caribbean \
build structured career paths.

Your job: given a user's profile, generate a personalized career roadmap as structured JSON.

## Rules

1. The roadmap must have 4–8 **steps** (milestones), ordered logically from foundational \
to advanced. Each step is a phase the user works through before moving to the next.

2. Each step must have 2–4 **tasks** (concrete, actionable items the user can actually do). \
Tasks are what get marked "complete" and can have evidence (certificates, photos) attached.

3. Tasks must be **specific and Caribbean-contextualized** where possible — consider \
the user's country, education level, and local opportunities. A task like "enroll in \
Coursera's Google IT Support Certificate" is good. A task like "get experience" is not.

4. Use **snake_case** for all field names in the JSON.

5. Every task needs a clear `title` (short label) and `description` (2-3 sentences \
explaining what to do and why it matters).

6. `order` on both steps and tasks is a 1-based integer indicating position.

7. Return ONLY valid JSON — no markdown fences, no commentary outside the JSON.
"""


def build_user_message(profile: ProfileData) -> str:
    return json.dumps(
        {
            "career_path": profile.career_path,
            "education_level": profile.education_level,
            "age": profile.age,
            "country": profile.country,
            "employment_status": profile.employment_status,
            "interests": profile.interests,
        },
        indent=2,
    )


RESPONSE_FORMAT_INSTRUCTIONS = """\
Return a JSON object with this exact structure:

{
  "steps": [
    {
      "title": "string",
      "description": "string (2-3 sentences)",
      "order": 1,
      "tasks": [
        {
          "title": "string",
          "description": "string (2-3 sentences)",
          "order": 1
        }
      ]
    }
  ]
}

Rules for the JSON:
- "steps" is an array of 4-8 step objects
- Each step has "tasks" with 2-4 task objects
- "order" is 1-based (first step = 1, first task in a step = 1)
- No trailing commas, no comments, no markdown fences
- Return ONLY the JSON object, nothing else
"""


def call_llm(profile: ProfileData) -> GeneratedRoadmap:
    """
    Call the OpenAI-compatible compute gateway and parse the response
    into a GeneratedRoadmap.

    Uses the OpenAI Python SDK — the compute gateway (Highrise/Impala AI)
    exposes an OpenAI-compatible API, so we point the SDK at their base URL.
    """
    client = OpenAI(
        api_key=settings.LLM_API_KEY,
        base_url=settings.LLM_API_BASE_URL,
    )

    user_message = build_user_message(profile) + "\n\n" + RESPONSE_FORMAT_INSTRUCTIONS

    response = client.chat.completions.create(
        model=settings.LLM_MODEL,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_message},
        ],
        temperature=0.7,
        max_tokens=4096,
    )

    raw_content = response.choices[0].message.content.strip()

    # Strip markdown fences if the model wraps them anyway
    if raw_content.startswith("```"):
        lines = raw_content.split("\n")
        lines = lines[1:]  # drop opening fence
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        raw_content = "\n".join(lines)

    try:
        data = json.loads(raw_content)
    except json.JSONDecodeError as e:
        logger.error("LLM returned invalid JSON: %s\nRaw output:\n%s", e, raw_content)
        raise RuntimeError(f"llm_parse_error: {e}") from e

    return _parse_roadmap(data)


def _parse_roadmap(data: dict) -> GeneratedRoadmap:
    """Parse the LLM's JSON output into our dataclass structure."""
    steps = []
    for i, step_data in enumerate(data.get("steps", []), start=1):
        tasks = []
        for j, task_data in enumerate(step_data.get("tasks", []), start=1):
            tasks.append(
                GeneratedTask(
                    title=task_data.get("title", f"Task {j}"),
                    description=task_data.get("description", ""),
                    order=task_data.get("order", j),
                )
            )
        steps.append(
            GeneratedStep(
                title=step_data.get("title", f"Step {i}"),
                description=step_data.get("description", ""),
                order=step_data.get("order", i),
                tasks=tasks,
            )
        )

    if not steps:
        raise RuntimeError("llm_empty_roadmap: LLM returned zero steps")

    return GeneratedRoadmap(steps=steps)


# ── Save to DB ─────────────────────────────────────────────────────────────


async def save_roadmap(
    db: AsyncSession,
    user_id: str,
    profile: ProfileData,
    generated: GeneratedRoadmap,
) -> Roadmap:
    """
    1. Deactivate any existing active roadmaps for this user
    2. Insert the new roadmap + steps + tasks
    3. Return the saved roadmap (with IDs)
    """
    # Deactivate old roadmaps
    result = await db.execute(
        select(Roadmap).where(
            Roadmap.user_id == user_id,
            Roadmap.is_active == True,  # noqa: E712
        )
    )
    for old_roadmap in result.scalars().all():
        old_roadmap.is_active = False

    # Create the roadmap
    roadmap_id = str(uuid.uuid4())
    roadmap = Roadmap(
        id=roadmap_id,
        user_id=user_id,
        career_path=profile.career_path,
        is_active=True,
    )
    db.add(roadmap)

    # Create steps and tasks
    for step_gen in generated.steps:
        step_id = str(uuid.uuid4())
        step = Step(
            id=step_id,
            roadmap_id=roadmap_id,
            title=step_gen.title,
            description=step_gen.description,
            order=step_gen.order,
        )
        db.add(step)

        for task_gen in step_gen.tasks:
            task = Task(
                id=str(uuid.uuid4()),
                step_id=step_id,
                title=task_gen.title,
                description=task_gen.description,
                order=task_gen.order,
                status="pending",
            )
            db.add(task)

    await db.commit()

    # Re-fetch with relationships loaded explicitly
    roadmap = await db.get(Roadmap, roadmap_id)
    await db.refresh(roadmap, ["steps"])
    for step in roadmap.steps:
        await db.refresh(step, ["tasks"])
    return roadmap


# ── Public API ──────────────────────────────────────────────────────────────


async def generate_roadmap(
    db: AsyncSession,
    user_id: str,
) -> dict:
    """
    Full pipeline: validate → call LLM → save → return API shape.

    Returns a dict matching the API_CONTRACT.md roadmap response shape.
    Raises ValueError for profile_incomplete, RuntimeError for LLM errors.
    """
    # 1. Load user
    user = await db.get(User, user_id)
    if not user:
        raise ValueError("user_not_found: no user with this ID")

    # 2. Validate profile
    validate_profile(user)

    # 3. Build profile data
    profile = user_to_profile(user)

    # 4. Call the LLM
    generated = call_llm(profile)

    # 5. Save to DB
    roadmap = await save_roadmap(db, user_id, profile, generated)

    # 6. Build the API response shape
    steps_response = []
    for step in sorted(roadmap.steps, key=lambda s: s.order):
        # Compute step status: "complete" only if ALL tasks are complete
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
