"""
Portfolio Manager Agent — verifies uploaded evidence and manages the user's portfolio.

Uses the OpenAI Python SDK (Llama 3 Vision via Groq/Impala) to check if uploaded
files are legitimate certificates, project evidence, or proof of completion.

Flow:
  1. User uploads a file (certificate, screenshot, photo)
  2. Agent sends the file to Llama 3 Vision for verification
  3. Vision model returns: verified/rejected + reason
  4. Evidence record is updated in the database
  5. Portfolio view aggregates completed tasks + their verified evidence
"""

from __future__ import annotations

import base64
import json
import logging
import uuid
from datetime import datetime, timezone
from pathlib import Path

from openai import OpenAI
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.core.config import settings
from backend.app.models.db_models import Evidence, Task, User

logger = logging.getLogger(__name__)

# ── Allowed file types ─────────────────────────────────────────────────────

ALLOWED_FILE_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "application/pdf",
}

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".pdf"}


def validate_file_type(file_type: str, filename: str) -> bool:
    ext = Path(filename).suffix.lower()
    return file_type in ALLOWED_FILE_TYPES and ext in ALLOWED_EXTENSIONS


# ── LLM Vision verification ────────────────────────────────────────────────

SYSTEM_PROMPT = """\
You are the Portfolio Manager for Lynks — a Caribbean career platform.

Your job: verify whether an uploaded image or document is legitimate evidence of
task completion (certificate, project screenshot, completion badge, etc.).

Analyze the image and determine:
1. Is this a real certificate/badge/completion proof, or is it fake/generic/unrelated?
2. Does it plausibly relate to a career development task?

Return a JSON object with:
{
  "verified": true or false,
  "confidence": "high" | "medium" | "low",
  "reason": "Brief explanation of why you verified or rejected it"
}

Rules:
- Be lenient — if it looks like a reasonable screenshot of a completed course, certificate, or project, verify it
- Reject obviously fake, irrelevant, or placeholder images
- Return ONLY the JSON object, no markdown fences
"""


def verify_evidence_with_llm(file_bytes: bytes, file_type: str) -> dict:
    client = OpenAI(
        api_key=settings.LLM_API_KEY,
        base_url=settings.LLM_API_BASE_URL,
    )

    base64_data = base64.b64encode(file_bytes).decode("utf-8")

    response = client.chat.completions.create(
        model=settings.LLM_MODEL,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": "Please verify this uploaded evidence. Is it a legitimate certificate, badge, or proof of task completion?",
                    },
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:{file_type};base64,{base64_data}",
                        },
                    },
                ],
            },
        ],
        temperature=0.3,
        max_tokens=500,
    )

    raw_content = response.choices[0].message.content.strip()

    if raw_content.startswith("```"):
        lines = raw_content.split("\n")
        lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        raw_content = "\n".join(lines)

    try:
        data = json.loads(raw_content)
    except json.JSONDecodeError as e:
        logger.error("LLM returned invalid JSON for evidence verification: %s", e)
        return {"verified": False, "confidence": "low", "reason": "Verification system error"}

    return {
        "verified": data.get("verified", False),
        "confidence": data.get("confidence", "low"),
        "reason": data.get("reason", "No reason provided"),
    }


# ── Save evidence ──────────────────────────────────────────────────────────


async def save_evidence(
    db: AsyncSession,
    user_id: str,
    task_id: str,
    file_url: str,
    file_type: str,
) -> Evidence:
    task = await db.get(Task, task_id)
    if not task:
        raise ValueError("task_not_found: no task with this ID")

    evidence = Evidence(
        id=str(uuid.uuid4()),
        task_id=task_id,
        user_id=user_id,
        file_url=file_url,
        file_type=file_type,
        verification_status="pending",
    )
    db.add(evidence)
    await db.commit()
    await db.refresh(evidence)
    return evidence


async def update_evidence_status(
    db: AsyncSession,
    evidence_id: str,
    status: str,
) -> Evidence:
    evidence = await db.get(Evidence, evidence_id)
    if not evidence:
        raise ValueError("evidence_not_found: no evidence with this ID")
    evidence.verification_status = status
    await db.commit()
    await db.refresh(evidence)
    return evidence


# ── Portfolio aggregation ──────────────────────────────────────────────────


async def get_user_portfolio(db: AsyncSession, user_id: str) -> list[dict]:
    result = await db.execute(
        select(Task, Evidence)
        .join(Evidence, Task.id == Evidence.task_id)
        .where(Evidence.user_id == user_id)
        .order_by(Task.order)
    )
    
    tasks_with_evidence: dict[str, dict] = {}
    for task, evidence in result.all():
        if task.id not in tasks_with_evidence:
            tasks_with_evidence[task.id] = {
                "task_id": task.id,
                "title": task.title,
                "evidence": [],
            }
        tasks_with_evidence[task.id]["evidence"].append({
            "id": evidence.id,
            "file_url": evidence.file_url,
            "file_type": evidence.file_type,
            "verification_status": evidence.verification_status,
            "uploaded_at": evidence.uploaded_at.isoformat() if evidence.uploaded_at else None,
        })
    
    return list(tasks_with_evidence.values())