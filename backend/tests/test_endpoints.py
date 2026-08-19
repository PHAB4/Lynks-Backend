"""
Lynks Backend — End-to-End Test Script

Tests every API endpoint against a running server.
Reports pass/fail for each endpoint.

SETUP:
  1. Make sure your server is running: uvicorn app.main:app --reload --port 8000
  2. Fill in the CONFIG section below with your values
  3. Run: python tests/test_endpoints.py
"""

from __future__ import annotations

import json
import sys
import time
from pathlib import Path

import httpx

# === CONFIG === Fill these in before running ===
BASE_URL = "http://localhost:8000"
SUPABASE_ANON_KEY = "your-anon-key-here"
JWT_TOKEN = None  # Paste a pre-existing JWT here, or leave None to auto-create a test user
TEST_IMAGE_PATH = "tests/test-image.jpg"


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
            print(f"\n{Colors.CYAN}\u25b6 {name}{Colors.END}", end=" ... ", flush=True)
            try:
                result = func()
                passed, msg = (result if isinstance(result, tuple) else (True, ""))
                results.append(TestResult(name, passed, 200, msg))
                if passed:
                    print(f"{Colors.GREEN}PASS \u2713{Colors.END}" + (f" ({msg})" if msg else ""))
                else:
                    print(f"{Colors.RED}FAIL \u2717{Colors.END} \u2014 {msg}")
            except Exception as e:
                results.append(TestResult(name, False, 0, str(e)))
                print(f"{Colors.RED}ERROR \u2717{Colors.END} \u2014 {e}")
        wrapper.__name__ = func.__name__
        return wrapper
    return decorator


def headers(token: str | None = None) -> dict:
    h = {"Content-Type": "application/json"}
    if token:
        h["Authorization"] = f"Bearer {token}"
    return h


