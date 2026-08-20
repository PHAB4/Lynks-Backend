"""Portfolio Manager Agent — verifies evidence with LLM Vision."""
from __future__ import annotations
import json
import logging
import uuid
from datetime import datetime, timezone
from openai import OpenAI
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config import settings
from app.models.db_models import Evidence, Task, User

logger = logging.getLogger(__name__)

def validate_file_type(file_type: str, filename: str) -> bool:
    allowed = {"image/jpeg", "image/png", "image/webp", "application/pdf"}
    return file_type in allowed


def verify_evidence_with_llm(file_bytes: bytes, file_type: str) -> dict:
    client = OpenAI(api_key=settings.LLM_API_KEY, base_url=settings.LLM_API_BASE_URL)
    import base64
    b64 = base64.b64encode(file_bytes).decode()
    messages = [
        {"role": "system", "content": "You verify evidence of task completion. Respond with JSON: {\"verified\": true/false, \"reason\": \"...\"}"},
        {"role": "user", "content": [
            {"type": "text", "text": "Is this evidence a legitimate certificate or proof of completion?"},
            {"type": "image_url", "image_url": {"url": f"data:{file_type};base64,{b64}"}}
        ]}
    ]
    try:
        result = client.chat.completions.create(model=settings.LLM_MODEL, messages=messages, max_tokens=256)
        return json.loads(result.choices[0].message.content or '{"verified": false}')
    except Exception as e:
        logger.warning("LLM verification failed: %s", e)
        return {"verified": False, "reason": "verification_failed"}


async def save_evidence(db: AsyncSession, user_id: str, task_id: str, file_url: str, file_type: str) -> Evidence:
    task = await db.get(Task, task_id)
    if not task:
        raise ValueError("task_not_found: no task with this ID")
    evidence = Evidence(id=str(uuid.uuid4()), task_id=task_id, user_id=user_id, file_url=file_url, file_type=file_type, verification_status="pending")
    db.add(evidence)
    await db.commit()
    await db.refresh(evidence)
    return evidence


async def update_evidence_status(db: AsyncSession, evidence_id: str, status: str) -> Evidence:
    evidence = await db.get(Evidence, evidence_id)
    if not evidence:
        raise ValueError("evidence_not_found")
    evidence.verification_status = status
    await db.commit()
    await db.refresh(evidence)
    return evidence


async def get_user_portfolio(db: AsyncSession, user_id: str) -> dict:
    from sqlalchemy import select
    result = await db.execute(select(Task).join(Evidence).where(Evidence.user_id == user_id))
    tasks = result.scalars().unique().all()
    portfolio = []
    for task in tasks:
        ev_result = await db.execute(select(Evidence).where(Evidence.task_id == task.id, Evidence.user_id == user_id))
        evidence = ev_result.scalars().all()
        portfolio.append({"task_id": task.id, "title": task.title, "evidence": [{"id": e.id, "file_url": e.file_url, "file_type": e.file_type, "verification_status": e.verification_status, "uploaded_at": e.uploaded_at.isoformat() if e.uploaded_at else None} for e in evidence]})
    return {"portfolio": portfolio}