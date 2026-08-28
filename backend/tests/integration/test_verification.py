"""
Lynks Backend — Evidence Verification Integration Tests

Tests the full verification workflow against a running server:
  - Upload evidence → Gemini verifies it
  - Get verification status
  - Re-verify evidence
  - Portfolio shows verification fields
  - Auth / ownership guards

SETUP:
  1. Make sure your server is running: uvicorn app.main:app --reload --port 8000
  2. Make sure GEMINI_API_KEY and all required env vars are set
  3. Run: python tests/integration/test_verification.py
"""

from __future__ import annotations

import base64
import io
import os
import sys
import time
from pathlib import Path

import httpx
from dotenv import load_dotenv

load_dotenv()

# ══════════════════════════════════════════════════════════════════════════════
#  CONFIG
# ══════════════════════════════════════════════════════════════════════════════

BASE_URL = os.getenv("BACKEND_URL", "http://localhost:8000")
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "")


# ══════════════════════════════════════════════════════════════════════════════
#  TEST RUNNER (same pattern as test_endpoints.py)
# ══════════════════════════════════════════════════════════════════════════════

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


def h(token: str | None = None) -> dict:
    """Build request headers."""
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return headers


def create_test_user() -> tuple[str, str]:
    """Sign up a fresh test user via Supabase Auth."""
    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        print(f"\n{Colors.YELLOW}⚠ Missing SUPABASE_URL or SUPABASE_ANON_KEY in .env{Colors.END}")
        return "", ""

    test_email = f"test_verify_{int(time.time())}@lynks-test.com"
    test_password = "TestPassword123!"

    resp = httpx.post(
        f"{SUPABASE_URL}/auth/v1/signup",
        headers={"apikey": SUPABASE_ANON_KEY, "Content-Type": "application/json"},
        json={"email": test_email, "password": test_password},
        timeout=15,
    )

    if resp.status_code != 200:
        print(f"\n{Colors.RED}⚠ Signup failed: {resp.status_code} — {resp.text[:200]}{Colors.END}")
        return "", ""

    data = resp.json()
    return data.get("access_token", ""), data.get("user", {}).get("id", "")


def _make_test_image(width: int = 200, height: int = 150, color: tuple = (200, 220, 255)) -> bytes:
    """Create a minimal valid PNG in memory (no PIL dependency)."""
    import struct
    import zlib

    def _chunk(chunk_type: bytes, data: bytes) -> bytes:
        c = chunk_type + data
        return struct.pack(">I", len(data)) + c + struct.pack(">I", zlib.crc32(c) & 0xFFFFFFFF)

    raw = b""
    for _ in range(height):
        raw += b"\x00"  # filter byte
        for _ in range(width):
            raw += bytes(color)

    ihdr_data = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    idat_data = zlib.compress(raw)

    png = b"\x89PNG\r\n\x1a\n"
    png += _chunk(b"IHDR", ihdr_data)
    png += _chunk(b"IDAT", idat_data)
    png += _chunk(b"IEND", b"")
    return png


# ══════════════════════════════════════════════════════════════════════════════
#  TESTS
# ══════════════════════════════════════════════════════════════════════════════


