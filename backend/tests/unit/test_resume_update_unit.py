"""
Unit tests for PATCH /resume — resume content update.

Tests successful update, no resume found (404), content replacement,
and response shape. No database or server required.
"""

from __future__ import annotations

import os
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite://")
os.environ.setdefault("SUPABASE_URL", "https://test.supabase.co")
os.environ.setdefault("SUPABASE_ANON_KEY", "test-key")

from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.api.routes.resume import update_resume, ResumeUpdateRequest


# ── Fake ORM objects ─────────────────────────────────────────────────────


class FakeResume:
    def __init__(
        self,
        resume_id="resume-001",
        user_id="user-001",
        content=None,
        created_at=None,
        updated_at=None,
    ):
        self.id = resume_id
        self.user_id = user_id
        self.content = content or {
            "name": "Test User",
            "email": "test@test.com",
            "objective": "Original objective",
            "education": [],
            "skills": ["Python"],
            "experience": [],
            "projects": [],
            "certifications": [],
            "interests": [],
        }
        self.created_at = created_at or datetime(2026, 9, 1, tzinfo=timezone.utc)
        self.updated_at = updated_at


# ── Helpers ──────────────────────────────────────────────────────────────


def _build_mock_session(resume):
    """Build a mock db session that returns the given resume on execute."""
    mock_result = MagicMock()
    mock_result.scalar_one_or_none = MagicMock(return_value=resume)
    db = AsyncMock()
    db.execute = AsyncMock(return_value=mock_result)
    return db


def _mock_session_no_resume():
    """Build a mock db session that returns None (no resume found)."""
    mock_result = MagicMock()
    mock_result.scalar_one_or_none = MagicMock(return_value=None)
    db = AsyncMock()
    db.execute = AsyncMock(return_value=mock_result)
    return db


# ── Tests ────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_update_resume_replaces_content():
    """PATCH /resume replaces the full content dict."""
    resume = FakeResume()
    db = _build_mock_session(resume)

    new_content = {
        "name": "Test User",
        "email": "test@test.com",
        "objective": "Updated objective — career pivot",
        "education": [{"institution": "UWI", "level": "BSc", "details": "CS"}],
        "skills": ["Python", "React", "FastAPI"],
        "experience": [{"title": "Dev", "organization": "Acme", "description": "Built things"}],
        "projects": [{"title": "Lynks", "description": "Career platform", "skills_used": ["Python"]}],
        "certifications": ["AWS Cloud Practitioner"],
        "interests": ["AI", "Web Dev"],
    }

    body = ResumeUpdateRequest(content=new_content)
    result = await update_resume(body=body, user_id="user-001", db=db)

    assert result["resume_id"] == "resume-001"
    assert result["content"]["objective"] == "Updated objective — career pivot"
    assert result["content"]["skills"] == ["Python", "React", "FastAPI"]
    assert len(result["content"]["experience"]) == 1
    assert result["content"]["certifications"] == ["AWS Cloud Practitioner"]


@pytest.mark.asyncio
async def test_update_resume_returns_correct_shape():
    """Response includes resume_id, content, created_at, updated_at."""
    resume = FakeResume()
    db = _build_mock_session(resume)

    body = ResumeUpdateRequest(content=resume.content)
    result = await update_resume(body=body, user_id="user-001", db=db)

    assert "resume_id" in result
    assert "content" in result
    assert "created_at" in result
    assert "updated_at" in result
    assert isinstance(result["content"], dict)


@pytest.mark.asyncio
async def test_update_resume_no_resume_found_404():
    """PATCH /resume with no existing resume → 404."""
    from fastapi import HTTPException

    db = _mock_session_no_resume()
    body = ResumeUpdateRequest(content={"name": "Nobody"})

    with pytest.raises(HTTPException) as exc_info:
        await update_resume(body=body, user_id="user-001", db=db)

    assert exc_info.value.status_code == 404
    assert "no_resume" in str(exc_info.value.detail)


@pytest.mark.asyncio
async def test_update_resume_preserves_created_at():
    """PATCH /resume updates content but does not change created_at."""
    original_created = datetime(2026, 8, 15, tzinfo=timezone.utc)
    resume = FakeResume(created_at=original_created)
    db = _build_mock_session(resume)

    new_content = resume.content.copy()
    new_content["skills"] = ["Go", "Rust"]
    body = ResumeUpdateRequest(content=new_content)
    result = await update_resume(body=body, user_id="user-001", db=db)

    assert result["created_at"] == "2026-08-15T00:00:00+00:00"
    assert result["content"]["skills"] == ["Go", "Rust"]


@pytest.mark.asyncio
async def test_update_resume_partial_content_fields():
    """PATCH /resume with a partial content dict still replaces entirely."""
    resume = FakeResume()
    db = _build_mock_session(resume)

    minimal_content = {"name": "Test User", "skills": ["Only Skills"]}
    body = ResumeUpdateRequest(content=minimal_content)
    result = await update_resume(body=body, user_id="user-001", db=db)

    assert result["content"]["name"] == "Test User"
    assert result["content"]["skills"] == ["Only Skills"]
    assert "objective" not in result["content"]


@pytest.mark.asyncio
async def test_update_resume_commits_to_db():
    """PATCH /resume calls db.commit() and db.refresh()."""
    resume = FakeResume()
    db = _build_mock_session(resume)

    body = ResumeUpdateRequest(content=resume.content)
    await update_resume(body=body, user_id="user-001", db=db)

    db.commit.assert_awaited_once()
    db.refresh.assert_awaited_once_with(resume)
