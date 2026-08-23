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

HTTP_TIMEOUT = 30.0
LLM_TIMEOUT = 60.0

BASE_URL = os.getenv("BASE_URL", "http://localhost:8000")
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://your-project.supabase.co")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "")
JWT_TOKEN = os.getenv("JWT_TOKEN")
TEST_IMAGE_PATH = "tests/test-image.jpg"

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
    def decorator(func):
        def wrapper():
            print(f"\n{Colors.CYAN}> {name}{Colors.END}", end=" ... ", flush=True)
            try:
                result = func()
                if result and isinstance(result, tuple):
                    passed, msg = result
                else:
                    passed, msg = True, ""
                status_code = getattr(func, "_status_code", 200)
                results.append(TestResult(name, passed, status_code, msg))
                if passed:
                    print(f"{Colors.GREEN}PASS{Colors.END}" + (f" ({msg})" if msg else ""))
                else:
                    print(f"{Colors.RED}FAIL{Colors.END} - {msg}")
            except Exception as e:
                results.append(TestResult(name, False, 0, str(e)))
                print(f"{Colors.RED}ERROR{Colors.END} - {e}")
        wrapper.__name__ = func.__name__
        wrapper._test_name = name
        return wrapper
    return decorator

def headers(token: str | None = None) -> dict:
    h = {"Content-Type": "application/json"}
    if token:
        h["Authorization"] = f"Bearer {token}"
    return h

_state = {}

