"""
Portfolio API routes — matches API_CONTRACT.md.

POST /tasks/{task_id}/evidence              → upload evidence for a task
GET  /portfolio                              → get the user's portfolio
GET  /evidence/{evidence_id}/verification    → get verification details
POST /evidence/{evidence_id}/re-verify       → re-run verification
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from storage3.utils import StorageException

from app.agents.portfolio_manager import (
    get_user_portfolio,
    save_evidence,
    validate_file_type,
    verify_and_update_evidence,
)
from app.core.security import get_current_user_id
from app.db.postgres import get_db
from app.models.db_models import Evidence, Roadmap, Step, Task
from app.services.storage import upload_evidence_file

logger = logging.getLogger(__name__)

router = APIRouter(tags=["portfolio"])

MAX_FILE_SIZE_MB = 10
MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024


async def _get_career_context(db: AsyncSession, task_id: str) -> tuple[str, str, str]:
    """Fetch career_path, task_title, task_description from the DB hierarchy."""
    task = await db.get(Task, task_id)
    career_path = "General"
    task_title = task.title if task else "Unknown task"
    task_description = task.description if task else ""

    if task:
        step = await db.get(Step, task.step_id)
        if step:
            roadmap = await db.get(Roadmap, step.roadmap_id)
            if roadmap:
                career_path = roadmap.career_path

    return career_path, task_title, task_description


@router.post("/tasks/{task_id}/evidence", status_code=status.HTTP_201_CREATED)
async def post_task_evidence(
    task_id: str,
    file_type: str = Form(...),
    file: UploadFile = File(...),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Upload evidence for a task. Verified synchronously by Gemini Flash."""
    if not file_type or not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": {"code": "invalid_file_type", "message": "file_type and filename are required"}},
        )

    if not validate_file_type(file_type, file.filename):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": {
                    "code": "invalid_file_type",
                    "message": f"Allowed types: JPEG, PNG, WebP, PDF. Got: {file_type}",
                }
            },
        )

    file_bytes = await file.read()
    if len(file_bytes) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": {"code": "file_too_large", "message": f"Maximum file size is {MAX_FILE_SIZE_MB}MB"}},
        )

    try:
        file_url = upload_evidence_file(file_bytes, file.filename, file_type)
    except (StorageException, ValueError, IOError) as e:
        logger.error("Failed to upload file to Supabase Storage: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error": {"code": "storage_error", "message": "Failed to upload file. Please try again."}},
        )

    try:
        evidence = await save_evidence(db=db, user_id=user_id, task_id=task_id, file_url=file_url, file_type=file_type)
    except ValueError as e:
        code = str(e).split(":")[0]
        message = str(e).split(":", 1)[1].strip() if ":" in str(e) else str(e)
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"error": {"code": code, "message": message}})

    try:
        career_path, task_title, task_description = await _get_career_context(db, task_id)
        evidence = await verify_and_update_evidence(
            db=db,
            evidence_id=evidence.id,
            image_bytes=file_bytes,
            mime_type=file_type,
            career_path=career_path,
            task_title=task_title,
            task_description=task_description,
        )
    except (ValueError, RuntimeError) as e:
        logger.warning("Evidence verification failed: %s — status remains pending", e)

    return {
        "id": evidence.id,
        "task_id": evidence.task_id,
        "file_url": evidence.file_url,
        "file_type": evidence.file_type,
        "verification_status": evidence.verification_status,
        "verification_reason": evidence.verification_reason,
        "verification_confidence": evidence.verification_confidence,
        "verified_at": evidence.verified_at.isoformat() if evidence.verified_at else None,
        "uploaded_at": evidence.uploaded_at.isoformat() if evidence.uploaded_at else None,
    }


@router.get("/portfolio")
async def get_portfolio(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Get the user's portfolio — completed tasks with their evidence."""
    portfolio = await get_user_portfolio(db, user_id)
    return portfolio


@router.get("/evidence/{evidence_id}/verification")
async def get_evidence_verification(
    evidence_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Get the full verification details for a single piece of evidence."""
    evidence = await db.get(Evidence, evidence_id)
    if not evidence:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "evidence_not_found", "message": "Evidence not found"}},
        )
    if evidence.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error": {"code": "forbidden", "message": "You can only view your own evidence"}},
        )

    return {
        "evidence_id": evidence.id,
        "verification_status": evidence.verification_status,
        "verification_reason": evidence.verification_reason,
        "verification_confidence": evidence.verification_confidence,
        "verified_at": evidence.verified_at.isoformat() if evidence.verified_at else None,
    }


@router.post("/evidence/{evidence_id}/re-verify", status_code=status.HTTP_200_OK)
async def re_verify_evidence(
    evidence_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Re-run verification on existing evidence. Useful for borderline rejections."""
    evidence = await db.get(Evidence, evidence_id)
    if not evidence:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "evidence_not_found", "message": "Evidence not found"}},
        )
    if evidence.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error": {"code": "forbidden", "message": "You can only re-verify your own evidence"}},
        )

    async with httpx.AsyncClient() as client:
        resp = await client.get(evidence.file_url)
        if resp.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail={"error": {"code": "fetch_error", "message": "Could not fetch evidence file for re-verification"}},
            )
        image_bytes = resp.content

    career_path, task_title, task_description = await _get_career_context(db, evidence.task_id)

    try:
        evidence = await verify_and_update_evidence(
            db=db,
            evidence_id=evidence.id,
            image_bytes=image_bytes,
            mime_type=evidence.file_type,
            career_path=career_path,
            task_title=task_title,
            task_description=task_description,
        )
    except RuntimeError as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={"error": {"code": "verification_failed", "message": str(e)}},
        )

    return {
        "id": evidence.id,
        "verification_status": evidence.verification_status,
        "verification_reason": evidence.verification_reason,
        "verification_confidence": evidence.verification_confidence,
        "verified_at": evidence.verified_at.isoformat() if evidence.verified_at else None,
    }
