"""
Lynks Backend - End-to-End Test Script

Tests every API endpoint against a running server.

SETUP:
  1. Make sure your server is running: uvicorn app.main:app --reload --port 8000
  2. Make sure your .env has all required variables
  3. Run: python tests/test_endpoints.py
"""

from __future__ import annotations

import os
import sys
import time
from pathlib import Path

import httpx
from dotenv import load_dotenv

load_dotenv()

BASE_URL = os.getenv("BACKEND_URL", "http://localhost:8000")
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "")


class Colors:
    GREEN = "\033[92m"
    RED = "\033[91m"
    YELLOW = "\033[93m"
    CYAN = "\033[96m"
    BOLD = "\033[1m"
    END = "\033[0m"


class TestResult:
    def __init__(self, name: str, passed: bool, status_code: int = 0, message: str = ""):
        self.name = name
        self.passed = passed
        self.status_code = status_code
        self.message = message


results: list[TestResult] = []
_state: dict = {}


def test(name: str):
    def decorator(func):
        def wrapper():
            print(f"\n{Colors.CYAN}>> {name}{Colors.END}", end=" ... ", flush=True)
            try:
                result = func()
                if result and isinstance(result, tuple):
                    passed, msg = result
                else:
                    passed, msg = True, ""
                results.append(TestResult(name, passed, 200, msg))
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


def h(token: str | None = None) -> dict:
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return headers


def create_test_user() -> tuple[str, str]:
    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        print(f"\n{Colors.YELLOW}Missing SUPABASE_URL or SUPABASE_ANON_KEY in .env{Colors.END}")
        return "", ""
    test_email = f"test_{int(time.time())}@lynks-test.com"
    test_password = "TestPassword123!"
    resp = httpx.post(
        f"{SUPABASE_URL}/auth/v1/signup",
        headers={"apikey": SUPABASE_ANON_KEY, "Content-Type": "application/json"},
        json={"email": test_email, "password": test_password},
        timeout=15,
    )
    if resp.status_code != 200:
        print(f"\n{Colors.RED}Signup failed: {resp.status_code} - {resp.text[:200]}{Colors.END}")
        return "", ""
    data = resp.json()
    return data.get("access_token", ""), data.get("user", {}).get("id", "")


