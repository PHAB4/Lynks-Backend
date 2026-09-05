"""
Unit tests for PATCH /roadmap/tasks/{task_id} — general task update.

Tests partial updates (title, description, status), completed_at handling,
and invalid status validation. No database or server required.
"""

from __future__ import annotations

import os
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite://")
os.environ.setdefault("SUPABASE_URL", "https://test.supabase.co")
os.environ.setdefault("SUPABASE_ANON_KEY", "test-key")

from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.api.routes.roadmap import update_task
from app.models.schemas import TaskUpdateRequest


# ── Fake ORM objects ─────────────────────────────────────────────────────


class FakeTask:
    def __init__(
        self,
        task_id="task-001",
        step_id="step-001",
        title="Original Title",
        description="Original Description",
        order=1,
        status="pending",
        completed_at=None,
    ):
        self.id = task_id
        self.step_id = step_id
        self.title = title
        self.description = description
        self.order = order
        self.status = status
        self.completed_at = completed_at


class FakeStep:
    def __init__(self, step_id="step-001", roadmap=None):
        self.id = step_id
        self.roadmap = roadmap


class FakeRoadmap:
    def __init__(self, user_id="user-001", is_active=True):
        self.user_id = user_id
        self.is_active = is_active


# ── Helpers ──────────────────────────────────────────────────────────────


def _build_mock_session(task, step):
    """Build a mock db session that returns the given task and step on first two queries."""
    mock_result = MagicMock()
    mock_result.scalar_one_or_none = MagicMock(side_effect=[task, step])
    db = AsyncMock()
    db.execute = AsyncMock(return_value=mock_result)
    return db


# ── Tests ────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_update_title_only():
    """Update title — other fields unchanged."""
    task = FakeTask(title="Original Title", description="Keep this", status="pending")
    step = FakeStep(roadmap=FakeRoadmap())
    db = _build_mock_session(task, step)

    body = TaskUpdateRequest(title="New Title")
    result = await update_task(task_id="task-001", body=body, user_id="user-001", db=db)

    assert result["title"] == "New Title"
    assert task.description == "Keep this"
    assert task.status == "pending"


@pytest.mark.asyncio
async def test_update_description_only():
    """Update description — other fields unchanged."""
    task = FakeTask(title="Keep Title", description="Old desc", status="pending")
    step = FakeStep(roadmap=FakeRoadmap())
    db = _build_mock_session(task, step)

    body = TaskUpdateRequest(description="New description")
    result = await update_task(task_id="task-001", body=body, user_id="user-001", db=db)

    assert task.title == "Keep Title"
    assert result["status"] == "pending"


@pytest.mark.asyncio
async def test_update_status_to_in_progress():
    """Transition pending → in_progress, completed_at cleared."""
    task = FakeTask(status="pending", completed_at=datetime.now(timezone.utc))
    step = FakeStep(roadmap=FakeRoadmap())
    db = _build_mock_session(task, step)

    body = TaskUpdateRequest(status="in_progress")
    result = await update_task(task_id="task-001", body=body, user_id="user-001", db=db)

    assert result["status"] == "in_progress"
    assert task.completed_at is None


@pytest.mark.asyncio
async def test_update_status_to_complete_sets_timestamp():
    """Transition pending → complete sets completed_at."""
    task = FakeTask(status="pending", completed_at=None)
    step = FakeStep(roadmap=FakeRoadmap())
    db = _build_mock_session(task, step)

    body = TaskUpdateRequest(status="complete")
    result = await update_task(task_id="task-001", body=body, user_id="user-001", db=db)

    assert result["status"] == "complete"
    assert task.completed_at is not None


@pytest.mark.asyncio
async def test_revert_complete_to_pending_clears_timestamp():
    """Reverting complete → pending clears completed_at."""
    task = FakeTask(status="complete", completed_at=datetime.now(timezone.utc))
    step = FakeStep(roadmap=FakeRoadmap())
    db = _build_mock_session(task, step)

    body = TaskUpdateRequest(status="pending")
    result = await update_task(task_id="task-001", body=body, user_id="user-001", db=db)

    assert result["status"] == "pending"
    assert task.completed_at is None


@pytest.mark.asyncio
async def test_invalid_status_raises_400():
    """Invalid status value → 400."""
    from fastapi import HTTPException

    body = TaskUpdateRequest(status="garbage")
    with pytest.raises(HTTPException) as exc_info:
        await update_task(task_id="task-001", body=body, user_id="user-001", db=AsyncMock())

    assert exc_info.value.status_code == 400
    assert "invalid_status" in str(exc_info.value.detail)
