"""Lynks Backend — End-to-End Test Script.

Run: python tests/test_endpoints.py

SETUP:
  1. Server running: uvicorn app.main:app --reload --port 8000
  2. Fill CONFIG section below
  3. Run the script
"""
from __future__ import annotations
import json, sys, time
from pathlib import Path
import httpx

BASE_URL = "http://localhost:8000"
SUPABASE_ANON_KEY = "your-anon-key-here"
JWT_TOKEN = None
TEST_IMAGE_PATH = "tests/test-image.jpg"

class Colors:
    GREEN = "\033[92m"
    RED = "\033[91m"
    CYAN = "\033[96m"
    BOLD = "\033[1m"
    END = "\033[0m"

class TestResult:
    def __init__(self, name, passed, status_code=0, message=""):
        self.name = name
        self.passed = passed
        self.status_code = status_code
        self.message = message

results = []
_state = {}

def test(name):
    def decorator(func):
        def wrapper():
            print(f"\n{Colors.CYAN}▶ {name}{Colors.END}", end=" ... ", flush=True)
            try:
                result = func()
                passed, msg = (result if isinstance(result, tuple) else (True, ""))
                results.append(TestResult(name, passed, 200, msg))
                print(f"{Colors.GREEN}PASS ✓{Colors.END}" + (f" ({msg})" if msg else ""))
            except Exception as e:
                results.append(TestResult(name, False, 0, str(e)))
                print(f"{Colors.RED}ERROR ✗{Colors.END} — {e}")
        wrapper.__name__ = func.__name__
        return wrapper
    return decorator

def headers(token=None):
    h = {"Content-Type": "application/json"}
    if token:
        h["Authorization"] = f"Bearer {token}"
    return h

