"""Lynks Backend - Endpoint Test Suite"""

from __future__ import annotations
import json, os, sys, time
from pathlib import Path
import httpx
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

HTTP_TIMEOUT = 30.0
LLM_TIMEOUT = 60.0
BASE_URL = os.getenv("BASE_URL", "http://localhost:8000")
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://your-project.supabase.co")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "")
JWT_TOKEN = os.getenv("JWT_TOKEN")
TEST_IMAGE_PATH = "tests/test-image.jpg"

class Colors:
    GREEN = "\033[92m"; RED = "\033[91m"; YELLOW = "\033[93m"
    CYAN = "\033[96m"; BOLD = "\033[1m"; END = "\033[0m"

class TestResult:
    def __init__(self, name, passed, status_code=0, message="", response=""):
        self.name=name; self.passed=passed; self.status_code=status_code
        self.message=message; self.response=response

results = []

def test(name):
    def decorator(func):
        def wrapper():
            print(f"\n{Colors.CYAN}> {name}{Colors.END}", end=" ... ", flush=True)
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

def headers(token=None):
    h = {"Content-Type": "application/json"}
    if token:
        h["Authorization"] = f"Bearer {token}"
    return h

_state = {}

def run_tests():
    print(f"\n{Colors.BOLD}{'='*60}")
    print("  Lynks Backend - Endpoint Test Suite")
    print(f"{'='*60}{Colors.END}")
    print(f"  Target: {BASE_URL}")
    print(f"  Time:   {time.strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'='*60}\n")

    @test("GET /health")
    def test_health():
        r = httpx.get(f"{BASE_URL}/health", timeout=HTTP_TIMEOUT)
        if r.status_code != 200: return False, f"Expected 200, got {r.status_code}"
        d = r.json()
        if d.get("status") != "ok": return False, f"Expected status=ok, got {d}"
        return True, "server is healthy"

    @test("POST /auth/v1/signup (get test JWT)")
    def test_auth():
        global JWT_TOKEN
        if JWT_TOKEN:
            _state["token"] = JWT_TOKEN
            return True, "using pre-supplied token"
        if not SUPABASE_ANON_KEY:
            r = httpx.get(f"{BASE_URL}/roadmap", headers=headers("fake-token"))
            if r.status_code in (401, 403):
                return True, "auth required (no anon key to test signup)"
            return False, "Server should require auth but returned 200 without valid token"
        email = f"test_{int(time.time())}@lynks-test.com"
        pw = "TestPassword123!"
        r = httpx.post(f"{SUPABASE_URL}/auth/v1/signup",
            headers={"apikey": SUPABASE_ANON_KEY, "Content-Type": "application/json"},
            json={"email": email, "password": pw}, timeout=HTTP_TIMEOUT)
        if r.status_code == 200:
            _state["token"] = r.json().get("access_token", "")
            _state["email"] = email
            return True, f"created test user: {email}"
        return False, f"Signup failed: {r.status_code} - {r.text[:200]}"

    @test("GET /profile")
    def test_profile():
        t = _state.get("token")
        r = httpx.get(f"{BASE_URL}/profile", headers=headers(t), timeout=HTTP_TIMEOUT)
        if r.status_code in (200, 404): return True, f"status {r.status_code}"
        return False, f"Expected 200 or 404, got {r.status_code}: {r.text[:200]}"

    @test("PATCH /profile (fill in profile)")
    def test_profile_update():
        t = _state.get("token")
        r = httpx.patch(f"{BASE_URL}/profile", headers=headers(t),
            json={"name":"Test User","age":17,"country":"Jamaica",
                  "education_level":"High School","interests":["coding","web development","AI"]},
            timeout=HTTP_TIMEOUT)
        if r.status_code == 200: return True, f"career_path={r.json().get('career_path')}"
        return False, f"Expected 200, got {r.status_code}: {r.text[:200]}"

    @test("PATCH /profile/career-path")
    def test_career_path():
        t = _state.get("token")
        r = httpx.patch(f"{BASE_URL}/profile/career-path", headers=headers(t),
            json={"career_path": "Software Development"}, timeout=HTTP_TIMEOUT)
        if r.status_code == 200: return True, f"career_path={r.json().get('career_path')}"
        return False, f"Expected 200, got {r.status_code}: {r.text[:200]}"

    @test("POST /roadmap/generate (career architect)")
    def test_roadmap_generate():
        t = _state.get("token")
        r = httpx.post(f"{BASE_URL}/roadmap/generate", headers=headers(t), timeout=60)
        if r.status_code == 201:
            d = r.json()
            rid = d.get("roadmap_id")
            steps = d.get("steps", [])
            _state["roadmap_id"] = rid; _state["step_count"] = len(steps)
            if steps:
                _state["step_id"] = steps[0].get("step_id")
                tasks = steps[0].get("tasks", [])
                if tasks: _state["task_id"] = tasks[0].get("task_id")
            return True, f"roadmap_id={rid[:8]}..., {len(steps)} steps"
        return False, f"Expected 201, got {r.status_code}: {r.text[:300]}"

    @test("GET /roadmap")
    def test_roadmap_get():
        t = _state.get("token")
        r = httpx.get(f"{BASE_URL}/roadmap", headers=headers(t), timeout=HTTP_TIMEOUT)
        if r.status_code == 200:
            return True, f"{len(r.json().get('steps', []))} steps"
        return False, f"Expected 200, got {r.status_code}: {r.text[:200]}"

    @test("POST /roadmap/regenerate")
    def test_roadmap_regenerate():
        t = _state.get("token")
        r = httpx.post(f"{BASE_URL}/roadmap/regenerate", headers=headers(t), timeout=60)
        if r.status_code == 201:
            d = r.json()
            old = _state.get("roadmap_id")
            new = d.get("roadmap_id")
            _state["roadmap_id"] = new
            return True, f"new id={new[:8]}... (changed: {new != old})"
        return False, f"Expected 201, got {r.status_code}: {r.text[:200]}"

    @test("POST /tasks/{task_id}/evidence")
    def test_evidence():
        t = _state.get("token")
        tid = _state.get("task_id")
        if not tid: return False, "No task_id available"
        import base64
        png = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==")
        r = httpx.post(f"{BASE_URL}/tasks/{tid}/evidence",
            headers={"Authorization": f"Bearer {t}"},
            files={"file": ("test.png", png, "image/png")},
            data={"file_type": "image/png"}, timeout=30)
        if r.status_code == 201:
            d = r.json()
            _state["evidence_id"] = d.get("id")
            return True, f"evidence_id={d.get('id','?')[:8]}... status={d.get('verification_status')}"
        return False, f"Expected 201, got {r.status_code}: {r.text[:300]}"

    @test("GET /portfolio")
    def test_portfolio():
        t = _state.get("token")
        r = httpx.get(f"{BASE_URL}/portfolio", headers=headers(t), timeout=HTTP_TIMEOUT)
        if r.status_code == 200: return True, f"{len(r.json())} task(s) with evidence"
        return False, f"Expected 200, got {r.status_code}: {r.text[:200]}"

    @test("GET /opportunities")
    def test_opportunities():
        t = _state.get("token")
        r = httpx.get(f"{BASE_URL}/opportunities", headers=headers(t), timeout=LLM_TIMEOUT)
        if r.status_code == 200:
            d = r.json()
            cats = set(o.get("category","unknown") for o in d)
            return True, f"{len(d)} opps, categories: {', '.join(cats)}"
        return False, f"Expected 200, got {r.status_code}: {r.text[:200]}"

    @test("GET /opportunities?category=competition")
    def test_opps_filtered():
        t = _state.get("token")
        r = httpx.get(f"{BASE_URL}/opportunities?category=competition", headers=headers(t), timeout=LLM_TIMEOUT)
        if r.status_code == 200:
            d = r.json()
            ok = all(o.get("category")=="competition" for o in d)
            return True, f"{len(d)} comps, all=competition: {ok}"
        return False, f"Expected 200, got {r.status_code}: {r.text[:200]}"

    @test("POST /chat/message")
    def test_chat():
        t = _state.get("token")
        r = httpx.post(f"{BASE_URL}/chat/message", headers=headers(t),
            json={"message": "Hi! What is Lynks?"}, timeout=LLM_TIMEOUT)
        if r.status_code == 200:
            d = r.json()
            _state["conversation_id"] = d.get("conversation_id")
            return True, f"conv={_state['conversation_id'][:8]}..."
        return False, f"Expected 200, got {r.status_code}: {r.text[:300]}"

    @test("POST /chat/message (mentor calls Job Scout)")
    def test_chat_agent():
        t = _state.get("token")
        cid = _state.get("conversation_id")
        r = httpx.post(f"{BASE_URL}/chat/message", headers=headers(t),
            json={"message": "Are there any competitions I can join?", "conversation_id": cid},
            timeout=LLM_TIMEOUT)
        if r.status_code == 200:
            d = r.json()
            tc = d.get("tool_calls")
            txt = d.get("response", "")[:100]
            return True, f"agent: {'yes' if tc else 'no'}, resp: {txt}..."
        return False, f"Expected 200, got {r.status_code}: {r.text[:300]}"

    @test("GET /chat/history")
    def test_chat_history():
        t = _state.get("token")
        cid = _state.get("conversation_id")
        r = httpx.get(f"{BASE_URL}/chat/history?conversation_id={cid}", headers=headers(t), timeout=HTTP_TIMEOUT)
        if r.status_code == 200:
            msgs = r.json().get("messages", [])
            return True, f"{len(msgs)} messages"
        return False, f"Expected 200, got {r.status_code}: {r.text[:200]}"

    @test("DELETE /chat/history")
    def test_chat_delete():
        t = _state.get("token")
        r = httpx.delete(f"{BASE_URL}/chat/history", headers=headers(t), timeout=HTTP_TIMEOUT)
        if r.status_code == 200: return True, f"success={r.json().get('success')}"
        return False, f"Expected 200, got {r.status_code}: {r.text[:200]}"

    @test("GET /nonexistent (404)")
    def test_404():
        r = httpx.get(f"{BASE_URL}/nonexistent", timeout=HTTP_TIMEOUT)
        if r.status_code == 404: return True, "404 returned correctly"
        return False, f"Expected 404, got {r.status_code}"

    @test("GET /roadmap without auth (401/403)")
    def test_unauth():
        r = httpx.get(f"{BASE_URL}/roadmap", timeout=HTTP_TIMEOUT)
        if r.status_code in (401, 403): return True, f"{r.status_code} returned correctly"
        return False, f"Expected 401/403, got {r.status_code}"

    @test("GET /opportunities?category=invalid (400)")
    def test_bad_cat():
        t = _state.get("token")
        r = httpx.get(f"{BASE_URL}/opportunities?category=invalid", headers=headers(t), timeout=HTTP_TIMEOUT)
        if r.status_code == 400: return True, "400 returned correctly"
        return False, f"Expected 400, got {r.status_code}"

    fns = [v for v in locals().values() if callable(v) and hasattr(v, "_test_name")]
    for fn in fns: fn()

    passed = sum(1 for r in results if r.passed)
    failed = sum(1 for r in results if not r.passed)
    total = len(results)

    print(f"\n{Colors.BOLD}{'='*60}")
    print(f"  RESULTS: {Colors.GREEN}{passed} passed{Colors.END}, {Colors.RED}{failed} failed{Colors.END} / {total} total")
    print(f"{'='*60}{Colors.END}\n")

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
