---
name: "AI Evidence Verification"
overview: "Fix the broken evidence verification system by switching from Groq text-only LLM to Google Gemini 2.5 Flash for vision. Adds career-context-aware verification, stores detailed results (reason, confidence, timestamp), and provides a re-verify endpoint. Dual-provider architecture: Groq for text, Gemini for vision."
createdAt: "2026-08-28T22:00:00.000Z"
status: pending
todos:
  - id: update-prd
    content: "Update PRD — replace Llama 3 Vision with Gemini 2.5 Flash, add Impala inaccessible note, document dual-provider architecture"
    status: pending
  - id: update-config
    content: "Update config.py — add GEMINI_API_KEY + VISION_MODEL env vars, fix Impala comment"
    status: pending
  - id: update-env
    content: "Update .env and Railway variables — add GEMINI_API_KEY, VISION_MODEL, document base URL for Gemini"
    status: pending
  - id: install-google-genai
    content: "Install google-genai SDK + add to requirements.txt"
    status: pending
  - id: migration-sql
    content: "Write migration SQL — ALTER TABLE evidence ADD 3 columns (verification_reason, verification_confidence, verified_at)"
    status: pending
  - id: update-db-model
    content: "Update db_models.py — add 3 new columns to Evidence model"
    status: pending
  - id: create-verifier
    content: "Create app/agents/verifier.py — Gemini-based verification agent with career context"
    status: pending
  - id: update-portfolio-manager
    content: "Update portfolio_manager.py — remove broken verify_evidence_with_llm(), import from verifier.py"
    status: pending
  - id: update-portfolio-route
    content: "Update portfolio.py route — store full verification result, add GET /evidence/{id}/verification + POST /evidence/{id}/re-verify"
    status: pending
  - id: update-portfolio-response
    content: "Update portfolio response shape — include verification_reason, verification_confidence, verified_at"
    status: pending
  - id: write-tests
    content: "Write tests/test_evidence_verification.py — mock Gemini, test all verification scenarios"
    status: pending
  - id: update-api-docs
    content: "Update docs/API_CONTRACT.md — new endpoints + updated response shapes"
    status: pending
  - id: update-schema-docs
    content: "Update docs/SCHEMA.md — evidence table new columns"
    status: pending
  - id: push-to-github
    content: "Push all changes to feature branch + PR to main"
    status: pending
---

# AI Evidence Verification System

## Overview

The Lynks PRD requires AI-verified evidence: when a user uploads a certificate or screenshot proving they completed a roadmap task, the system should analyze the image to determine if it's legitimate and relevant to the user's career path.

**Current state:** The verification system exists in `portfolio_manager.py` but is **broken** — it sends images as base64 to `openai/gpt-oss-120b` (a text-only model) via Groq. The model cannot see the image, so verification is meaningless.

**What we're building:** A working verification system using Google Gemini 2.5 Flash (free tier, native vision) while keeping Groq for all text-based tasks.

---

## Architecture: Dual-Provider Setup

```
┌──────────────────────────────────────────────────────┐
│                  LYNKS BACKEND                        │
│                                                       │
│  Chat, Roadmap, Resume ──→ Groq (openai/gpt-oss-120b)│  ← text-only, unchanged
│  Evidence Verification ──→ Google Gemini 2.5 Flash    │  ← NEW, vision-capable
│                                                       │
│  Same backend, two providers, two API keys            │
└──────────────────────────────────────────────────────┘
```

| Concern | Provider | Model | Cost |
|---------|----------|-------|------|
| Text (chat, roadmap, resume, memory) | **Groq** | `openai/gpt-oss-120b` | Paid (existing) |
| Vision (evidence verification) | **Google Gemini** | `gemini-2.5-flash` | **Free** (1,500 RPD) |

### Why Google Gemini 2.5 Flash?

- **Free tier:** 10 RPM, 250K TPM, 1,500 RPD — no credit card required
- **Native vision:** Multimodal by design — images, video, audio
- **JSON mode:** Supported via `response_mime_type="application/json"`
- **1M token context window:** More than enough for image + prompt
- **Python SDK:** `google-genai` — official Google package
- **API key:** Get from https://aistudio.google.com/apikey — 30 seconds, zero cost
- **Why not Groq?** Groq deprecated Llama 3.2 Vision (Apr 2025). Qwen vision models exist but status is uncertain. Gemini Flash is the most reliable free vision option.