def run_tests():
    print(f"\n{Colors.BOLD}{'='*60}\n  Lynks Backend — Endpoint Test Suite\n{'='*60}{Colors.END}")
    print(f"  Target: {BASE_URL}\n  Time:   {time.strftime('%Y-%m-%d %H:%M:%S')}\n{'='*60}\n")

    @test("GET /health")
    def t1():
        r = httpx.get(f"{BASE_URL}/health")
        if r.status_code != 200: return False, f"got {r.status_code}"
        return True, "server is healthy"

    @test("POST /auth/v1/signup")
    def t2():
        if JWT_TOKEN and JWT_TOKEN != "your-anon-key-here":
            _state["token"] = JWT_TOKEN
            return True, "using pre-supplied token"
        if SUPABASE_ANON_KEY == "your-anon-key-here":
            r = httpx.get(f"{BASE_URL}/roadmap", headers=headers("fake"))
            return (True, "auth required") if r.status_code in (401,403) else (False, "should require auth")
        r = httpx.post(f"https://your-project.supabase.co/auth/v1/signup", headers={"apikey": SUPABASE_ANON_KEY, "Content-Type": "application/json"}, json={"email": f"test_{int(time.time())}@lynks-test.com", "password": "Test123!"})
        if r.status_code == 200:
            _state["token"] = r.json().get("access_token", "")
            return True, "created test user"
        return False, f"{r.status_code}: {r.text[:200]}"

    @test("POST /roadmap/generate")
    def t3():
        r = httpx.post(f"{BASE_URL}/roadmap/generate", headers=headers(_state.get("token")))
        if r.status_code == 201:
            d = r.json()
            _state["roadmap_id"] = d.get("roadmap_id")
            steps = d.get("steps", [])
            if steps and steps[0].get("tasks"):
                _state["task_id"] = steps[0]["tasks"][0].get("task_id")
            return True, f"{len(steps)} steps"
        return False, f"got {r.status_code}: {r.text[:200]}"

    @test("GET /roadmap")
    def t4():
        r = httpx.get(f"{BASE_URL}/roadmap", headers=headers(_state.get("token")))
        return (True, f"{len(r.json().get('steps',[]))} steps") if r.status_code == 200 else (False, f"got {r.status_code}")

    @test("POST /roadmap/regenerate")
    def t5():
        r = httpx.post(f"{BASE_URL}/roadmap/regenerate", headers=headers(_state.get("token")))
        return (True, "new roadmap created") if r.status_code == 201 else (False, f"got {r.status_code}")

    @test("POST /tasks/{task_id}/evidence")
    def t6():
        tid = _state.get("task_id")
        if not tid: return False, "no task_id"
        import base64
        png = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==")
        r = httpx.post(f"{BASE_URL}/tasks/{tid}/evidence", headers={"Authorization": f"Bearer {_state.get('token')}"}, files={"file": ("test.png", png, "image/png")}, data={"file_type": "image/png"})
        return (True, f"status={r.json().get('verification_status')}") if r.status_code == 201 else (False, f"got {r.status_code}: {r.text[:200]}")

    @test("GET /portfolio")
    def t7():
        r = httpx.get(f"{BASE_URL}/portfolio", headers=headers(_state.get("token")))
        return (True, f"{len(r.json())} tasks with evidence") if r.status_code == 200 else (False, f"got {r.status_code}")

    @test("GET /opportunities")
    def t8():
        r = httpx.get(f"{BASE_URL}/opportunities", headers=headers(_state.get("token")))
        return (True, f"{len(r.json())} opportunities") if r.status_code == 200 else (False, f"got {r.status_code}")

    @test("GET /opportunities?category=competition")
    def t9():
        r = httpx.get(f"{BASE_URL}/opportunities?category=competition", headers=headers(_state.get("token")))
        return (True, f"{len(r.json())} competitions") if r.status_code == 200 else (False, f"got {r.status_code}")

    @test("POST /chat/message")
    def t10():
        r = httpx.post(f"{BASE_URL}/chat/message", headers=headers(_state.get("token")), json={"message": "Hello, what can you help me with?"})
        if r.status_code == 200:
            d = r.json()
            _state["conversation_id"] = d.get("conversation_id")
            return True, f"response: {d.get('response', '')[:80]}..."
        return False, f"got {r.status_code}: {r.text[:200]}"

    @test("POST /chat/message (agent call)")
    def t11():
        r = httpx.post(f"{BASE_URL}/chat/message", headers=headers(_state.get("token")), json={"message": "Find me competitions", "conversation_id": _state.get("conversation_id")})
        if r.status_code == 200:
            d = r.json()
            tc = d.get("tool_calls")
            return True, f"agent called: {'yes' if tc else 'no'}"
        return False, f"got {r.status_code}: {r.text[:200]}"

    @test("GET /chat/history")
    def t12():
        r = httpx.get(f"{BASE_URL}/chat/history?conversation_id={_state.get('conversation_id','')}", headers=headers(_state.get("token")))
        return (True, f"{len(r.json().get('messages',[]))} messages") if r.status_code == 200 else (False, f"got {r.status_code}")

    @test("DELETE /chat/history")
    def t13():
        r = httpx.delete(f"{BASE_URL}/chat/history", headers=headers(_state.get("token")))
        return (True, "cleared") if r.status_code == 200 else (False, f"got {r.status_code}")

    @test("GET /nonexistent (404)")
    def t14():
        r = httpx.get(f"{BASE_URL}/nonexistent")
        return (True, "404 correct") if r.status_code == 404 else (False, f"got {r.status_code}")

    @test("GET /roadmap without auth (401/403)")
    def t15():
        r = httpx.get(f"{BASE_URL}/roadmap")
        return (True, f"{r.status_code} correct") if r.status_code in (401,403) else (False, f"got {r.status_code}")

    @test("GET /opportunities?category=invalid (400)")
    def t16():
        r = httpx.get(f"{BASE_URL}/opportunities?category=invalid", headers=headers(_state.get("token")))
        return (True, "400 correct") if r.status_code == 400 else (False, f"got {r.status_code}")

    for fn in [v for v in locals().values() if callable(v) and hasattr(v, "__name__") and v.__name__.startswith("t")]:
        fn()

    passed = sum(1 for r in results if r.passed)
    failed = sum(1 for r in results if not r.passed)
    print(f"\n{Colors.BOLD}{'='*60}\n  RESULTS: {Colors.GREEN}{passed} passed{Colors.END}, {Colors.RED}{failed} failed{Colors.END} / {len(results)} total\n{'='*60}{Colors.END}")
    if failed > 0:
        print(f"{Colors.RED}Failed:{Colors.END}")
        for r in results:
            if not r.passed: print(f"  ✗ {r.name}: {r.message}")
    return failed == 0

if __name__ == "__main__":
    sys.exit(0 if run_tests() else 1)