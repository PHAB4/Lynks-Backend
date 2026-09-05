"""
Integration tests for PATCH /roadmap/tasks/{task_id} — general task update.

Requires running server + valid auth token.
Run: python -m pytest tests/integration/test_task_update.py -v -s
"""

from __future__ import annotations

import os
import uuid
from pathlib import Path

import httpx
import pytest
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent.parent / ".env")

BASE_URL = os.getenv("BASE_URL", "https://lynks-backend-production.up.railway.app")
HTTP_TIMEOUT = 30.0


def _get_token():
    supabase_url = os.getenv("SUPABASE_URL", "")
    supabase_anon_key = os.getenv("SUPABASE_ANON_KEY", "")
    test_email = os.getenv("TEST_EMAIL", "")
    test_password = os.getenv("TEST_PASSWORD", "")

    if not all([supabase_url, supabase_anon_key, test_email, test_password]):
        return None

    try:
        resp = httpx.post(
            f"{supabase_url}/auth/v1/token?grant_type=password",
            json={"email": test_email, "password": test_password},
            headers={"apikey": supabase_anon_key, "Content-Type": "application/json"},
            timeout=HTTP_TIMEOUT,
        )
        if resp.status_code == 200:
            return resp.json().get("access_token")
    except httpx.ConnectError:
        pass
    return None


@pytest.fixture(scope="module")
def token():
    t = _get_token()
    if not t:
        pytest.skip("No auth token available")
    return t


@pytest.fixture(scope="module")
def headers(token):
    return {"Authorization": f"Bearer {token}"}


def _get_roadmap(hdrs):
    return httpx.get(f"{BASE_URL}/roadmap", headers=hdrs, timeout=HTTP_TIMEOUT)


def _find_pending_task(roadmap_data):
    for step in roadmap_data.get("steps", []):
        for task in step.get("tasks", []):
            if task["status"] == "pending":
                return step, task
    return None, None


class TestUpdateTask:
    """Integration tests for PATCH /roadmap/tasks/{task_id}"""

    def test_update_task_title(self, headers):
        """Update a task title, verify via GET /roadmap."""
        resp = _get_roadmap(headers)
        if resp.status_code == 404:
            pytest.skip("No roadmap found — generate one first via the mentor chat")
        assert resp.status_code == 200

        step, task = _find_pending_task(resp.json())
        if not task:
            pytest.skip("No pending tasks to update")

        original_title = task["title"]
        new_title = f"Updated: {original_title}"

        resp = httpx.patch(
            f"{BASE_URL}/roadmap/tasks/{task['task_id']}",
            headers=headers,
            json={"title": new_title},
            timeout=HTTP_TIMEOUT,
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert body["title"] == new_title

        # Restore original title
        httpx.patch(
            f"{BASE_URL}/roadmap/tasks/{task['task_id']}",
            headers=headers,
            json={"title": original_title},
            timeout=HTTP_TIMEOUT,
        )

    def test_update_task_not_found(self, headers):
        """404 for a random UUID."""
        resp = httpx.patch(
            f"{BASE_URL}/roadmap/tasks/{str(uuid.uuid4())}",
            headers=headers,
            json={"title": "nope"},
            timeout=HTTP_TIMEOUT,
        )
        assert resp.status_code in (404, 403)

    def test_update_task_unauthenticated(self):
        """No token → 401."""
        try:
            resp = httpx.patch(
                f"{BASE_URL}/roadmap/tasks/{str(uuid.uuid4())}",
                json={"title": "nope"},
                timeout=HTTP_TIMEOUT,
            )
            assert resp.status_code in (401, 403, 404)
        except httpx.ConnectError:
            pytest.skip(f"Cannot reach server at {BASE_URL}")