---

## Environment Variables

### Current `.env` (no change to existing vars)

```bash
# ─── Supabase ──────────────────────────────────
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
DATABASE_URL=postgresql+asyncpg://...

# ─── LLM — Groq (text tasks) ───────────────────
LLM_API_BASE_URL=https://api.groq.com/openai/v1
LLM_API_KEY=gsk_xxxxx
LLM_MODEL=openai/gpt-oss-120b
```

### New vars to add

```bash
# ─── Vision — Google Gemini (evidence verification) ──
# Get key from: https://aistudio.google.com/apikey (free, no credit card)
# Base URL: https://generativelanguage.googleapis.com/v1beta (handled by google-genai SDK)
# Model: gemini-2.5-flash (free tier, vision-native, 1M context)
GEMINI_API_KEY=AIzaSy_xxxxx
VISION_MODEL=gemini-2.5-flash
```

### Railway Variables

Add these in Railway Dashboard → Your Service → Variables:

| Variable | Value | Notes |
|----------|-------|-------|
| `GEMINI_API_KEY` | `AIzaSy_xxxxx` | Your Google AI Studio key |
| `VISION_MODEL` | `gemini-2.5-flash` | Free tier model ID |

**No base URL needed for Gemini** — the `google-genai` SDK handles it automatically. The API endpoint is `https://generativelanguage.googleapis.com/v1beta` but the SDK abstracts this away.

**Important:** This is a separate key from Groq. Do NOT reuse `LLM_API_KEY` for Gemini.

### Getting a Google AI Studio API Key

1. Go to https://aistudio.google.com/apikey
2. Sign in with a Google account
3. Click "Create API Key"
4. Copy the key (starts with `AIzaSy...`)
5. Add to `.env` as `GEMINI_API_KEY`
6. Add to Railway as environment variable

---

## Migration SQL

Run in Supabase SQL Editor:

```sql
-- Add verification detail columns to evidence table
ALTER TABLE evidence
  ADD COLUMN IF NOT EXISTS verification_reason TEXT,
  ADD COLUMN IF NOT EXISTS verification_confidence TEXT,
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;

-- Add constraint to confidence values
ALTER TABLE evidence
  ADD CONSTRAINT check_verification_confidence
  CHECK (verification_confidence IN ('high', 'medium', 'low') OR verification_confidence IS NULL);
```

This is safe — `IF NOT EXISTS` means it won't fail if columns already exist. No data loss.

---

## Files to Create/Modify

### 1. NEW: `app/agents/verifier.py`

The core verification agent. Uses Google Gemini 2.5 Flash via the `google-genai` SDK.

**Key responsibilities:**
- Accept image bytes + career context
- Send to Gemini Flash for multimodal analysis
- Parse structured JSON response
- Return verification result with reason + confidence
- Handle errors gracefully (timeouts, invalid responses, API failures)

**Full implementation:**