def run_tests():
    print(f"\n{Colors.BOLD}{'=' * 60}")
    print("  Lynks Backend - Endpoint Test Suite")
    print(f"{'=' * 60}{Colors.END}")
    print(f"  Target: {BASE_URL}")
    print(f"  Supabase: {SUPABASE_URL[:40]}..." if SUPABASE_URL else "  Supabase: NOT SET")
    print(f"  Time:   {time.strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'=' * 60}\n")

    @test("GET /health")
    def test_health():
        resp = httpx.get(f"{BASE_URL}/health", timeout=10)
        if resp.status_code == 200 and resp.json().get("status") == "ok":
            return True, "server is healthy"
        return False, f"status={resp.status_code}, body={resp.text[:100]}"

    @test("Create test user via Supabase Auth")
    def test_create_user():
        token, user_id = create_test_user()
        if not token:
            return False, "signup failed - check .env"
        _state["token"] = token
        _state["user_id"] = user_id
        return True, f"user_id={user_id[:8]}..."

    @test("GET /profile")
    def test_profile_get():
        token = _state.get("token")
        if not token:
            return False, "no token"
        resp = httpx.get(f"{BASE_URL}/profile", headers=h(token), timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            return True, f"email={data.get('email', 'unknown')}"
        return False, f"status={resp.status_code}: {resp.text[:200]}"

    @test("PATCH /profile (fill in profile)")
    def test_profile_update():
        token = _state.get("token")
        if not token:
            return False, "no token"
        resp = httpx.patch(
            f"{BASE_URL}/profile", headers=h(token),
            json={"name": "Test User", "age": 17, "country": "Jamaica",
                  "education_level": "High School", "interests": ["coding", "web development", "AI"]},
            timeout=10,
        )
        if resp.status_code == 200:
            return True, f"career_path={resp.json().get('career_path')}"
        return False, f"status={resp.status_code}: {resp.text[:200]}"

    @test("PATCH /profile/career-path")
    def test_career_path():
        token = _state.get("token")
        if not token:
            return False, "no token"
        resp = httpx.patch(
            f"{BASE_URL}/profile/career-path", headers=h(token),
            json={"career_path": "Software Development"}, timeout=10,
        )
        if resp.status_code == 200:
            return True, f"career_path={resp.json().get('career_path')}"
        return False, f"status={resp.status_code}: {resp.text[:200]}"

    @test("POST /roadmap/generate")
    def test_roadmap_generate():
        token = _state.get("token")
        if not token:
            return False, "no token"
        resp = httpx.post(f"{BASE_URL}/roadmap/generate", headers=h(token), timeout=60)
        if resp.status_code == 201:
            data = resp.json()
            _state["roadmap_id"] = data.get("roadmap_id", "")
            steps = data.get("steps", [])
            if steps:
                _state["step_id"] = steps[0].get("step_id")
                tasks = steps[0].get("tasks", [])
                if tasks:
                    _state["task_id"] = tasks[0].get("task_id")
            return True, f"roadmap={data.get('roadmap_id', '')[:8]}..., {len(steps)} steps"
        return False, f"status={resp.status_code}: {resp.text[:300]}"

    @test("GET /roadmap")
    def test_roadmap_get():
        token = _state.get("token")
        if not token:
            return False, "no token"
        resp = httpx.get(f"{BASE_URL}/roadmap", headers=h(token), timeout=10)
        if resp.status_code == 200:
            return True, f"{len(resp.json().get('steps', []))} steps"
        return False, f"status={resp.status_code}: {resp.text[:200]}"

    @test("POST /roadmap/regenerate")
    def test_roadmap_regenerate():
        token = _state.get("token")
        if not token:
            return False, "no token"
        resp = httpx.post(f"{BASE_URL}/roadmap/regenerate", headers=h(token), timeout=60)
        if resp.status_code == 201:
            data = resp.json()
            old_id = _state.get("roadmap_id", "")
            new_id = data.get("roadmap_id", "")
            _state["roadmap_id"] = new_id
            return True, f"new roadmap={new_id[:8]}... (changed: {new_id != old_id})"
        return False, f"status={resp.status_code}: {resp.text[:200]}"

    @test("POST /tasks/{task_id}/evidence")
    def test_evidence_upload():
        token = _state.get("token")
        task_id = _state.get("task_id")
        if not token:
            return False, "no token"
        if not task_id:
            return False, "no task_id (roadmap may have failed)"
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
            return True, f"evidence_id={data.get('id', '?')[:8]}..., status={data.get('verification_status')}"
        return False, f"status={resp.status_code}: {resp.text[:300]}"

    @test("GET /portfolio")
    def test_portfolio():
        token = _state.get("token")
        if not token:
            return False, "no token"
        resp = httpx.get(f"{BASE_URL}/portfolio", headers=h(token), timeout=10)
        if resp.status_code == 200:
            return True, f"{len(resp.json())} task(s) with evidence"
        return False, f"status={resp.status_code}: {resp.text[:200]}"

    @test("GET /opportunities")
    def test_opportunities():
        token = _state.get("token")
        if not token:
            return False, "no token"
        resp = httpx.get(f"{BASE_URL}/opportunities", headers=h(token), timeout=30)
        if resp.status_code == 200:
            data = resp.json()
            cats = set(o.get("category", "?") for o in data)
            return True, f"{len(data)} opportunities, categories: {', '.join(cats)}"
        return False, f"status={resp.status_code}: {resp.text[:200]}"

    @test("GET /opportunities?category=competition")
    def test_opportunities_filtered():
        token = _state.get("token")
        if not token:
            return False, "no token"
        resp = httpx.get(f"{BASE_URL}/opportunities?category=competition", headers=h(token), timeout=30)
        if resp.status_code == 200:
            data = resp.json()
            return True, f"{len(data)} competitions"
        return False, f"status={resp.status_code}: {resp.text[:200]}"

    @test("POST /chat/message")
    def test_chat_message():
        token = _state.get("token")
        if not token:
            return False, "no token"
        resp = httpx.post(
            f"{BASE_URL}/chat/message", headers=h(token),
            json={"message": "Hi! What is Lynks?"}, timeout=60,
        )
        if resp.status_code == 200:
            data = resp.json()
            _state["conversation_id"] = data.get("conversation_id")
            return True, f"conversation={_state.get('conversation_id', '?')[:8]}..."
        return False, f"status={resp.status_code}: {resp.text[:300]}"

    @test("GET /chat/history")
    def test_chat_history():
        token = _state.get("token")
        conv_id = _state.get("conversation_id")
        if not token:
            return False, "no token"
        if not conv_id:
            return False, "no conversation_id"
        resp = httpx.get(f"{BASE_URL}/chat/history?conversation_id={conv_id}", headers=h(token), timeout=10)
        if resp.status_code == 200:
            return True, f"{len(resp.json().get('messages', []))} messages"
        return False, f"status={resp.status_code}: {resp.text[:200]}"

    @test("DELETE /chat/history")
    def test_chat_delete():
        token = _state.get("token")
        if not token:
            return False, "no token"
        resp = httpx.delete(f"{BASE_URL}/chat/history", headers=h(token), timeout=10)
        if resp.status_code == 200:
            return True, f"success={resp.json().get('success')}"
        return False, f"status={resp.status_code}: {resp.text[:200]}"

    @test("GET /nonexistent (404)")
    def test_404():
        resp = httpx.get(f"{BASE_URL}/nonexistent", timeout=5)
        if resp.status_code == 404:
            return True, "404 returned correctly"
        return False, f"Expected 404, got {resp.status_code}"

    @test("GET /roadmap without auth (401/403)")
    def test_unauthorized():
        resp = httpx.get(f"{BASE_URL}/roadmap", timeout=5)
        if resp.status_code in (401, 403):
            return True, f"{resp.status_code} returned correctly"
        return False, f"Expected 401/403, got {resp.status_code}"

    @test("GET /opportunities?category=invalid (400)")
    def test_invalid_category():
        token = _state.get("token")
        if not token:
            return False, "no token"
        resp = httpx.get(f"{BASE_URL}/opportunities?category=invalid", headers=h(token), timeout=10)
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

    if passed == total:
        print(f"{Colors.GREEN}ALL TESTS PASSED!{Colors.END}\n")

    print(f"Re-run: python tests/test_endpoints.py\n")
    return failed == 0


if __name__ == "__main__":
    success = run_tests()
    sys.exit(0 if success else 1)
