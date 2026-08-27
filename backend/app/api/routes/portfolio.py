"""
Portfolio API routes — matches API_CONTRACT.md.

POST /tasks/{task_id}/evidence  → upload evidence for a task
GET  /portfolio                  → get the user's portfolio (completed tasks + evidence)
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession
from storage3.utils import StorageException

from app.agents.portfolio_manager import (
    get_user_portfolio,
    save_evidence,
    update_evidence_status,
    validate_file_type,
    verify_evidence_with_llm,
)
from app.core.security import get_current_user_id
from app.db.postgres import get_db
from app.services.storage import upload_evidence_file

logger = logging.getLogger(__name__)

router = APIRouter(tags=["portfolio"])

# ── File upload config ─────────────────────────────────────────────────────

MAX_FILE_SIZE_MB = 10
MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024


@router.post("/tasks/{task_id}/evidence", status_code=status.HTTP_201_CREATED)
async def post_task_evidence(
    task_id: str,
    file_type: str = Form(...),
    file: UploadFile = File(...),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Upload evidence for a task.
    
    The file is validated, saved, and then sent to the LLM for verification.
    The verification runs synchronously (blocks until complete) — this is
    Open Question #6 from the context handoff. If the team decides async is
    better, move the LLM call to a background task.
    """
    # Validate file type
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

    # Read file bytes
    file_bytes = await file.read()
    if len(file_bytes) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": {
                    "code": "file_too_large",
                    "message": f"Maximum file size is {MAX_FILE_SIZE_MB}MB",
                }
            },
        )

    # Upload to Supabase Storage
    try:
        file_url = upload_evidence_file(file_bytes, file.filename, file_type)
    except (StorageException, ValueError, IOError) as e:
        logger.error("Failed to upload file to Supabase Storage: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error": {"code": "storage_error", "message": "Failed to upload file. Please try again."}},
        )

    # Save evidence record with the real URL
    try:
        evidence = await save_evidence(
            db=db,
            user_id=user_id,
            task_id=task_id,
            file_url=file_url,
            file_type=file_type,
        )
    except ValueError as e:
        code = str(e).split(":")[0]
        message = str(e).split(":", 1)[1].strip() if ":" in str(e) else str(e)
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": code, "message": message}},
        )

    # Verify the evidence with LLM Vision
    # Open Question #6: sync vs async — currently synchronous
    try:
        verification = verify_evidence_with_llm(file_bytes, file_type)
        new_status = "verified" if verification["verified"] else "rejected"
        evidence = await update_evidence_status(db, evidence.id, new_status)
    except (ValueError, RuntimeError) as e:
        # If verification fails, keep status as "pending" — don't block the upload
        logger.warning("Evidence verification failed: %s", e)

    return {
        "id": evidence.id,
        "task_id": evidence.task_id,
        "file_url": evidence.file_url,
        "file_type": evidence.file_type,
        "verification_status": evidence.verification_status,
        "uploaded_at": evidence.uploaded_at.isoformat() if evidence.uploaded_at else None,
    }


@router.get("/portfolio")
async def get_portfolio(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Get the user's portfolio — completed tasks with their evidence.
    
    Only returns tasks that have at least one piece of evidence attached.
    """
    portfolio = await get_user_portfolio(db, user_id)
    return portfolio