```python
"""
Evidence Verifier — uses Google Gemini 2.5 Flash for vision-based
verification of uploaded certificates, badges, and project evidence.

This is the ONLY file that imports from google-genai. All other code
interacts with this module through verify_evidence().
"""

from __future__ import annotations

import base64
import json
import logging
from google import genai
from google.genai import types

from app.core.config import settings

logger = logging.getLogger(__name__)

client = genai.Client(api_key=settings.GEMINI_API_KEY)

VERIFICATION_PROMPT = """\
You are the Lynks Evidence Verifier — an AI that verifies whether uploaded
files are legitimate proof of task completion for a Caribbean career platform.

TASK CONTEXT:
- User's career path: {career_path}
- Task title: {task_title}
- Task description: {task_description}

Analyze the uploaded image and determine:

1. DOCUMENT TYPE: Is this a certificate, badge, completion screenshot,
   project demo, award letter, or other evidence? Or is it a generic,
   unrelated, blank, or fake image?

2. CONTENT LEGITIMACY:
   - Does it have realistic elements? (issuer name, date, recipient name,
     completion details, logo, signatures)
   - Does it look authentic or obviously fabricated?
   - If it's a screenshot, does it look like a real platform?

3. CAREER RELEVANCE:
   - Does this evidence relate to the user's career path ({career_path})?
   - Does it relate to the specific task they're completing ({task_title})?

BE LENIENT: If it looks like a reasonable screenshot of a completed course,
certificate, project, or workshop — verify it. Only reject obviously fake,
blank, or completely unrelated images.

Return ONLY a JSON object (no markdown, no code fences):
{{
  "verified": true,
  "confidence": "high",
  "document_type": "certificate",
  "issuer": "Coursera",
  "reason": "Legitimate Coursera certificate for Python course completion"
}}

{{
  "verified": false,
  "confidence": "medium",
  "document_type": "unknown",
  "issuer": null,
  "reason": "Image appears to be a blank white rectangle with no visible content"
}}
"""


async def verify_evidence(
    image_bytes: bytes,
    mime_type: str,
    career_path: str,
    task_title: str,
    task_description: str = "",
) -> dict:
    """
    Send an uploaded image to Gemini Flash for verification.

    Args:
        image_bytes: Raw bytes of the uploaded file.
        mime_type: MIME type (e.g. "image/jpeg", "image/png", "image/webp").
        career_path: The user's chosen career path.
        task_title: The title of the task being completed.
        task_description: Optional task description for extra context.

    Returns:
        dict with keys: verified, confidence, document_type, issuer, reason
    """
    base64_data = base64.b64encode(image_bytes).decode("utf-8")

    prompt = VERIFICATION_PROMPT.format(
        career_path=career_path,
        task_title=task_title,
        task_description=task_description or "No additional description.",
    )

    try:
        response = client.models.generate_content(
            model=settings.VISION_MODEL,
            contents=[
                types.Part.from_bytes(
                    data=base64.b64decode(base64_data),
                    mime_type=mime_type,
                ),
                prompt,
            ],
            config=types.GenerateContentConfig(
                temperature=0.2,
                max_output_tokens=500,
                response_mime_type="application/json",
            ),
        )

        raw_text = response.text.strip()
        result = json.loads(raw_text)

        return {
            "verified": bool(result.get("verified", False)),
            "confidence": result.get("confidence", "low"),
            "document_type": result.get("document_type", "unknown"),
            "issuer": result.get("issuer"),
            "reason": result.get("reason", "No reason provided"),
        }

    except json.JSONDecodeError as e:
        logger.error("Gemini returned invalid JSON for evidence verification: %s", e)
        return {
            "verified": False,
            "confidence": "low",
            "document_type": "unknown",
            "issuer": None,
            "reason": "Verification system error — unable to parse response",
        }

    except Exception as e:
        logger.error("Evidence verification failed: %s", e)
        raise RuntimeError(f"Verification failed: {e}")
```

**Design decisions:**
- `verify_evidence()` is **async** — Gemini SDK supports it natively
- Raises `RuntimeError` on API failures — the route catches this and keeps status as "pending"
- Returns a standardized dict regardless of success/failure
- `response_mime_type="application/json"` forces Gemini to return JSON (native feature)
- Low temperature (0.2) for consistent verification results
- The prompt is lenient by design — we'd rather over-verify than reject legitimate evidence

---

### 2. MODIFY: `app/core/config.py`

**Changes:**
- Fix the comment that says "Highrise / Impala AI" (Impala is inaccessible)
- Add `GEMINI_API_KEY` and `VISION_MODEL` settings

```python
# BEFORE:
# LLM — OpenAI-compatible compute gateway (Highrise / Impala AI)
LLM_API_BASE_URL: str = ""  # e.g. https://api.highrise.ai/v1

# AFTER:
# LLM — Groq (text tasks: chat, roadmap, resume, memory)
LLM_API_BASE_URL: str = ""  # https://api.groq.com/openai/v1

# Vision — Google Gemini Flash (evidence verification)
GEMINI_API_KEY: str = ""     # Google AI Studio key (free)
VISION_MODEL: str = "gemini-2.5-flash"
```

---

### 3. MODIFY: `app/models/db_models.py`

**Add 3 columns to the `Evidence` class:**