def run_tests():
    print(f"\n{Colors.BOLD}{'=' * 60}")
    print("  Lynks Backend - Endpoint Test Suite")
    print(f"{'=' * 60}{Colors.END}")
    print(f"  Target: {BASE_URL}")
    print(f"  Time:   {time.strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'=' * 60}\n")

    @test("GET /health")
    def test_health():
        resp = httpx.get(f"{BASE_URL}/health", timeout=HTTP_TIMEOUT)
        if resp.status_code != 200:
            return False, f"Expected 200, got {resp.status_code}"
        data = resp.json()
        if data.get("status") != "ok":
            return False, f"Expected status=ok, got {data}"
        return True, "server is healthy"

    @test("POST /auth/v1/signup (get test JWT)")
    def test_auth():
        global JWT_TOKEN
        if JWT_TOKEN and JWT_TOKEN != "your-anon-key-here":
            _state["token"] = JWT_TOKEN
            return True, "using pre-supplied token"
        if SUPABASE_ANON_KEY == "your-anon-key-here":
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
            return False, f"Signup failed: {resp.status_code} - {resp.text[:200]}"

    @test("GET /profile")
    def test_profile():
        token = _state.get("token")
        resp = httpx.get(f"{BASE_URL}/profile", headers=headers(token), timeout=HTTP_TIMEOUT)
        if resp.status_code in (200, 404):
            return True, f"status {resp.status_code}"
        else:
            return False, f"Expected 200 or 404, got {resp.status_code}: {resp.text[:200]}"

    @test("PATCH /profile (fill in profile)")
    def test_profile_update():
        token = _state.get("token")
        resp = httpx.patch(
            f"{BASE_URL}/profile", headers=headers(token),
            json={"name": "Test User", "age": 17, "country": "Jamaica", "education_level": "High School", "interests": ["coding", "web development", "AI"]},
            timeout=HTTP_TIMEOUT,
        )
        if resp.status_code == 200:
            return True, f"career_path={resp.json().get('career_path')}"
        return False, f"Expected 200, got {resp.status_code}: {resp.text[:200]}"

    @test("PATCH /profile/career-path")
    def test_career_path():
        token = _state.get("token")
        resp = httpx.patch(
            f"{BASE_URL}/profile/career-path", headers=headers(token),
            json={"career_path": "Software Development"}, timeout=HTTP_TIMEOUT,
        )
        if resp.status_code == 200:
            return True, f"career_path={resp.json().get('career_path')}"
        return False, f"Expected 200, got {resp.status_code}: {resp.text[:200]}"

    @test("POST /roadmap/generate (career architect)")
    def test_roadmap_generate():
        token = _state.get("token")
        resp = httpx.post(f"{BASE_URL}/roadmap/generate", headers=headers(token), timeout=60)
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
        return False, f"Expected 201, got {resp.status_code}: {resp.text[:300]}"

    @test("GET /roadmap")
    def test_roadmap_get():
        token = _state.get("token")
        resp = httpx.get(f"{BASE_URL}/roadmap", headers=headers(token), timeout=HTTP_TIMEOUT)
        if resp.status_code == 200:
            data = resp.json()
            steps = data.get("steps", [])
            return True, f"{len(steps)} steps"
        return False, f"Expected 200, got {resp.status_code}: {resp.text[:200]}"

    @test("POST /roadmap/regenerate")
    def test_roadmap_regenerate():
        token = _state.get("token")
        resp = httpx.post(f"{BASE_URL}/roadmap/regenerate", headers=headers(token), timeout=60)
        if resp.status_code == 201:
            data = resp.json()
            old_id = _state.get("roadmap_id")
            new_id = data.get("roadmap_id")
            _state["roadmap_id"] = new_id
            return True, f"new roadmap_id={new_id[:8]}... (changed: {new_id != old_id})"
        return False, f"Expected 201, got {resp.status_code}: {resp.text[:200]}"

    @test("POST /tasks/{task_id}/evidence")
    def test_evidence_upload():
        token = _state.get("token")
        task_id = _state.get("task_id")
        if not task_id:
            return False, "No task_id available"
        import base64
        png_b64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=="
        file_bytes = base64.b64decode(png_b64)
        resp = httpx.post(
            f"{BASE_URL}/tasks/{task_id}/evidence",
            headers={"Authorization": f"Bearer {token}"},
            files={"file": ("test.png", file_bytes, "image/png")},
            data={"file_type": "image/png"}, timeout=30,
        )
        if resp.status_code == 201:
            data = resp.json()
            _state["evidence_id"] = data.get("id")
            return True, f"evidence_id={data.get('id', '?')[:8]}... status={data.get('verification_status')}"
        return False, f"Expected 201, got {resp.status_code}: {resp.text[:300]}"

    @test("GET /portfolio")
    def test_portfolio():
        token = _state.get("token")
        resp = httpx.get(f"{BASE_URL}/portfolio", headers=headers(token), timeout=HTTP_TIMEOUT)
        if resp.status_code == 200:
            data = resp.json()
            return True, f"{len(data)} task(s) with evidence"
        return False, f"Expected 200, got {resp.status_code}: {resp.text[:200]}"

    @test("GET /opportunities")
    def test_opportunities():
        token = _state.get("token")
        resp = httpx.get(f"{BASE_URL}/opportunities", headers=headers(token), timeout=LLM_TIMEOUT)
        if resp.status_code == 200:
            data = resp.json()
            cats = set(o.get("category", "unknown") for o in data)
            return True, f"{len(data)} opportunities, categories: {', '.join(cats)}"
        return False, f"Expected 200, got {resp.status_code}: {resp.text[:200]}"

    @test("GET /opportunities?category=competition")
    def test_opportunities_filtered():
        token = _state.get("token")
        resp = httpx.get(f"{BASE_URL}/opportunities?category=competition", headers=headers(token), timeout=LLM_TIMEOUT)
        if resp.status_code == 200:
            data = resp.json()
            all_comp = all(o.get("category") == "competition" for o in data)
            return True, f"{len(data)} competitions, all category=competition: {all_comp}"
        return False, f"Expected 200, got {resp.status_code}: {resp.text[:200]}"

    @test("POST /chat/message")
    def test_chat_message():
        token = _state.get("token")
        resp = httpx.post(
            f"{BASE_URL}/chat/message", headers=headers(token),
            json={"message": "Hi! What is Lynks?"}, timeout=LLM_TIMEOUT,
        )
        if resp.status_code == 200:
            data = resp.json()
            _state["conversation_id"] = data.get("conversation_id")
            return True, f"conversation={_state['conversation_id'][:8]}..."
        return False, f"Expected 200, got {resp.status_code}: {resp.text[:300]}"

    @test("POST /chat/message (mentor calls Job Scout)")
    def test_chat_agent_call():
        token = _state.get("token")
        cid = _state.get("conversation_id")
        resp = httpx.post(
            f"{BASE_URL}/chat/message", headers=headers(token),
            json={"message": "Are there any competitions I can join?", "conversation_id": cid},
            timeout=LLM_TIMEOUT,
        )
        if resp.status_code == 200:
            data = resp.json()
            tool_calls = data.get("tool_calls")
            response_text = data.get("response", "")[:100]
            return True, f"agent called: {'yes' if tool_calls else 'no'}, response: {response_text}..."
        return False, f"Expected 200, got {resp.status_code}: {resp.text[:300]}"

    @test("GET /chat/history")
    def test_chat_history():
        token = _state.get("token")
        cid = _state.get("conversation_id")
        resp = httpx.get(
            f"{BASE_URL}/chat/history?conversation_id={cid}",
            headers=headers(token), timeout=HTTP_TIMEOUT,
        )
        if resp.status_code == 200:
            data = resp.json()
            messages = data.get("messages", [])
            return True, f"{len(messages)} messages"
        return False, f"Expected 200, got {resp.status_code}: {resp.text[:200]}"

    @test("DELETE /chat/history")
    def test_chat_delete():
        token = _state.get("token")
        resp = httpx.delete(f"{BASE_URL}/chat/history", headers=headers(token), timeout=HTTP_TIMEOUT)
        if resp.status_code == 200:
            data = resp.json()
            return True, f"success={data.get('success')}"
        return False, f"Expected 200, got {resp.status_code}: {resp.text[:200]}"

    @test("GET /nonexistent (404)")
    def test_404():
        resp = httpx.get(f"{BASE_URL}/nonexistent", timeout=HTTP_TIMEOUT)
        if resp.status_code == 404:
            return True, "404 returned correctly"
        return False, f"Expected 404, got {resp.status_code}"

    @test("GET /roadmap without auth (401/403)")
    def test_unauthorized():
        resp = httpx.get(f"{BASE_URL}/roadmap", timeout=HTTP_TIMEOUT)
        if resp.status_code in (401, 403):
            return True, f"{resp.status_code} returned correctly"
        return False, f"Expected 401/403, got {resp.status_code}"

    @test("GET /opportunities?category=invalid (400)")
    def test_invalid_category():
        token = _state.get("token")
        resp = httpx.get(f"{BASE_URL}/opportunities?category=invalid", headers=headers(token), timeout=HTTP_TIMEOUT)
        if resp.status_code == 400:
            return True, "400 returned correctly"
        return False, f"Expected 400, got {resp.status_code}"

    test_functions = [v for v in list(locals().values()) if callable(v) and hasattr(v, "_test_name")]
    for test_fn in test_functions:
        test_fn()

    passed = sum(1 for r in results if r.passed)
    failed = sum(1 for r in results if not r.passed)
    total = len(results)

    print(f"\n{Colors.BOLD}{'=' * 60}")
    print(f"  RESULTS: {Colors.GREEN}{passed} passed{Colors.END}, {Colors.RED}{failed} failed{Colors.END} / {total} total")
    print(f"{'=' * 60}{Colors.END}\n")

    if failed > 0:
        print(f"{Colors.RED}Failed tests:{Colors.END}")
        for r in results:
            if not r.passed:
                print(f"  X {r.name}")
                print(f"    Status: {r.status_code} | Error: {r.message}")
        print()

    return failed == 0


if __name__ == "__main__":
    success = run_tests()
    sys.exit(0 if success else 1)