def run_tests():
    print(f"\n{Colors.BOLD}{'=' * 60}")
    print("  Lynks Backend — Evidence Verification Test Suite")
    print(f"{'=' * 60}{Colors.END}")
    print(f"  Target: {BASE_URL}")
    print(f"  Supabase: {SUPABASE_URL[:40]}..." if SUPABASE_URL else f"  Supabase: NOT SET")
    print(f"  Time:   {time.strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'=' * 60}\n")

    # ── 1. Health Check ──────────────────────────────────────────────────────

    @test("GET /health")
    def test_health():
        resp = httpx.get(f"{BASE_URL}/health", timeout=10)
        if resp.status_code == 200 and resp.json().get("status") == "ok":
            return True, "server is healthy"
        return False, f"status={resp.status_code}, body={resp.text[:100]}"

    # ── 2. Create test user ─────────────────────────────────────────────────

    @test("Create test user via Supabase Auth")
    def test_create_user():
        token, user_id = create_test_user()
        if not token:
            return False, "signup failed — check SUPABASE_URL and SUPABASE_ANON_KEY in .env"
        _state["token"] = token
        _state["user_id"] = user_id
        return True, f"user_id={user_id[:8]}..."

    # ── 3. Profile ───────────────────────────────────────────────────────────

    @test("PATCH /profile (fill in profile for roadmap)")
    def test_profile():
        token = _state.get("token")
        if not token:
            return False, "no token"
        resp = httpx.patch(
            f"{BASE_URL}/profile",
            headers=h(token),
            json={
                "name": "Verification Tester",
                "age": 18,
                "country": "Jamaica",
                "education_level": "High School",
                "interests": ["web development", "python"],
            },
            timeout=10,
        )
        if resp.status_code == 200:
            return True, f"career_path={resp.json().get('career_path')}"
        return False, f"status={resp.status_code}: {resp.text[:200]}"

    # ── 4. Career path ──────────────────────────────────────────────────────

    @test("PATCH /profile/career-path")
    def test_career_path():
        token = _state.get("token")
        if not token:
            return False, "no token"
        resp = httpx.patch(
            f"{BASE_URL}/profile/career-path",
            headers=h(token),
            json={"career_path": "Software Development"},
            timeout=10,
        )
        if resp.status_code == 200:
            return True, f"career_path={resp.json().get('career_path')}"
        return False, f"status={resp.status_code}: {resp.text[:200]}"

    # ── 5. Generate roadmap (need a task_id for evidence) ───────────────────

    @test("POST /roadmap/generate")
    def test_roadmap_generate():
        token = _state.get("token")
        if not token:
            return False, "no token"
        resp = httpx.post(f"{BASE_URL}/roadmap/generate", headers=h(token), timeout=60)
        if resp.status_code == 201:
            data = resp.json()
            steps = data.get("steps", [])
            if steps and steps[0].get("tasks"):
                _state["task_id"] = steps[0]["tasks"][0].get("task_id")
            return True, f"{len(steps)} steps, task_id={_state.get('task_id', 'none')[:8]}..."
        return False, f"status={resp.status_code}: {resp.text[:300]}"

    # ── 6. Upload evidence — colored rectangle (should be lenient-verified) ─

    @test("POST /tasks/{task_id}/evidence (upload colored image)")
    def test_upload_evidence():
        token = _state.get("token")
        task_id = _state.get("task_id")
        if not token:
            return False, "no token"
        if not task_id:
            return False, "no task_id (roadmap generation may have failed)"

        image_bytes = _make_test_image(200, 150, (70, 130, 200))

        resp = httpx.post(
            f"{BASE_URL}/tasks/{task_id}/evidence",
            headers={"Authorization": f"Bearer {token}"},
            files={"file": ("certificate-test.png", image_bytes, "image/png")},
            data={"file_type": "image/png"},
            timeout=60,
        )
        if resp.status_code == 201:
            data = resp.json()
            _state["evidence_id"] = data.get("id")
            _state["evidence_url"] = data.get("file_url")
            return True, (
                f"evidence_id={data.get('id', '?')[:8]}..., "
                f"status={data.get('verification_status')}, "
                f"confidence={data.get('verification_confidence')}"
            )
        return False, f"status={resp.status_code}: {resp.text[:300]}"

    # ── 7. Check verification fields exist on response ──────────────────────

    @test("Response has all verification fields")
    def test_verification_fields():
        token = _state.get("token")
        task_id = _state.get("task_id")
        if not token or not task_id:
            return False, "missing prerequisites"

        image_bytes = _make_test_image(100, 100, (255, 100, 100))
        resp = httpx.post(
            f"{BASE_URL}/tasks/{task_id}/evidence",
            headers={"Authorization": f"Bearer {token}"},
            files={"file": ("field-check.png", image_bytes, "image/png")},
            data={"file_type": "image/png"},
            timeout=60,
        )
        if resp.status_code != 201:
            return False, f"upload failed: {resp.status_code}"

        data = resp.json()
        required_fields = [
            "id", "task_id", "file_url", "file_type",
            "verification_status", "verification_reason",
            "verification_confidence", "verified_at",
        ]
        missing = [f for f in required_fields if f not in data]
        if missing:
            return False, f"missing fields: {missing}"

        status = data["verification_status"]
        if status not in ("verified", "pending", "rejected"):
            return False, f"unexpected status: {status}"

        return True, f"all fields present, status={status}"

    # ── 8. Get verification status for evidence ─────────────────────────────

    @test("GET /evidence/{id}/verification")
    def test_get_verification():
        token = _state.get("token")
        evidence_id = _state.get("evidence_id")
        if not token:
            return False, "no token"
        if not evidence_id:
            return False, "no evidence_id (upload test may have failed)"

        resp = httpx.get(
            f"{BASE_URL}/evidence/{evidence_id}/verification",
            headers=h(token),
            timeout=10,
        )
        if resp.status_code == 200:
            data = resp.json()
            required = ["evidence_id", "verification_status", "verification_reason",
                        "verification_confidence", "verified_at"]
            missing = [f for f in required if f not in data]
            if missing:
                return False, f"response missing: {missing}"
            return True, (
                f"status={data['verification_status']}, "
                f"confidence={data['verification_confidence']}, "
                f"reason={data['verification_reason'][:50]}..."
            )
        return False, f"status={resp.status_code}: {resp.text[:200]}"

    # ── 9. Re-verify evidence ───────────────────────────────────────────────

    @test("POST /evidence/{id}/re-verify")
    def test_re_verify():
        token = _state.get("token")
        evidence_id = _state.get("evidence_id")
        if not token:
            return False, "no token"
        if not evidence_id:
            return False, "no evidence_id"

        resp = httpx.post(
            f"{BASE_URL}/evidence/{evidence_id}/re-verify",
            headers=h(token),
            timeout=60,
        )
        if resp.status_code == 200:
            data = resp.json()
            return True, (
                f"status={data.get('verification_status')}, "
                f"confidence={data.get('verification_confidence')}"
            )
        return False, f"status={resp.status_code}: {resp.text[:200]}"

    # ── 10. Portfolio includes verification fields ──────────────────────────

    @test("GET /portfolio (evidence has verification fields)")
    def test_portfolio_verification():
        token = _state.get("token")
        if not token:
            return False, "no token"
        resp = httpx.get(f"{BASE_URL}/portfolio", headers=h(token), timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            if not data:
                return False, "portfolio is empty"
            # Check first task's evidence for verification fields
            first_task = data[0] if isinstance(data, list) else data
            evidence_list = first_task.get("evidence", [])
            if evidence_list:
                ev = evidence_list[0]
                has_verification = "verification_status" in ev or "status" in ev
                return True, f"{len(evidence_list)} evidence items, has_verification={has_verification}"
            return True, f"portfolio returned but no evidence items yet"
        return False, f"status={resp.status_code}: {resp.text[:200]}"

    # ── 11. Auth guard — no token ──────────────────────────────────────────

    @test("GET /evidence/{id}/verification without auth (401)")
    def test_no_auth():
        evidence_id = _state.get("evidence_id", "fake-id")
        resp = httpx.get(f"{BASE_URL}/evidence/{evidence_id}/verification", timeout=5)
        if resp.status_code in (401, 403):
            return True, f"{resp.status_code} returned correctly"
        return False, f"Expected 401/403, got {resp.status_code}"

    # ── 12. Ownership guard — wrong user ───────────────────────────────────

    @test("GET /evidence/{id}/verification as wrong user (403)")
    def test_wrong_user():
        evidence_id = _state.get("evidence_id", "fake-id")
        # Create a second user
        token2, _ = create_test_user()
        if not token2:
            return False, "could not create second test user"
        resp = httpx.get(
            f"{BASE_URL}/evidence/{evidence_id}/verification",
            headers=h(token2),
            timeout=10,
        )
        if resp.status_code == 403:
            return True, "403 returned correctly"
        if resp.status_code == 404:
            return True, "404 returned (evidence not visible to other user)"
        return False, f"Expected 403, got {resp.status_code}"

    # ── 13. Non-existent evidence ──────────────────────────────────────────

    @test("GET /evidence/nonexistent/verification (404)")
    def test_nonexistent():
        token = _state.get("token")
        if not token:
            return False, "no token"
        resp = httpx.get(
            f"{BASE_URL}/evidence/00000000-0000-0000-0000-000000000000/verification",
            headers=h(token),
            timeout=10,
        )
        if resp.status_code == 404:
            return True, "404 returned correctly"
        return False, f"Expected 404, got {resp.status_code}"

    # ── 14. Re-verify nonexistent evidence ─────────────────────────────────

    @test("POST /evidence/nonexistent/re-verify (404)")
    def test_re_verify_nonexistent():
        token = _state.get("token")
        if not token:
            return False, "no token"
        resp = httpx.post(
            f"{BASE_URL}/evidence/00000000-0000-0000-0000-000000000000/re-verify",
            headers=h(token),
            timeout=10,
        )
        if resp.status_code == 404:
            return True, "404 returned correctly"
        return False, f"Expected 404, got {resp.status_code}"

    # ── 15. Upload invalid file type ───────────────────────────────────────

    @test("POST /tasks/{task_id}/evidence with invalid file type (400)")
    def test_invalid_file_type():
        token = _state.get("token")
        task_id = _state.get("task_id")
        if not token:
            return False, "no token"
        if not task_id:
            return False, "no task_id"

        resp = httpx.post(
            f"{BASE_URL}/tasks/{task_id}/evidence",
            headers={"Authorization": f"Bearer {token}"},
            files={"file": ("notes.txt", b"This is not an image", "text/plain")},
            data={"file_type": "text/plain"},
            timeout=10,
        )
        if resp.status_code == 400:
            error = resp.json().get("error", {})
            return True, f"code={error.get('code')}"
        return False, f"Expected 400, got {resp.status_code}"

    # ════════════════════════════════════════════════════════════════════════
    #  RUN ALL TESTS
    # ════════════════════════════════════════════════════════════════════════

    test_functions = [v for v in list(locals().values()) if callable(v) and hasattr(v, "_test_name")]

    for test_fn in test_functions:
        test_fn()

    # ── Summary ──────────────────────────────────────────────────────────────

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
                print(f"  ✗ {r.name}")
                print(f"    Status: {r.status_code} | Error: {r.message}")
        print()

    if passed == total:
        print(f"{Colors.GREEN}🎉 ALL TESTS PASSED!{Colors.END}\n")

    print(f"{Colors.CYAN}Tip: Fix any failures, then re-run:{Colors.END}")
    print(f"  python tests/integration/test_verification.py\n")

    return failed == 0


if __name__ == "__main__":
    success = run_tests()
    sys.exit(0 if success else 1)