```python
# BEFORE:
class Evidence(Base):
    __tablename__ = "evidence"
    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    task_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("tasks.id"), nullable=False)
    user_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=False)
    file_url: Mapped[str] = mapped_column(Text, nullable=False)
    file_type: Mapped[str] = mapped_column(Text, nullable=False)
    verification_status: Mapped[str] = mapped_column(Text, nullable=False, default="pending")
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    # ... relationships ...

# AFTER (add 3 lines before uploaded_at):
    verification_status: Mapped[str] = mapped_column(Text, nullable=False, default="pending")
    verification_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    verification_confidence: Mapped[str | None] = mapped_column(Text, nullable=True)
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
```

---

### 4. MODIFY: `app/agents/portfolio_manager.py`

**Remove:** `verify_evidence_with_llm()`, `SYSTEM_PROMPT`, and the `from openai import OpenAI` import.

**Add:** Import `verify_evidence` from `verifier.py` and a new `update_evidence_verification()` function.

**Keep:** `validate_file_type()`, `save_evidence()`, `get_user_portfolio()`.

**Updated file structure:**

```python
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

# ── File upload config (unchanged) ─────────────────────────────────────────

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


# ── Save evidence (unchanged) ──────────────────────────────────────────────


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


# ── Portfolio aggregation (updated to include verification details) ────────


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
```

---

### 5. MODIFY: `app/api/routes/portfolio.py`

**Changes:**
1. Update imports (remove `verify_evidence_with_llm` + `update_evidence_status`, add `verify_and_update_evidence`)
2. Update upload endpoint to get career path + task info, pass to verification, store full result
3. Add `GET /evidence/{evidence_id}/verification` endpoint
4. Add `POST /evidence/{evidence_id}/re-verify` endpoint
5. Update response shapes

**Updated file:**

```python
"""
Portfolio API routes — matches API_CONTRACT.md.

POST /tasks/{task_id}/evidence          → upload evidence for a task
GET  /portfolio                          → get the user's portfolio
GET  /evidence/{evidence_id}/verification → get verification details
POST /evidence/{evidence_id}/re-verify   → re-run verification
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone

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
from app.models.db_models import Evidence, Task, Step, Roadmap
from app.services.storage import upload_evidence_file

logger = logging.getLogger(__name__)

router = APIRouter(tags=["portfolio"])

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
            detail={
                "error": {"code": "file_too_large", "message": f"Maximum file size is {MAX_FILE_SIZE_MB}MB"}
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

    # Save evidence record
    try:
        evidence = await save_evidence(db=db, user_id=user_id, task_id=task_id, file_url=file_url, file_type=file_type)
    except ValueError as e:
        code = str(e).split(":")[0]
        message = str(e).split(":", 1)[1].strip() if ":" in str(e) else str(e)
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"error": {"code": code, "message": message}})

    # Get career context for verification
    try:
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

    # Fetch the image from Supabase Storage URL for re-verification
    import httpx
    async with httpx.AsyncClient() as client:
        resp = await client.get(evidence.file_url)
        if resp.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail={"error": {"code": "fetch_error", "message": "Could not fetch evidence file for re-verification"}},
            )
        image_bytes = resp.content

    # Get career context
    task = await db.get(Task, evidence.task_id)
    career_path = "General"
    task_title = task.title if task else "Unknown task"
    task_description = task.description if task else ""

    if task:
        step = await db.get(Step, task.step_id)
        if step:
            roadmap = await db.get(Roadmap, step.roadmap_id)
            if roadmap:
                career_path = roadmap.career_path

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
```

---

### 6. MODIFY: `requirements.txt`

**Add one line:**

```
# Vision — Google Gemini Flash (evidence verification, free tier)
google-genai>=1.0.0
```

---

### 7. MODIFY: PRD (`Lynks_Product_Requirement_Document.md`)

**Changes:**
1. Replace "Llama 3 Vision" with "Google Gemini 2.5 Flash"
2. Add note that Impala gateway is inaccessible
3. Document dual-provider architecture

**Section to update:**

