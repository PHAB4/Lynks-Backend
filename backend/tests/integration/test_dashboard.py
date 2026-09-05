"""
Dashboard endpoint integration tests.

Hits the LIVE API to verify the dashboard summary endpoint returns
the correct shape and handles edge cases gracefully.

Requires: running backend, valid Supabase credentials in .env
Run: python -m pytest tests/integration/test_dashboard.py -v
"""

from __future__ import annotations

import os
from pathlib import Path

import httpx
import pytest
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

HTTP_TIMEOUT = 30.0
BASE_URL = os.getenv("BASE_URL", "https://lynks-backend-production.up.railway.app")


@pytest.fixture(scope="module")
def auth_headers(auth_token: str | None) -> dict:
    """Build Authorization headers from the session token."""
    if not auth_token:
        pytest.skip("No auth token available — Supabase not configured")
    return {"Authorization": f"Bearer {auth_token}"}


class TestDashboardSummary:
    """Integration tests for GET /dashboard/summary."""

    def test_returns_200(self, auth_headers: dict):
        """Endpoint returns 200 for authenticated user."""
        resp = httpx.get(
            f"{BASE_URL}/dashboard/summary",
            headers=auth_headers,
            timeout=HTTP_TIMEOUT,
        )
        assert resp.status_code == 200

    def test_has_all_sections(self, auth_headers: dict):
        """Response contains all 5 expected top-level keys."""
        resp = httpx.get(
            f"{BASE_URL}/dashboard/summary",
            headers=auth_headers,
            timeout=HTTP_TIMEOUT,
        )
        data = resp.json()
        assert "profile" in data
        assert "roadmap" in data
        assert "opportunities" in data
        assert "notifications" in data
        assert "onboarding_checklist" in data

    def test_roadmap_section_shape(self, auth_headers: dict):
        """Roadmap section has the expected fields."""
        resp = httpx.get(
            f"{BASE_URL}/dashboard/summary",
            headers=auth_headers,
            timeout=HTTP_TIMEOUT,
        )
        roadmap = resp.json()["roadmap"]
        assert isinstance(roadmap["has_roadmap"], bool)
        assert isinstance(roadmap["total_tasks"], int)
        assert isinstance(roadmap["completed_tasks"], int)
        assert isinstance(roadmap["progress_percent"], int)
        assert isinstance(roadmap["total_steps"], int)

    def test_opportunities_section_shape(self, auth_headers: dict):
        """Opportunities section has new_count and recent list."""
        resp = httpx.get(
            f"{BASE_URL}/dashboard/summary",
            headers=auth_headers,
            timeout=HTTP_TIMEOUT,
        )
        opps = resp.json()["opportunities"]
        assert isinstance(opps["new_count"], int)
        assert isinstance(opps["recent"], list)
        assert opps["new_count"] >= 0

    def test_notifications_section_shape(self, auth_headers: dict):
        """Notifications section has unread_count and recent list."""
        resp = httpx.get(
            f"{BASE_URL}/dashboard/summary",
            headers=auth_headers,
            timeout=HTTP_TIMEOUT,
        )
        notifs = resp.json()["notifications"]
        assert isinstance(notifs["unread_count"], int)
        assert isinstance(notifs["recent"], list)
        assert notifs["unread_count"] >= 0

    def test_onboarding_checklist_shape(self, auth_headers: dict):
        """Onboarding checklist has all 4 boolean keys."""
        resp = httpx.get(
            f"{BASE_URL}/dashboard/summary",
            headers=auth_headers,
            timeout=HTTP_TIMEOUT,
        )
        checklist = resp.json()["onboarding_checklist"]
        assert "complete_profile" in checklist
        assert "start_chat" in checklist
        assert "generate_roadmap" in checklist
        assert "browse_opportunities" in checklist
        for key in checklist:
            assert isinstance(checklist[key], bool)

    def test_unauthenticated_returns_401(self):
        """Request without token returns 401."""
        resp = httpx.get(
            f"{BASE_URL}/dashboard/summary",
            timeout=HTTP_TIMEOUT,
        )
        assert resp.status_code in (401, 403)

    def test_graceful_with_no_roadmap(self, auth_headers: dict):
        """If user has no roadmap, roadmap section still returns valid defaults."""
        resp = httpx.get(
            f"{BASE_URL}/dashboard/summary",
            headers=auth_headers,
            timeout=HTTP_TIMEOUT,
        )
        roadmap = resp.json()["roadmap"]
        if not roadmap["has_roadmap"]:
            assert roadmap["total_tasks"] == 0
            assert roadmap["progress_percent"] == 0
            assert roadmap["total_steps"] == 0