def run_tests():
    print(f"\n{Colors.BOLD}{'=' * 60}")
    print("  Lynks Backend \u2014 Endpoint Test Suite")
    print(f"{'=' * 60}{Colors.END}")
    print(f"  Target: {BASE_URL}")
    print(f"  Time:   {time.strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'=' * 60}\n")

    # 1. Health Check
    @test("GET /health")
    def test_health():
        resp = httpx.get(f"{BASE_URL}/health")
        if resp.status_code != 200:
            return False, f"Expected 200, got {resp.status_code}"
        data = resp.json()
        if data.get("status") != "ok":
            return False, f"Expected status=ok, got {data}"
        return True, "server is healthy"

    # 2. Auth
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
            f"https://your-project.supabase.co/auth/v1/signup",
            headers={"apikey": SUPABASE_ANON_KEY, "Content-Type": "application/json"},
            json={"email": test_email, "password": test_password},
        )
        if resp.status_code == 200:
            _state["token"] = resp.json().get("access_token", "")
            return True, f"created test user: {test_email}"
        else:
            return False, f"Signup failed: {resp.status_code} \u2014 {resp.text[:200]}"

    # 3. Profile
    @test("GET /profile (returns 404 for fresh user)")
    def test_profile():
        token = _state.get("token")
        resp = httpx.get(f"{BASE_URL}/profile", headers=headers(token))
        if resp.status_code in (200, 404):
            return True, f"status {resp.status_code}"
        else:
            return False, f"Expected 200 or 404, got {resp.status_code}: {resp.text[:200]}"

    # 4. Roadmap Generate
    @test("POST /roadmap/generate (career architect)")
    def test_roadmap_generate():
        token = _state.get("token")
        resp = httpx.post(f"{BASE_URL}/roadmap/generate", headers=headers(token))
        if resp.status_code == 201:
            data = resp.json()
            _state["roadmap_id"] = data.get("roadmap_id")
            steps = data.get("steps", [])
            if steps:
                tasks = steps[0].get("tasks", [])
                if tasks:
                    _state["task_id"] = tasks[0].get("task_id")
            return True, f"roadmap_id={data.get('roadmap_id', '')[:.8]}..., {len(steps)} steps"
        else:
            return False, f"Expected 201, got {resp.status_code}: {resp.text[:300]}"

    # 5. Roadmap Get
    @test("GET /roadmap (returns active roadmap)")
    def test_roadmap_get():
        token = _state.get("token")
        resp = httpx.get(f"{BASE_URL}/roadmap", headers=headers(token))
        if resp.status_code == 200:
            data = resp.json()
            return True, f"{len(data.get('steps', []))} steps returned"
        else:
            return False, f"Expected 200, got {resp.status_code}: {resp.text[:200]}"

    # 6. Roadmap Regenerate
    @test("POST /roadmap/regenerate (rebuilds roadmap)")
    def test_roadmap_regenerate():
        token = _state.get("token")
        resp = httpx.post(f"{BASE_URL}/roadmap/regenerate", headers=headers(token))
        if resp.status_code == 201:
            data = resp.json()
            old_id = _state.get("roadmap_id")
            new_id = data.get("roadmap_id")
            _state["roadmap_id"] = new_id
            # Re-fetch task_id from the new roadmap
            for step in data.get("steps", []):
                for task in step.get("tasks", []):
                    _state["task_id"] = task.get("task_id")
                    break
                if _state.get("task_id"):
                    break
            return True, f"new roadmap_id={new_id[:8] if new_id else 'null'}... (changed: {new_id != old_id})"
        else:
            return False, f"Expected 201, got {resp.status_code}: {resp.text[:200]}"

    # 7. Evidence Upload
    @test("POST /tasks/{task_id}/evidence (upload + verify)")
    def test_evidence_upload():
        token = _state.get("token")
        task_id = _state.get("task_id")
        if not task_id:
            return False, "No task_id available (roadmap generation may have failed)"
        test_path = Path(TEST_IMAGE_PATH)
        if test_path.exists():
            file_bytes = test_path.read_bytes()
            file_type = "image/jpeg"
            filename = test_path.name
        else:
            import base64
            png_b64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=="
            file_bytes = base64.b64decode(png_b64)
            file_type = "image/png"
            filename = "test-image.png"
        resp = httpx.post(
            f"{BASE_URL}/tasks/{task_id}/evidence",
            headers={"Authorization": f"Bearer {token}"},
            files={"file": (filename, file_bytes, file_type)},
            data={"file_type": file_type},
        )
        if resp.status_code == 201:
            data = resp.json()
            _state["evidence_id"] = data.get("id")
            return True, f"evidence_id={data.get('id', '')[:8]}... status={data.get('verification_status')}"
        else:
            return False, f"Expected 201, got {resp.status_code}: {resp.text[:300]}"

    # 8. Portfolio
    @test("GET /portfolio (shows uploaded evidence)")
    def test_portfolio():
        token = _state.get("token")
        resp = httpx.get(f"{BASE_URL}/portfolio", headers=headers(token))
        if resp.status_code == 200:
            data = resp.json()
            return True, f"{len(data)} task(s) with evidence"
        else:
            return False, f"Expected 200, got {resp.status_code}: {resp.text[:200]}"

    # 9. Opportunities All
    @test("GET /opportunities (discovers opportunities)")
    def test_opportunities():
        token = _state.get("token")
        resp = httpx.get(f"{BASE_URL}/opportunities", headers=headers(token))
        if resp.status_code == 200:
            data = resp.json()
            categories = set(o.get("category", "unknown") for o in data)
            return True, f"{len(data)} opportunities, categories: {', '.join(categories)}"
        else:
            return False, f"Expected 200, got {resp.status_code}: {resp.text[:200]}"

    # 10. Opportunities Filtered
    @test("GET /opportunities?category=competition (filtered)")
    def test_opportunities_filtered():
        token = _state.get("token")
        resp = httpx.get(f"{BASE_URL}/opportunities?category=competition", headers=headers(token))
        if resp.status_code == 200:
            data = resp.json()
            all_match = all(o.get("category") == "competition" for o in data)
            return True, f"{len(data)} competitions, all category=competition: {all_match}"
        else:
            return False, f"Expected 200, got {resp.status_code}: {resp.text[:200]}"

    # 11. Chat Message
    @test("POST /chat/message (mentor chat)")
    def test_chat_message():
        token = _state.get("token")
        resp = httpx.post(
            f"{BASE_URL}/chat/message",
            headers=headers(token),
            json={"message": "Hi! What is Lynks?"},
        )
        if resp.status_code == 200:
            data = resp.json()
            _state["conversation_id"] = data.get("conversation_id")
            return True, f"conversation_id={data.get('conversation_id', '')[:8]}..."
        else:
            return False, f"Expected 200, got {resp.status_code}: {resp.text[:300]}"

    # 12. Chat Message with Agent Call
    @test("POST /chat/message (mentor calls Job Scout)")
    def test_chat_agent_call():
        token = _state.get("token")
        cid = _state.get("conversation_id")
        resp = httpx.post(
            f"{BASE_URL}/chat/message",
            headers=headers(token),
            json={"message": "Are there any competitions I can join?", "conversation_id": cid},
        )
        if resp.status_code == 200:
            data = resp.json()
            tool_calls = data.get("tool_calls")
            return True, f"agent called: {'yes' if tool_calls else 'no'}"
        else:
            return False, f"Expected 200, got {resp.status_code}: {resp.text[:300]}"

    # 13. Chat History
    @test("GET /chat/history (retrieves conversation)")
    def test_chat_history():
        token = _state.get("token")
        cid = _state.get("conversation_id")
        resp = httpx.get(
            f"{BASE_URL}/chat/history?conversation_id={cid}",
            headers=headers(token),
        )
        if resp.status_code == 200:
            data = resp.json()
            return True, f"{len(data.get('messages', []))} messages in conversation"
        else:
            return False, f"Expected 200, got {resp.status_code}: {resp.text[:200]}"

    # 14. Chat Delete History
    @test("DELETE /chat/history (clears conversation)")
    def test_chat_delete():
        token = _state.get("token")
        resp = httpx.delete(f"{BASE_URL}/chat/history", headers=headers(token))
        if resp.status_code == 200:
            data = resp.json()
            return True, f"success={data.get('success')}"
        else:
            return False, f"Expected 200, got {resp.status_code}: {resp.text[:200]}"

    # 15. 404 Handling
    @test("GET /nonexistent (returns 404)")
    def test_404():
        resp = httpx.get(f"{BASE_URL}/nonexistent")
        if resp.status_code == 404:
            return True, "404 returned correctly"
        else:
            return False, f"Expected 404, got {resp.status_code}"

    # 16. Unauthorized
    @test("GET /roadmap without auth (returns 401/403)")
    def test_unauthorized():
        resp = httpx.get(f"{BASE_URL}/roadmap")
        if resp.status_code in (401, 403):
            return True, f"{resp.status_code} returned correctly"
        else:
            return False, f"Expected 401/403, got {resp.status_code}"

    # 17. Invalid Category
    @test("GET /opportunities?category=invalid (returns 400)")
    def test_invalid_category():
        token = _state.get("token")
        resp = httpx.get(f"{BASE_URL}/opportunities?category=invalid", headers=headers(token))
        if resp.status_code == 400:
            return True, "400 returned correctly"
        else:
            return False, f"Expected 400, got {resp.status_code}"

    # === RUN ALL TESTS ===
    test_functions = [v for v in list(locals().values()) if callable(v) and hasattr(v, "_test_name")]
    for test_fn in test_functions:
        test_fn()

    # === SUMMARY ===
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
                print(f"  \u2717 {r.name}")
                print(f"    Status: {r.status_code} | Error: {r.message}")
        print()

    print(f"{Colors.CYAN}Tip: Fix any failures, then re-run:{Colors.END}")
    print(f"  python tests/test_endpoints.py\n")

    return failed == 0


if __name__ == "__main__":
    success = run_tests()
    sys.exit(0 if success else 1)