```markdown
# BEFORE:
* AI-verify uploaded certificates for authenticity / relevance (using Llama 3 Vision)

# AFTER:
* AI-verify uploaded certificates for authenticity / relevance (using Google Gemini 2.5 Flash — free tier)
  * Dual-provider architecture: Groq for text tasks (chat, roadmap, resume), Gemini Flash for vision (evidence verification)
  * Note: Impala/Highrise gateway is inaccessible — all LLM calls route through Groq (text) and Google AI Studio (vision)
  * Verification is career-context-aware: checks document type, content legitimacy, AND relevance to user's career path
```

---

### 8. NEW: `tests/test_evidence_verification.py`

```python
"""
Tests for the evidence verification system.

All Gemini API calls are mocked — no real API calls in tests.
"""

import json
from unittest.mock import MagicMock, patch, AsyncMock
import pytest

from app.agents.verifier import verify_evidence


@pytest.mark.asyncio
@patch("app.agents.verifier.client")
async def test_verify_certificate_pass(mock_client):
    """Valid certificate → verified=True, high confidence."""
    mock_response = MagicMock()
    mock_response.text = json.dumps({
        "verified": True,
        "confidence": "high",
        "document_type": "certificate",
        "issuer": "Coursera",
        "reason": "Legitimate Coursera certificate for Python course",
    })
    mock_client.models.generate_content.return_value = mock_response

    result = await verify_evidence(
        image_bytes=b"fake-image-bytes",
        mime_type="image/jpeg",
        career_path="Software Development",
        task_title="Complete Python Fundamentals",
    )

    assert result["verified"] is True
    assert result["confidence"] == "high"
    assert result["document_type"] == "certificate"
    assert result["issuer"] == "Coursera"
    assert "Coursera" in result["reason"]


@pytest.mark.asyncio
@patch("app.agents.verifier.client")
async def test_verify_reject_blank_image(mock_client):
    """Blank image → verified=False."""
    mock_response = MagicMock()
    mock_response.text = json.dumps({
        "verified": False,
        "confidence": "high",
        "document_type": "unknown",
        "issuer": None,
        "reason": "Image is a blank white rectangle with no content",
    })
    mock_client.models.generate_content.return_value = mock_response

    result = await verify_evidence(
        image_bytes=b"blank-image",
        mime_type="image/png",
        career_path="Software Development",
        task_title="Complete Python Fundamentals",
    )

    assert result["verified"] is False
    assert result["confidence"] == "high"
    assert result["issuer"] is None


@pytest.mark.asyncio
@patch("app.agents.verifier.client")
async def test_verify_reject_unrelated(mock_client):
    """Random meme → verified=False."""
    mock_response = MagicMock()
    mock_response.text = json.dumps({
        "verified": False,
        "confidence": "medium",
        "document_type": "unknown",
        "issuer": None,
        "reason": "Image appears to be a social media meme, not career evidence",
    })
    mock_client.models.generate_content.return_value = mock_response

    result = await verify_evidence(
        image_bytes=b"meme-image",
        mime_type="image/jpeg",
        career_path="Software Development",
        task_title="Complete Python Fundamentals",
    )

    assert result["verified"] is False


@pytest.mark.asyncio
@patch("app.agents.verifier.client")
async def test_verify_with_career_context(mock_client):
    """Python cert for software dev → verified, relevant."""
    mock_response = MagicMock()
    mock_response.text = json.dumps({
        "verified": True,
        "confidence": "high",
        "document_type": "certificate",
        "issuer": "Udemy",
        "reason": "Python certificate directly relevant to Software Development career path",
    })
    mock_client.models.generate_content.return_value = mock_response

    result = await verify_evidence(
        image_bytes=b"python-cert",
        mime_type="image/png",
        career_path="Software Development",
        task_title="Learn Python Basics",
    )

    assert result["verified"] is True
    # Verify career context was passed in the call
    call_args = mock_client.models.generate_content.call_args
    contents = call_args.kwargs.get("contents") or call_args[1].get("contents")
    prompt_text = str(contents)
    assert "Software Development" in prompt_text
    assert "Learn Python Basics" in prompt_text


@pytest.mark.asyncio
@patch("app.agents.verifier.client")
async def test_verify_reject_wrong_career(mock_client):
    """Cooking cert for software dev → still lenient (we're lenient), but low confidence."""
    mock_response = MagicMock()
    mock_response.text = json.dumps({
        "verified": True,
        "confidence": "low",
        "document_type": "certificate",
        "issuer": "Culinary Institute",
        "reason": "Legitimate certificate but tangentially related to career path",
    })
    mock_client.models.generate_content.return_value = mock_response

    result = await verify_evidence(
        image_bytes=b"cooking-cert",
        mime_type="image/jpeg",
        career_path="Software Development",
        task_title="Complete a cooking workshop",
    )

    # Lenient: verifies it's real, but flags low confidence
    assert result["verified"] is True
    assert result["confidence"] == "low"


@pytest.mark.asyncio
@patch("app.agents.verifier.client")
async def test_verify_invalid_json_response(mock_client):
    """LLM returns garbage → graceful fallback."""
    mock_response = MagicMock()
    mock_response.text = "I'm sorry, I can't analyze that image."
    mock_client.models.generate_content.return_value = mock_response

    result = await verify_evidence(
        image_bytes=b"some-image",
        mime_type="image/jpeg",
        career_path="Software Development",
        task_title="Complete Python course",
    )

    assert result["verified"] is False
    assert result["confidence"] == "low"
    assert "error" in result["reason"].lower() or "unable" in result["reason"].lower()


@pytest.mark.asyncio
@patch("app.agents.verifier.client")
async def test_verify_api_timeout(mock_client):
    """Gemini API raises exception → RuntimeError propagates to caller."""
    mock_client.models.generate_content.side_effect = Exception("Connection timeout")

    with pytest.raises(RuntimeError, match="Verification failed"):
        await verify_evidence(
            image_bytes=b"some-image",
            mime_type="image/jpeg",
            career_path="Software Development",
            task_title="Complete Python course",
        )


@pytest.mark.asyncio
@patch("app.agents.verifier.client")
async def test_verify_pdf_type(mock_client):
    """PDF files are handled correctly."""
    mock_response = MagicMock()
    mock_response.text = json.dumps({
        "verified": True,
        "confidence": "medium",
        "document_type": "certificate",
        "issuer": "AWS",
        "reason": "AWS Solutions Architect certificate (PDF format)",
    })
    mock_client.models.generate_content.return_value = mock_response

    result = await verify_evidence(
        image_bytes=b"pdf-content",
        mime_type="application/pdf",
        career_path="Cloud Engineering",
        task_title="Get AWS certification",
    )

    assert result["verified"] is True
    assert result["confidence"] == "medium"
```

