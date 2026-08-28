"""
Portfolio Manager Agent — manages the user's portfolio.

Changes evidence status based on AI verification from verifier.py.
Aggregates completed tasks + evidence into a portfolio view.
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.verifier import verify_evidence
from app.core.config import settings
from app.models.db_models import Evidence, Task, User

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
    """Check if the file type is allowed."""
    ext = Path(filename).suffix.lower()
    return file_type in ALLOWED_FILE_TYPES and ext in ALLOWED_EXTENSIONS


# ── Evidence verification ──────────────────────────────────────────────────


async def verify_and_update_evidence(
    db: AsyncSession,
    evidence_id: str,
    image_bytes: bytes,
    mime_type: str,
    career_path: str,
    task_title: str,
    task_description: str = "",
) -> Evidence:
    """
    Verify evidence using Gemini Flash and update the record in-place.

    Returns the updated Evidence object.
    """
    result = await verify_evidence(
        image_bytes=image_bytes,
        mime_type=mime_type,
        career_path=career_path,
        task_title=task_title,
        task_description=task_description,
    )

    evidence = await db.get(Evidence, evidence_id)
    if not evidence:
        raise ValueError("evidence_not_found: no evidence with this ID")

    evidence.verification_status = "verified" if result["verified"] else "rejected"
    evidence.verification_reason = result["reason"]
    evidence.verification_confidence = result["confidence"]
    evidence.verified_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(evidence)
    return evidence


# ── Save evidence ──────────────────────────────────────────────────────────


async def save_evidence(
    db: AsyncSession,
    user_id: str,
    task_id: str,
    file_url: str,
    file_type: str,
) -> Evidence:
    """Save an evidence record to the database."""
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


# ── Portfolio aggregation ──────────────────────────────────────────────────


async def get_user_portfolio(db: AsyncSession, user_id: str) -> list[dict]:
    """
    Get the user's portfolio — completed tasks with their evidence.

    Returns a list of task objects, each with its evidence items.
    Only includes tasks that have at least one piece of evidence.
    """
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
            "verification_reason": evidence.verification_reason,
            "verification_confidence": evidence.verification_confidence,
            "verified_at": evidence.verified_at.isoformat() if evidence.verified_at else None,
            "uploaded_at": evidence.uploaded_at.isoformat() if evidence.uploaded_at else None,
        })

    return list(tasks_with_evidence.values())
