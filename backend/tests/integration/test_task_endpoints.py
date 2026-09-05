"""
Integration tests for PATCH /roadmap/tasks/{task_id}/complete.

These tests require a running server + valid auth token.
They verify the full request/response cycle.

Run: BASE_URL=https://your-app.up.railway.app python -m pytest tests/integration/test_task_endpoints.py -v
"""

from __future__ import annotations

import os
import uuid
from pathlib import Path

import httpx
import pytest
from dotenv import load_dotenv

# Load .env from backend/ root
load_dotenv(Path(__file__).resolve().parent.parent.parent / ".env")

BASE_URL = os.getenv("BASE_URL", "https://lynks-backend-production.up.railway.app")
HTTP_TIMEOUT = 30.0


def _get_token():
    """Sign in via Supabase and return a JWT."""
    supabase_url = os.getenv("SUPABASE_URL", "")
    supabase_anon_key = os.getenv("SUPABASE_ANON_KEY", "")
    test_email = os.getenv("TEST_EMAIL", "")
    test_password = os.getenv("TEST_PASSWORD", "")

    print(f"\n[DEBUG] SUPABASE_URL: {'SET (' + supabase_url[:30] + '...)' if supabase_url else 'EMPTY'}")
    print(f"[DEBUG] SUPABASE_ANON_KEY: {'SET' if supabase_anon_key else 'EMPTY'}")
    print(f"[DEBUG] TEST_EMAIL: {'SET (' + test_email + ')' if test_email else 'EMPTY'}")
    print(f"[DEBUG] TEST_PASSWORD: {'SET' if test_password else 'EMPTY'}")

    if not supabase_url or not supabase_anon_key:
        print("[DEBUG] Missing SUPABASE_URL or SUPABASE_ANON_KEY — returning None")
        return None
    if not test_email or not test_password:
        print("[DEBUG] Missing TEST_EMAIL or TEST_PASSWORD — returning None")
        return None

    try:
        resp = httpx.post(
            f"{supabase_url}/auth/v1/token?grant_type=password",
            json={"email": test_email, "password": test_password},
            headers={
                "apikey": supabase_anon_key,
                "Content-Type": "application/json",
            },
            timeout=HTTP_TIMEOUT,
        )
        print(f"[DEBUG] Supabase auth response: {resp.status_code}")
        if resp.status_code == 200:
            token = resp.json().get("access_token")
            print(f"[DEBUG] Got token: {'YES (length ' + str(len(token)) + ')' if token else 'NO'}")
            return token
        else:
            print(f"[DEBUG] Auth failed: {resp.text[:200]}")
    except httpx.ConnectError as e:
        print(f"[DEBUG] ConnectError: {e}")
    return None


@pytest.fixture(scope="module")
def token():
    t = _get_token()
    if not t:
        pytest.skip("No auth token available — check .env credentials and Supabase project")
    return t


@pytest.fixture(scope="module")
def headers(token):
    return {"Authorization": f"Bearer {token}"}


def _get_roadmap(hdrs):
    """GET /roadmap and return the response."""
    return httpx.get(f"{BASE_URL}/roadmap", headers=hdrs, timeout=HTTP_TIMEOUT)


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
        if resp.status_code == 404:
            pytest.skip("No roadmap found — generate one first via the mentor chat")
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
        if resp.status_code == 404:
            pytest.skip("No roadmap found — generate one first via the mentor chat")
        assert resp.status_code == 200

        step, task = _find_pending_task(resp.json())
        if not task:
            pytest.skip("No pending tasks to complete")

        resp = httpx.patch(
            f"{BASE_URL}/roadmap/tasks/{task['task_id']}/complete",
            headers=headers,
            timeout=HTTP_TIMEOUT,
        )
        assert resp.status_code == 200

        resp = _get_roadmap(headers)
        assert resp.status_code == 200
        roadmap = resp.json()

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
        try:
            resp = httpx.patch(
                f"{BASE_URL}/roadmap/tasks/{str(uuid.uuid4())}/complete",
                timeout=HTTP_TIMEOUT,
            )
            assert resp.status_code in (401, 403, 404)
        except httpx.ConnectError:
            pytest.skip(f"Cannot reach server at {BASE_URL}")