**Run with:** `pytest tests/test_evidence_verification.py -v`

---

### 9. MODIFY: `docs/API_CONTRACT.md`

**Add new endpoints + update response shapes.**

Add under the "Task Completion & Portfolio" section:

```markdown
| GET  | `/evidence/{evidence_id}/verification` | Get verification details for a single evidence item |
| POST | `/evidence/{evidence_id}/re-verify`     | Re-run AI verification on existing evidence         |
```

Update `POST /tasks/{task_id}/evidence` response:

```json
{
  "id": "uuid",
  "task_id": "uuid",
  "file_url": "https://...",
  "file_type": "image/png",
  "verification_status": "verified",
  "verification_reason": "Legitimate Coursera certificate for Python course",
  "verification_confidence": "high",
  "verified_at": "2026-08-28T12:00:00Z",
  "uploaded_at": "2026-08-28T12:00:00Z"
}
```

Add response shapes for new endpoints.

---

### 10. MODIFY: `docs/SCHEMA.md`

Add under the evidence table:

```markdown
| verification_reason    | TEXT        | nullable | Explanation of why verified/rejected                |
| verification_confidence| TEXT        | nullable | "high", "medium", or "low"                          |
| verified_at            | TIMESTAMPTZ | nullable | When verification was completed                     |
```

---

## Verification Workflow (End-to-End)

