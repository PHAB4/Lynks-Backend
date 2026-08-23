"""
Lynks Backend — End-to-End Test Script

This script tests every API endpoint against a running server.
It reports pass/fail for each endpoint so you know exactly what works and what doesn't.

SETUP:
  1. Make sure your server is running: uvicorn app.main:app --reload --port 8000
  2. Fill in the CONFIG section below with your values
  3. Run: python tests/test_endpoints.py

WHAT IT TESTS:
  - Health check
  - Profile (GET)
  - Roadmap (POST generate, GET, POST regenerate)
  - Evidence upload (POST)
  - Portfolio (GET)
  - Opportunities (GET, GET with category filter)
  - Chat (POST message, GET history, DELETE history)
"""

from __future__ import annotations

import json
import os
import sys
import time
from pathlib import Path

import httpx
from dotenv import load_dotenv

# Load .env from project root (backend/)
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

HTTP_TIMEOUT = 30.0  # seconds — standard timeout
LLM_TIMEOUT = 60.0  # seconds — LLM calls need more headroom

# ══════════════════════════════════════════════════════════════════════════════
#  CONFIG — Reads from .env automatically
# ══════════════════════════════════════════════════════════════════════════════

BASE_URL = os.getenv("BASE_URL", "http://localhost:8000")
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://your-project.supabase.co")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "")

# If you already have a JWT token, paste it here or set JWT_TOKEN env var.
# If not, leave it as None and the script will create a test user automatically.
JWT_TOKEN = os.getenv("JWT_TOKEN")

# Path to a test image for evidence upload (any JPEG/PNG works)
TEST_IMAGE_PATH = "tests/test-image.jpg"


# ══════════════════════════════════════════════════════════════════════════════
#  TEST RUNNER
# ══════════════════════════════════════════════════════════════════════════════

class Colors:
    GREEN = "\033[92m"
    RED = "\033[91m"
    YELLOW = "\033[93m"
    CYAN = "\033[96m"
    BOLD = "\033[1m"
    END = "\033[0m"


class TestResult:
    def __init__(self, name: str, passed: bool, status_code: int = 0, message: str = "", response: str = ""):
        self.name = name
        self.passed = passed
        self.status_code = status_code
        self.message = message
        self.response = response


results: list[TestResult] = []


def test(name: str):
    """Decorator that runs a test function and records the result."""
    def decorator(func):
        def wrapper():
            print(f"\n{Colors.CYAN}▶ {name}{Colors.END}", end=" ... ", flush=True)
            try:
                result = func()
                if result and isinstance(result, tuple):
                    passed, msg = result
                else:
                    passed, msg = True, ""
                status_code = getattr(func, "_status_code", 200)
                results.append(TestResult(name, passed, status_code, msg))
                if passed:
                    print(f"{Colors.GREEN}PASS ✓{Colors.END}" + (f" ({msg})" if msg else ""))
                else:
                    print(f"{Colors.RED}FAIL ✗{Colors.END} — {msg}")
            except Exception as e:
                results.append(TestResult(name, False, 0, str(e)))
                print(f"{Colors.RED}ERROR ✗{Colors.END} — {e}")
        wrapper.__name__ = func.__name__
        wrapper._test_name = name
        return wrapper
    return decorator


def headers(token: str | None = None) -> dict:
    """Build request headers with optional JWT."""
    h = {"Content-Type": "application/json"}
    if token:
        h["Authorization"] = f"Bearer {token}"
    return h


# ══════════════════════════════════════════════════════════════════════════════
#  TESTS
# ══════════════════════════════════════════════════════════════════════════════

# Shared state across tests
_state = {}


def run_tests():
    print(f"\n{Colors.BOLD}{'=' * 60}")
    print("  Lynks Backend — Endpoint Test Suite")
    print(f"{'=' * 60}{Colors.END}")
    print(f"  Target: {BASE_URL}")
    print(f"  Time:   {time.strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'=' * 60}\n")

    # ── 1. Health Check ──────────────────────────────────────────────────────

    @test("GET /health")
    def test_health():
        resp = httpx.get(f"{BASE_URL}/health", timeout=HTTP_TIMEOUT)
        if resp.status_code != 200:
            return False, f"Expected 200, got {resp.status_code}"
        data = resp.json()
        if data.get("status") != "ok":
            return False, f"Expected status=ok, got {data}"
        return True, "server is healthy"

    # ── 2. Auth — Get or create JWT ──────────────────────────────────────────

    @test("POST /auth/v1/signup (get test JWT)")
    def test_auth():
        global JWT_TOKEN
        if JWT_TOKEN and JWT_TOKEN != "your-anon-key-here":
            _state["token"] = JWT_TOKEN
            return True, "using pre-supplied token"

        if SUPABASE_ANON_KEY == "your-anon-key-here":
            # No Supabase key configured — check if server accepts requests without auth
            resp = httpx.get(f"{BASE_URL}/roadmap", headers=headers("fake-token"))
            if resp.status_code in (401, 403):
                return True, "auth required (no anon key to test signup)"
            else:
                return False, "Server should require auth but returned 200 without valid token"

        test_email = f"test_{int(time.time())}@lynks-test.com"
        test_password = "TestPassword123!"
        resp = httpx.post(
            f"{SUPABASE_URL}/auth/v1/signup",
            headers={"apikey": SUPABASE_ANON_KEY, "Content-Type": "application/json"},
            json={"email": test_email, "password": test_password},
            timeout=HTTP_TIMEOUT,
        )
        if resp.status_code == 200:
            _state["token"] = resp.json().get("access_token", "")
            _state["email"] = test_email
            return True, f"created test user: {test_email}"
        else:
            return False, f"Signup failed: {resp.status_code} — {resp.text[:200]}"

    # ── 3. Profile ───────────────────────────────────────────────────────────

    @test("GET /profile (returns 404 for fresh user)")
    def test_profile():
        token = _state.get("token")
        resp = httpx.get(f"{BASE_URL}/profile", headers=headers(token))
        if resp.status_code in (200, 404):
            return True, f"status {resp.status_code}"
        else:
            return False, f"Expected 200 or 404, got {resp.status_code}: {resp.text[:200]}"

    # ── 4. Roadmap — Generate ────────────────────────────────────────────────

    @test("POST /roadmap/generate (career architect)")
    def test_roadmap_generate():
        token = _state.get("token")
        resp = httpx.post(f"{BASE_URL}/roadmap/generate", headers=headers(token))
        if resp.status_code == 201:
            data = resp.json()
            roadmap_id = data.get("roadmap_id")
            steps = data.get("steps", [])
            _state["roadmap_id"] = roadmap_id
            _state["step_count"] = len(steps)
            if steps:
                _state["step_id"] = steps[0].get("step_id")
                tasks = steps[0].get("tasks", [])
                if tasks:
                    _state["task_id"] = tasks[0].get("task_id")
            return True, f"roadmap_id={roadmap_id[:8]}..., {len(steps)} steps"
        else:
            return False, f"Expected 201, got {resp.status_code}: {resp.text[:300]}"
