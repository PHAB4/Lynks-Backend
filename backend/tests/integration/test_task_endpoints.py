"""
Integration tests for PATCH /roadmap/tasks/{task_id}/complete.

These tests require a running server + valid auth token.
They verify the full request/response cycle.

Run: python -m pytest tests/integration/test_task_endpoints.py -v
"""

from __future__ import annotations

import os

import httpx
import pytest


@pytest.fixture(scope="module", autouse=True)
def _check_server():
    """Skip the entire module if the server is unreachable."""
    try:
        httpx.get(f"{BASE_URL}/docs", timeout=10.0)
    except httpx.ConnectError:
        pytest.skip(f"Cannot reach server at {BASE_URL} — is it running?")

# Skip entire module if no server / auth available
BASE_URL = os.getenv("BASE_URL", "https://lynks-backend-production.up.railway.app")
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "")
TEST_EMAIL = os.getenv("TEST_EMAIL", "")
TEST_PASSWORD = os.getenv("TEST_PASSWORD", "")
HTTP_TIMEOUT = 30.0


def _get_token():
    """Sign in via Supabase and return a JWT."""
    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        return None
    try:
        resp = httpx.post(
            f"{SUPABASE_URL}/auth/v1/token?grant_type=password",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD},
            headers={
                "apikey": SUPABASE_ANON_KEY,
                "Content-Type": "application/json",
            },
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
        pytest.skip("No auth token available — set env vars and start server")
    return t


@pytest.fixture(scope="module")
def headers(token):
    return {"Authorization": f"Bearer {token}"}


def _get_roadmap(headers):
    """GET /roadmap and return the response."""
    return httpx.get(f"{BASE_URL}/roadmap", headers=headers, timeout=HTTP_TIMEOUT)


def _find_pending_task(roadmap_data):
    """Find the first pending task in the roadmap."""
    for step in roadmap_data.get("steps", []):
        for task in step.get("tasks", []):
            if task["status"] == "pending":
                return step, task
    return None, None


class TestCompleteTask:
    """Integration tests for PATCH /roadmap/tasks/{task_id}/complete"""

    def test_complete_task(self, headers):
        """Complete a pending task → 200 + correct shape."""
        resp = _get_roadmap(headers)
        assert resp.status_code == 200

        step, task = _find_pending_task(resp.json())
        if not task:
            pytest.skip("No pending tasks to complete")

        task_id = task["task_id"]
        resp = httpx.patch(
            f"{BASE_URL}/roadmap/tasks/{task_id}/complete",
            headers=headers,
            timeout=HTTP_TIMEOUT,
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert body["task_id"] == task_id
        assert "marked as complete" in body["message"]

    def test_complete_task_then_check_roadmap(self, headers):
        """Complete a task, then GET /roadmap — step status updates dynamically."""
        resp = _get_roadmap(headers)
        assert resp.status_code == 200

        step, task = _find_pending_task(resp.json())
        if not task:
            pytest.skip("No pending tasks to complete")

        # Complete the task
        resp = httpx.patch(
            f"{BASE_URL}/roadmap/tasks/{task['task_id']}/complete",
            headers=headers,
            timeout=HTTP_TIMEOUT,
        )
        assert resp.status_code == 200

        # Refetch roadmap
        resp = _get_roadmap(headers)
        assert resp.status_code == 200
        roadmap = resp.json()

        # Find the task in the updated roadmap
        for s in roadmap["steps"]:
            if s["step_id"] == step["step_id"]:
                for t in s["tasks"]:
                    if t["task_id"] == task["task_id"]:
                        assert t["status"] == "complete"
                        return
                break
        pytest.fail("Completed task not found in roadmap")

    def test_complete_task_unauthenticated(self):
        """No token → 401."""
        import uuid
        try:
            resp = httpx.patch(
                f"{BASE_URL}/roadmap/tasks/{str(uuid.uuid4())}/complete",
                timeout=HTTP_TIMEOUT,
            )
            assert resp.status_code == 401
        except httpx.ConnectError:
            pytest.skip(f"Cannot reach server at {BASE_URL}")