```
User uploads evidence (certificate, screenshot, photo)
        │
        ▼
┌─────────────────────────────────┐
│  VALIDATE                       │  ✅ Already exists
│  • File type (JPEG/PNG/         │
│    WebP/PDF)                    │
│  • Max 10MB                     │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│  UPLOAD TO SUPABASE STORAGE     │  ✅ Already exists
│  • evidence bucket              │
│  • Returns public URL           │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│  SAVE EVIDENCE RECORD           │  ✅ Already exists
│  • status = "pending"           │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────┐
│  🔍 LOAD CAREER CONTEXT  (NEW)                      │
│  • Fetch task from DB                               │
│  • Fetch step → roadmap → career_path               │
│  • Result: career_path + task_title + description   │
└────────┬────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────┐
│  🔍 VERIFY WITH GEMINI FLASH  (FIXED)               │
│  model: gemini-2.5-flash (free tier, vision-native) │
│  base_url: generativelanguage.googleapis.com        │
│  api_key: GEMINI_API_KEY (separate from Groq)       │
│                                                      │
│  1. Base64 encode image                              │
│  2. Build career-context-aware prompt                │
│  3. Send as multimodal input (Part.from_bytes)       │
│  4. Parse JSON response (response_mime_type=json)    │
│  5. Return: verified + confidence + reason + issuer  │
└────────┬────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│  STORE RESULT                   │  ← NEW columns
│  • verification_status:         │
│    verified / rejected          │
│  • verification_reason:         │
│    "Certificate from Coursera"  │
│  • verification_confidence:     │
│    high / medium / low          │
│  • verified_at: now()           │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│  RETURN TO CLIENT               │  ← ENHANCED response
│  (includes reason + confidence  │
│   + timestamp)                  │
└─────────────────────────────────┘
```

---

## API Endpoints Summary

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/tasks/{task_id}/evidence` | ✅ JWT | Upload evidence (now stores full verification result) |
| GET | `/portfolio` | ✅ JWT | Portfolio (now includes verification reason/confidence/timestamp) |
| GET | `/evidence/{evidence_id}/verification` | ✅ JWT | **NEW** — Get verification details for one evidence item |
| POST | `/evidence/{evidence_id}/re-verify` | ✅ JWT | **NEW** — Re-run verification on existing evidence |

---

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Gemini API timeout | Status stays "pending" — evidence is saved, verification can be retried via re-verify |
| Gemini returns invalid JSON | Status = "rejected" with reason "Verification system error" |
| Gemini API key missing/invalid | RuntimeError caught in route → status stays "pending", warning logged |
| Image fetch fails on re-verify | 500 response with `fetch_error` code |
| Evidence belongs to another user | 403 with `forbidden` code |
| Evidence not found | 404 with `evidence_not_found` code |

---

## Dependencies to Add

```txt
google-genai>=1.0.0    # Google AI Python SDK for Gemini (vision verification)
```

**Install command:** `pip install google-genai`

---

## Deployment Checklist

| Step | Where | Action |
|------|-------|--------|
| 1 | Google AI Studio | Create API key at https://aistudio.google.com/apikey |
| 2 | Supabase SQL Editor | Run migration SQL (3 new columns on `evidence` table) |
| 3 | Railway Dashboard | Add `GEMINI_API_KEY` and `VISION_MODEL` environment variables |
| 4 | GitHub | Push code changes to feature branch |
| 5 | Railway | Auto-deploys from GitHub — verify build succeeds |
| 6 | Testing | Upload evidence → verify it goes through Gemini → check result stored |

---

## Cost Summary

| Item | Cost |
|------|------|
| Gemini 2.5 Flash free tier | **$0** |
| Rate limits | 10 RPM, 1,500 RPD |
| Per verification | ~$0.001 (negligible) |
| 100 verifications/day | ~$0.10 (still within free tier) |
| Total infrastructure impact | **Zero additional cost** |

---

## Implementation Order

1. Run migration SQL in Supabase
2. Get Gemini API key from Google AI Studio
3. Add env vars to `.env` and Railway
4. Update `config.py`
5. Install `google-genai`
6. Update `requirements.txt`
7. Update `db_models.py` (3 new columns)
8. Create `verifier.py` (new file)
9. Update `portfolio_manager.py` (remove old verify, add new verify_and_update)
10. Update `portfolio.py` (new endpoints, updated responses)
11. Write tests
12. Update docs (API_CONTRACT.md, SCHEMA.md, PRD)
13. Push to GitHub

---

## PRD Update (Full Section)

Replace the Task Completion & Portfolio section:

```markdown
* **Task Completion & Portfolio**
  * Mark a roadmap step/task as complete
  * Upload evidence for a completed task (photo, certificate file)
  * AI-verify uploaded certificates for authenticity / relevance
    * Uses Google Gemini 2.5 Flash (free tier) for vision-based verification
    * Dual-provider architecture: Groq for text (chat/roadmap/resume), Gemini for vision (evidence)
    * Note: Impala/Highrise gateway is inaccessible — all LLM calls route through Groq (text) and
      Google AI Studio (vision) — see TECH_STACK.md for provider details
    * Verification is career-context-aware: checks document type, content legitimacy, AND relevance
      to the user's career path and specific task
    * Returns: verified/rejected + confidence level + reason + detected issuer
    * Users can request re-verification if evidence was incorrectly rejected
  * Store uploaded evidence as part of user's portfolio
  * Evidence files stored in object storage (Supabase Storage), not on local server disk;
    database stores the fileURL, not the file itself.
