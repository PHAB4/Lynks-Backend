"""
Shared fixtures for integration tests.

Provides authenticated HTTP client state so each test file
doesn't need to duplicate auth setup.
"""
import os
import sys
from pathlib import Path

import httpx
import pytest
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

HTTP_TIMEOUT = 30.0

BASE_URL = os.getenv("BASE_URL", "https://lynks-backend-production.up.railway.app")
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "")
TEST_EMAIL = os.getenv("TEST_EMAIL", "test@lynks.com")
TEST_PASSWORD = os.getenv("TEST_PASSWORD", "TestPassword123!")


def _get_jwt_token() -> str | None:
    """Sign in (or sign up) via Supabase and return a JWT."""
    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        return None

    # Try sign-in first
    resp = httpx.post(
        f"{SUPABASE_URL}/auth/v1/token?grant_type=password",
        json={"email": TEST_EMAIL, "password": TEST_PASSWORD},
        headers={"apikey": SUPABASE_ANON_KEY, "Content-Type": "application/json"},
        timeout=HTTP_TIMEOUT,
    )
    if resp.status_code == 200:
        return resp.json().get("access_token")

    # Fall back to sign-up
    resp = httpx.post(
        f"{SUPABASE_URL}/auth/v1/signup",
        json={"email": TEST_EMAIL, "password": TEST_PASSWORD},
        headers={"apikey": SUPABASE_ANON_KEY, "Content-Type": "application/json"},
        timeout=HTTP_TIMEOUT,
    )
    if resp.status_code in (200, 201):
        return resp.json().get("access_token")

    return None


@pytest.fixture(scope="session")
def auth_token() -> str | None:
    """Session-scoped JWT token for integration tests."""
    token = _get_jwt_token()
    if token:
        # Verify token works
        resp = httpx.get(
            f"{BASE_URL}/health",
            headers={"Authorization": f"Bearer {token}"},
            timeout=HTTP_TIMEOUT,
        )
        if resp.status_code in (200, 404):
            return token
    return None


@pytest.fixture(scope="session")
def base_url() -> str:
    return BASE_URL
