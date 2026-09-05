"""
Unit tests for PATCH /roadmap/tasks/{task_id}/complete.

Tests the endpoint logic with mocked DB — no database required.
Covers: success, idempotent, not found, wrong user, inactive roadmap.

Run: python -m pytest tests/unit/test_task_complete_unit.py -v
"""

from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.routes.roadmap import router
from app.core.security import get_current_user_id
from app.db.postgres import get_db


# ── Helpers ────────────────────────────────────────────────────────────────

USER_ID = str(uuid4())
OTHER_USER_ID = str(uuid4())
ROADMAP_ID = str(uuid4())
STEP_ID = str(uuid4())
TASK_ID = str(uuid4())


def _make_task(status="pending"):
    task = MagicMock()
    task.id = TASK_ID
    task.step_id = STEP_ID
    task.title = "Complete Python course"
    task.status = status
    task.completed_at = None
    return task


def _make_step(roadmap):
    step = MagicMock()
    step.id = STEP_ID
    step.roadmap = roadmap
    return step


def _make_roadmap(user_id=USER_ID, is_active=True):
    rm = MagicMock()
    rm.id = ROADMAP_ID
    rm.user_id = user_id
    rm.is_active = is_active
    return rm


def _build_app(db_session):
    """Build a test FastAPI app with the roadmap router and mocked deps."""
    app = FastAPI()
    app.include_router(router)

    async def override_db():
        yield db_session

    async def override_user():
        return USER_ID

    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_current_user_id] = override_user
    return app


# ── Tests ──────────────────────────────────────────────────────────────────


class TestCompleteTask:
    """PATCH /roadmap/tasks/{task_id}/complete"""

    def test_complete_task_success(self):
        """Valid task → 200, status = 'complete', completed_at set."""
        task = _make_task(status="pending")
        roadmap = _make_roadmap()
        step = _make_step(roadmap)

        db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.side_effect = [task, step]
        db.execute = AsyncMock(return_value=mock_result)
        db.commit = AsyncMock()
        db.refresh = AsyncMock()

        app = _build_app(db)
        client = TestClient(app)

        resp = client.patch(f"/roadmap/tasks/{TASK_ID}/complete")
        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert body["task_id"] == TASK_ID
        assert body["title"] == "Complete Python course"
        assert "marked as complete" in body["message"]

        # Verify DB state was mutated
        assert task.status == "complete"
        assert task.completed_at is not None

    def test_complete_task_idempotent(self):
        """Already complete task → still returns 200."""
        task = _make_task(status="complete")
        roadmap = _make_roadmap()
        step = _make_step(roadmap)

        db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.side_effect = [task, step]
        db.execute = AsyncMock(return_value=mock_result)

        app = _build_app(db)
        client = TestClient(app)

        resp = client.patch(f"/roadmap/tasks/{TASK_ID}/complete")
        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True

        # Should NOT commit (idempotent — no DB write)
        db.commit.assert_not_called()

    def test_complete_task_not_found(self):
        """Invalid UUID → 404."""
        db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        db.execute = AsyncMock(return_value=mock_result)

        app = _build_app(db)
        client = TestClient(app)

        resp = client.patch(f"/roadmap/tasks/{TASK_ID}/complete")
        assert resp.status_code == 404
        body = resp.json()
        assert body["detail"]["error"]["code"] == "task_not_found"

    def test_complete_task_wrong_user(self):
        """Task belongs to different user's roadmap → 403."""
        task = _make_task()
        roadmap = _make_roadmap(user_id=OTHER_USER_ID)  # different user
        step = _make_step(roadmap)

        db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.side_effect = [task, step]
        db.execute = AsyncMock(return_value=mock_result)

        app = _build_app(db)
        client = TestClient(app)

        resp = client.patch(f"/roadmap/tasks/{TASK_ID}/complete")
        assert resp.status_code == 403
        body = resp.json()
        assert body["detail"]["error"]["code"] == "not_your_task"

    def test_complete_task_roadmap_inactive(self):
        """Task belongs to inactive roadmap → 403."""
        task = _make_task()
        roadmap = _make_roadmap(is_active=False)
        step = _make_step(roadmap)

        db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.side_effect = [task, step]
        db.execute = AsyncMock(return_value=mock_result)

        app = _build_app(db)
        client = TestClient(app)

        resp = client.patch(f"/roadmap/tasks/{TASK_ID}/complete")
        assert resp.status_code == 403
        body = resp.json()
        assert body["detail"]["error"]["code"] == "roadmap_inactive"