```

---

<!-- :::summary::: -->
## AI Evidence Verification — Summary

### Overview

Fixes the broken evidence verification system by replacing the text-only Groq model with Google Gemini 2.5 Flash for vision-based analysis. Implements a dual-provider architecture where Groq handles all text tasks (chat, roadmap, resume) and Gemini handles image analysis (evidence verification). The system is career-context-aware — it checks not just "is this a real certificate?" but "is this certificate relevant to this user's career path and specific task?"

### What's Being Built

**New Verification Agent** (`verifier.py`)
- Uses Google Gemini 2.5 Flash (free tier, native vision)
- Receives image bytes + career context (career path, task title, description)
- Returns structured JSON: verified/rejected, confidence level, document type, issuer, reason
- Handles errors gracefully (timeouts, invalid JSON, API failures)

**Career-Context-Aware Analysis (3 Tiers)**
1. Document Type — Is this a real certificate/badge/screenshot or a blank/fake/meme?
2. Content Legitimacy — Does it have realistic elements (issuer, date, recipient, details)?
3. Career Relevance — Does it relate to the user's career path and the specific task?

**Enhanced Database Schema**
- `verification_reason` — human-readable explanation of verification result
- `verification_confidence` — high/medium/low confidence level
- `verified_at` — timestamp of when verification was completed

**New API Endpoints**
- `GET /evidence/{id}/verification` — view full verification details
- `POST /evidence/{id}/re-verify` — re-run verification on borderline cases

**Updated Response Shapes**
- Upload and portfolio responses now include reason, confidence, and timestamp
- Frontend can display verification badges with explanations

### Infrastructure Changes

**New Environment Variables**
- `GEMINI_API_KEY` — Google AI Studio key (free, no credit card)
- `VISION_MODEL` — `gemini-2.5-flash` (free tier, 1,500 RPD)

**Database Migration**
- 3 new columns on `evidence` table (ALTER TABLE, non-destructive)

**New Dependency**
- `google-genai` — Official Google AI Python SDK

### Cost
- **$0 additional cost** — Gemini 2.5 Flash free tier covers up to 1,500 verifications/day

### PRD Update
- Replaces "Llama 3 Vision" with "Google Gemini 2.5 Flash"
- Documents inaccessible Impala gateway
- Documents dual-provider architecture

### Files Changed
- `app/agents/verifier.py` (NEW — core verification agent)
- `app/core/config.py` (add Gemini env vars, fix Impala comment)
- `app/models/db_models.py` (3 new columns on Evidence)
- `app/agents/portfolio_manager.py` (remove old verify, add new verify_and_update)
- `app/api/routes/portfolio.py` (updated upload + 2 new endpoints)
- `requirements.txt` (add google-genai)
- `tests/test_evidence_verification.py` (NEW — 9 test cases)
- `docs/API_CONTRACT.md` (new endpoints + updated shapes)
- `docs/SCHEMA.md` (evidence table updates)
- PRD (replace Llama 3 Vision, add Impala note, document dual-provider)

### Success Criteria
- Evidence uploaded → Gemini Flash analyzes image with career context → result stored with reason + confidence + timestamp
- Invalid/fake images are rejected with clear explanations
- Legitimate evidence is verified even if not a perfect match (lenient policy)
- Re-verification works for borderline cases
- All tests pass, no real API calls in test suite
- Zero additional infrastructure cost
<!-- :::end-summary::: -->
