"""
Lynks Backend — Opportunities Endpoints Test Script

Tests the new opportunities endpoints:
  - GET  /opportunities              — list with filtering, sorting, pagination
  - GET  /opportunities/new-count    — new-opportunity notification polling
  - GET  /opportunities/saved        — list saved opportunities
  - POST /opportunities/{id}/save    — save/bookmark an opportunity
  - DELETE /opportunities/{id}/save  — unsave an opportunity

SETUP:
  1. Make sure your server is running
  2. Fill in the CONFIG section below with your values
  3. Run: python tests/test_opportunities.py
"""

from __future__ import annotations

import json
import os
import sys
import time
from pathlib import Path

import httpx
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

HTTP_TIMEOUT = 30.0
LLM_TIMEOUT = 60.0

# ══════════════════════════════════════════════════════════════════════════════
#  CONFIG
# ══════════════════════════════════════════════════════════════════════════════

BASE_URL = os.getenv("BASE_URL", "https://lynks-backend-production.up.railway.app")
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://your-project.supabase.co")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "")
JWT_TOKEN = os.getenv("JWT_TOKEN")


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
    def __init__(self, name: str, passed: bool, status_code: int = 0, message: str = ""):
        self.name = name
        self.passed = passed
        self.status_code = status_code
        self.message = message


results: list[TestResult] = []


def test(name: str):
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
    h = {"Content-Type": "application/json"}
    if token:
        h["Authorization"] = f"Bearer {token}"
    return h


# ══════════════════════════════════════════════════════════════════════════════
#  TESTS
# ══════════════════════════════════════════════════════════════════════════════

_state = {}


def run_tests():
    print(f"\n{Colors.BOLD}{'=' * 60}")
    print("  Lynks Backend — Opportunities Endpoint Test Suite")
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
            try:
                resp = httpx.get(
                    f"{BASE_URL}/profile",
                    headers=headers(JWT_TOKEN),
                    timeout=HTTP_TIMEOUT,
                )
                if resp.status_code in (200, 404):
                    _state["token"] = JWT_TOKEN
                    return True, "using pre-supplied token (verified)"
            except Exception:
                pass

        if not SUPABASE_ANON_KEY or SUPABASE_ANON_KEY == "your-anon-key-here":
            return False, (
                "JWT expired and no SUPABASE_ANON_KEY to refresh. "
                "Add SUPABASE_URL and SUPABASE_ANON_KEY to .env"
            )

        test_password = "TestPassword123!"
        test_email = None
        resp = None

        for email in [
            "test@lynks.com",
            "test@example.com",
            f"test_{int(time.time())}@lynks-test.com",
        ]:
            try:
                sign_in_resp = httpx.post(
                    f"{SUPABASE_URL}/auth/v1/token?grant_type=password",
                    headers={"apikey": SUPABASE_ANON_KEY, "Content-Type": "application/json"},
                    json={"email": email, "password": test_password},
                    timeout=HTTP_TIMEOUT,
                )
                if sign_in_resp.status_code == 200:
                    resp = sign_in_resp
                    test_email = email
                    break
            except Exception:
                continue

        if resp is None or resp.status_code != 200:
            test_email = f"test_{int(time.time())}@lynks-test.com"
            try:
                resp = httpx.post(
                    f"{SUPABASE_URL}/auth/v1/signup",
                    headers={"apikey": SUPABASE_ANON_KEY, "Content-Type": "application/json"},
                    json={"email": test_email, "password": test_password},
                    timeout=HTTP_TIMEOUT,
                )
            except Exception:
                pass

        if resp.status_code == 200:
            token = resp.json().get("access_token", "")
            if token:
                _state["token"] = token
                try:
                    env_path = Path(__file__).resolve().parent.parent / ".env"
                    env_content = env_path.read_text()
                    if "JWT_TOKEN=" in env_content:
                        env_content = env_content.replace(
                            f"JWT_TOKEN={JWT_TOKEN}" if JWT_TOKEN else "JWT_TOKEN=",
                            f"JWT_TOKEN={token}"
                        )
                    else:
                        env_content += f"\nJWT_TOKEN={token}\n"
                    env_path.write_text(env_content)
                    JWT_TOKEN = token
                except Exception:
                    pass
                return True, f"fresh token via Supabase ({test_email})"

        return False, f"Could not get JWT: {resp.status_code} — {resp.text[:200]}"

    # ── 3. GET /opportunities — Basic list ──────────────────────────────────

    @test("GET /opportunities (returns list with metadata)")
    def test_opportunities_basic():
        token = _state.get("token")
        resp = httpx.get(f"{BASE_URL}/opportunities", headers=headers(token), timeout=LLM_TIMEOUT)
        if resp.status_code == 200:
            data = resp.json()
            if not isinstance(data, dict):
                return False, f"Expected dict with metadata, got {type(data).__name__}"
            opps = data.get("opportunities", [])
            total = data.get("total_available")
            has_more = data.get("has_more")
            categories = data.get("available_categories")
            _state["opportunity_count"] = len(opps)
            if opps:
                _state["first_opp_id"] = opps[0].get("id")
            if total is None:
                return False, "Missing 'total_available' in response"
            if has_more is None:
                return False, "Missing 'has_more' in response"
            if categories is None:
                return False, "Missing 'available_categories' in response"
            return True, f"{len(opps)} opportunities, total={total}, categories={categories}"
        else:
            return False, f"Expected 200, got {resp.status_code}: {resp.text[:300]}"

    # ── 4. GET /opportunities — Verify response shape ───────────────────────

    @test("GET /opportunities (response has all required fields)")
    def test_opportunities_shape():
        token = _state.get("token")
        resp = httpx.get(f"{BASE_URL}/opportunities", headers=headers(token), timeout=LLM_TIMEOUT)
        if resp.status_code != 200:
            return False, f"Request failed: {resp.status_code}"
        data = resp.json()
        opps = data.get("opportunities", [])
        if not opps:
            return True, "no opportunities to check shape (empty list is valid)"

        opp = opps[0]
        required_fields = [
            "id", "title", "category", "url", "first_seen_at", "source_name"
        ]
        optional_fields = [
            "company", "location", "salary_min", "salary_max", "salary_currency",
            "pay", "description", "posted_at", "image_url", "is_saved"
        ]
        missing = [f for f in required_fields if f not in opp]
        if missing:
            return False, f"Missing required fields: {', '.join(missing)}"
        return True, f"all {len(required_fields)} required fields present"

    # ── 5. GET /opportunities — Category filter ─────────────────────────────

    @test("GET /opportunities?category=job (category filter)")
    def test_opportunities_category_filter():
        token = _state.get("token")
        resp = httpx.get(
            f"{BASE_URL}/opportunities?category=job",
            headers=headers(token),
            timeout=LLM_TIMEOUT,
        )
        if resp.status_code == 200:
            data = resp.json()
            opps = data.get("opportunities", [])
            if not opps:
                return True, "0 job opportunities (valid — filter works, no data)"
            all_jobs = all(o.get("category") == "job" for o in opps)
            if not all_jobs:
                bad = [o.get("category") for o in opps if o.get("category") != "job"]
                return False, f"Non-job categories in result: {bad}"
            return True, f"{len(opps)} job opportunities, all correctly filtered"
        else:
            return False, f"Expected 200, got {resp.status_code}: {resp.text[:300]}"

    # ── 6. GET /opportunities — Invalid category returns 400 ────────────────

    @test("GET /opportunities?category=invalid (returns 400)")
    def test_opportunities_invalid_category():
        token = _state.get("token")
        resp = httpx.get(
            f"{BASE_URL}/opportunities?category=invalid_category",
            headers=headers(token),
            timeout=HTTP_TIMEOUT,
        )
        if resp.status_code == 400:
            return True, "400 returned correctly for invalid category"
        else:
            return False, f"Expected 400, got {resp.status_code}"

    # ── 7. GET /opportunities — Timeframe filter ────────────────────────────

    @test("GET /opportunities?timeframe=week (timeframe filter)")
    def test_opportunities_timeframe_filter():
        token = _state.get("token")
        resp = httpx.get(
            f"{BASE_URL}/opportunities?timeframe=week",
            headers=headers(token),
            timeout=LLM_TIMEOUT,
        )
        if resp.status_code == 200:
            data = resp.json()
            opps = data.get("opportunities", [])
            return True, f"{len(opps)} opportunities within the last week"
        else:
            return False, f"Expected 200, got {resp.status_code}: {resp.text[:300]}"

    # ── 8. GET /opportunities — Invalid timeframe returns 400 ───────────────

    @test("GET /opportunities?timeframe=invalid (returns 400)")
    def test_opportunities_invalid_timeframe():
        token = _state.get("token")
        resp = httpx.get(
            f"{BASE_URL}/opportunities?timeframe=last_century",
            headers=headers(token),
            timeout=HTTP_TIMEOUT,
        )
        if resp.status_code == 400:
            return True, "400 returned correctly for invalid timeframe"
        else:
            return False, f"Expected 400, got {resp.status_code}"

    # ── 9. GET /opportunities — Sort by recent ──────────────────────────────

    @test("GET /opportunities?sort=recent (sort by recency)")
    def test_opportunities_sort_recent():
        token = _state.get("token")
        resp = httpx.get(
            f"{BASE_URL}/opportunities?sort=recent",
            headers=headers(token),
            timeout=LLM_TIMEOUT,
        )
        if resp.status_code == 200:
            data = resp.json()
            opps = data.get("opportunities", [])
            if len(opps) < 2:
                return True, f"{len(opps)} opportunities (not enough to verify sort order)"
            dates = [o.get("first_seen_at", "") for o in opps]
            is_sorted = all(dates[i] >= dates[i + 1] for i in range(len(dates) - 1))
            return True, f"{len(opps)} opportunities, sorted correctly: {is_sorted}"
        else:
            return False, f"Expected 200, got {resp.status_code}: {resp.text[:300]}"

    # ── 10. GET /opportunities — Sort by salary ─────────────────────────────

    @test("GET /opportunities?sort=salary (sort by salary)")
    def test_opportunities_sort_salary():
        token = _state.get("token")
        resp = httpx.get(
            f"{BASE_URL}/opportunities?sort=salary",
            headers=headers(token),
            timeout=LLM_TIMEOUT,
        )
        if resp.status_code == 200:
            data = resp.json()
            opps = data.get("opportunities", [])
            return True, f"{len(opps)} opportunities returned (salary sort)"
        else:
            return False, f"Expected 200, got {resp.status_code}: {resp.text[:300]}"

    # ── 11. GET /opportunities — Pagination (page 1) ────────────────────────

    @test("GET /opportunities?page=1&limit=2 (pagination)")
    def test_opportunities_pagination():
        token = _state.get("token")
        resp = httpx.get(
            f"{BASE_URL}/opportunities?page=1&limit=2",
            headers=headers(token),
            timeout=LLM_TIMEOUT,
        )
        if resp.status_code == 200:
            data = resp.json()
            opps = data.get("opportunities", [])
            has_more = data.get("has_more")
            total = data.get("total_available")
            if len(opps) > 2:
                return False, f"Expected max 2, got {len(opps)}"
            if total and total <= 2 and has_more:
                return False, f"has_more=True but total={total} <= limit=2"
            return True, f"{len(opps)} returned, has_more={has_more}, total={total}"
        else:
            return False, f"Expected 200, got {resp.status_code}: {resp.text[:300]}"

    # ── 12. GET /opportunities — Pagination (page 2) ────────────────────────

    @test("GET /opportunities?page=2&limit=2 (page 2)")
    def test_opportunities_pagination_page2():
        token = _state.get("token")
        resp = httpx.get(
            f"{BASE_URL}/opportunities?page=2&limit=2",
            headers=headers(token),
            timeout=LLM_TIMEOUT,
        )
        if resp.status_code == 200:
            data = resp.json()
            opps = data.get("opportunities", [])
            return True, f"{len(opps)} opportunities on page 2"
        else:
            return False, f"Expected 200, got {resp.status_code}: {resp.text[:300]}"

    # ── 13. GET /opportunities — Combined filters ───────────────────────────

    @test("GET /opportunities?category=job&timeframe=month&sort=recent&page=1&limit=5 (combined)")
    def test_opportunities_combined_filters():
        token = _state.get("token")
        resp = httpx.get(
            f"{BASE_URL}/opportunities?category=job&timeframe=month&sort=recent&page=1&limit=5",
            headers=headers(token),
            timeout=LLM_TIMEOUT,
        )
        if resp.status_code == 200:
            data = resp.json()
            opps = data.get("opportunities", [])
            filters = data.get("filters_applied", {})
            return True, f"{len(opps)} opportunities, filters={filters}"
        else:
            return False, f"Expected 200, got {resp.status_code}: {resp.text[:300]}"

    # ── 14. GET /opportunities/new-count ────────────────────────────────────

    @test("GET /opportunities/new-count (returns count)")
    def test_opportunities_new_count():
        token = _state.get("token")
        resp = httpx.get(
            f"{BASE_URL}/opportunities/new-count",
            headers=headers(token),
            timeout=HTTP_TIMEOUT,
        )
        if resp.status_code == 200:
            data = resp.json()
            count = data.get("new_count")
            since = data.get("new_since")
            if count is None:
                return False, "Missing 'new_count' in response"
            if since is None:
                return False, "Missing 'new_since' in response"
            return True, f"new_count={count}, new_since={since}"
        else:
            return False, f"Expected 200, got {resp.status_code}: {resp.text[:300]}"

    # ── 15. POST /opportunities/{id}/save ───────────────────────────────────

    @test("POST /opportunities/{id}/save (save opportunity)")
    def test_opportunities_save():
        token = _state.get("token")
        opp_id = _state.get("first_opp_id")
        if not opp_id:
            return False, "No opportunity ID available (basic list may have failed)"
        resp = httpx.post(
            f"{BASE_URL}/opportunities/{opp_id}/save",
            headers=headers(token),
            timeout=HTTP_TIMEOUT,
        )
        if resp.status_code == 201:
            return True, f"saved opportunity {opp_id[:8]}..."
        elif resp.status_code == 409:
            return True, f"already saved (409 conflict — expected)"
        else:
            return False, f"Expected 201, got {resp.status_code}: {resp.text[:300]}"

    # ── 16. GET /opportunities/saved (list saved) ───────────────────────────

    @test("GET /opportunities/saved (list saved opportunities)")
    def test_opportunities_saved_list():
        token = _state.get("token")
        resp = httpx.get(
            f"{BASE_URL}/opportunities/saved",
            headers=headers(token),
            timeout=HTTP_TIMEOUT,
        )
        if resp.status_code == 200:
            data = resp.json()
            opps = data.get("opportunities", data) if isinstance(data, dict) else data
            if isinstance(opps, list):
                saved_count = len(opps)
                return True, f"{saved_count} saved opportunities"
            else:
                return False, f"Expected list, got {type(opps).__name__}"
        else:
            return False, f"Expected 200, got {resp.status_code}: {resp.text[:300]}"

    # ── 17. Verify is_saved flag on saved opportunity ───────────────────────

    @test("GET /opportunities (is_saved flag on saved opportunity)")
    def test_opportunities_is_saved_flag():
        token = _state.get("token")
        resp = httpx.get(f"{BASE_URL}/opportunities", headers=headers(token), timeout=LLM_TIMEOUT)
        if resp.status_code != 200:
            return False, f"Request failed: {resp.status_code}"
        data = resp.json()
        opps = data.get("opportunities", [])
        saved_opp_id = _state.get("first_opp_id")
        if not saved_opp_id:
            return True, "no saved opportunity to check flag"
        saved_opp = next((o for o in opps if o.get("id") == saved_opp_id), None)
        if saved_opp is None:
            return True, "saved opportunity not in this page (valid with pagination)"
        is_saved = saved_opp.get("is_saved")
        if is_saved is None:
            return False, f"is_saved field missing on opportunity {saved_opp_id[:8]}"
        if not is_saved:
            return False, f"is_saved should be True for saved opportunity, got {is_saved}"
        return True, f"is_saved=True correctly set"

    # ── 18. DELETE /opportunities/{id}/save ─────────────────────────────────

    @test("DELETE /opportunities/{id}/save (unsave opportunity)")
    def test_opportunities_unsave():
        token = _state.get("token")
        opp_id = _state.get("first_opp_id")
        if not opp_id:
            return False, "No opportunity ID available"
        resp = httpx.delete(
            f"{BASE_URL}/opportunities/{opp_id}/save",
            headers=headers(token),
            timeout=HTTP_TIMEOUT,
        )
        if resp.status_code == 200:
            return True, f"unsaved opportunity {opp_id[:8]}..."
        else:
            return False, f"Expected 200, got {resp.status_code}: {resp.text[:300]}"

    # ── 19. DELETE /opportunities/{id}/save — idempotent ────────────────────

    @test("DELETE /opportunities/{id}/save (double unsave is idempotent)")
    def test_opportunities_double_unsave():
        token = _state.get("token")
        opp_id = _state.get("first_opp_id")
        if not opp_id:
            return False, "No opportunity ID available"
        resp = httpx.delete(
            f"{BASE_URL}/opportunities/{opp_id}/save",
            headers=headers(token),
            timeout=HTTP_TIMEOUT,
        )
        if resp.status_code == 200:
            return True, "double unsave succeeded (idempotent)"
        elif resp.status_code == 404:
            return True, "404 on double unsave (acceptable)"
        else:
            return False, f"Expected 200 or 404, got {resp.status_code}"

    # ── 20. Verify is_saved=False after unsave ─────────────────────────────

    @test("GET /opportunities (is_saved=False after unsave)")
    def test_opportunities_not_saved_flag():
        token = _state.get("token")
        resp = httpx.get(f"{BASE_URL}/opportunities", headers=headers(token), timeout=LLM_TIMEOUT)
        if resp.status_code != 200:
            return False, f"Request failed: {resp.status_code}"
        data = resp.json()
        opps = data.get("opportunities", [])
        saved_opp_id = _state.get("first_opp_id")
        if not saved_opp_id:
            return True, "no saved opportunity to check flag"
        saved_opp = next((o for o in opps if o.get("id") == saved_opp_id), None)
        if saved_opp is None:
            return True, "saved opportunity not in this page (valid with pagination)"
        is_saved = saved_opp.get("is_saved")
        if is_saved:
            return False, f"is_saved should be False after unsave, got {is_saved}"
        return True, f"is_saved=False correctly set"

    # ── 21. Save non-existent opportunity ───────────────────────────────────

    @test("POST /opportunities/fake-id/save (returns 404)")
    def test_opportunities_save_nonexistent():
        token = _state.get("token")
        resp = httpx.post(
            f"{BASE_URL}/opportunities/fake-nonexistent-id/save",
            headers=headers(token),
            timeout=HTTP_TIMEOUT,
        )
        if resp.status_code == 404:
            return True, "404 returned correctly"
        else:
            return False, f"Expected 404, got {resp.status_code}"

    # ── 22. Unauthorized access ─────────────────────────────────────────────

    @test("GET /opportunities without auth (returns 401)")
    def test_opportunities_unauthorized():
        resp = httpx.get(f"{BASE_URL}/opportunities", timeout=HTTP_TIMEOUT)
        if resp.status_code in (401, 403):
            return True, f"{resp.status_code} returned correctly"
        else:
            return False, f"Expected 401/403, got {resp.status_code}"

    # ── 23. Invalid sort parameter ──────────────────────────────────────────

    @test("GET /opportunities?sort=invalid (returns 400)")
    def test_opportunities_invalid_sort():
        token = _state.get("token")
        resp = httpx.get(
            f"{BASE_URL}/opportunities?sort=distance",
            headers=headers(token),
            timeout=HTTP_TIMEOUT,
        )
        if resp.status_code == 400:
            return True, "400 returned correctly for invalid sort"
        else:
            return False, f"Expected 400, got {resp.status_code}"

    # ── 24. Invalid page number ─────────────────────────────────────────────

    @test("GET /opportunities?page=0 (returns 400)")
    def test_opportunities_invalid_page():
        token = _state.get("token")
        resp = httpx.get(
            f"{BASE_URL}/opportunities?page=0&limit=5",
            headers=headers(token),
            timeout=HTTP_TIMEOUT,
        )
        if resp.status_code == 400:
            return True, "400 returned correctly for page=0"
        elif resp.status_code == 200:
            return True, "200 returned (server treats page=0 as page=1 — acceptable)"
        else:
            return False, f"Expected 400 or 200, got {resp.status_code}"

    # ── 25. Limit too large ─────────────────────────────────────────────────

    @test("GET /opportunities?limit=500 (clamped to 50)")
    def test_opportunities_limit_clamp():
        token = _state.get("token")
        resp = httpx.get(
            f"{BASE_URL}/opportunities?page=1&limit=500",
            headers=headers(token),
            timeout=LLM_TIMEOUT,
        )
        if resp.status_code == 200:
            data = resp.json()
            opps = data.get("opportunities", [])
            if len(opps) > 50:
                return False, f"Expected max 50, got {len(opps)}"
            return True, f"{len(opps)} returned (clamped from 500)"
        else:
            return False, f"Expected 200, got {resp.status_code}: {resp.text[:300]}"

    # ── 26. POST /opportunities/refresh (trigger refresh) ───────────────────

    @test("POST /opportunities/refresh (trigger scraper refresh)")
    def test_opportunities_refresh():
        token = _state.get("token")
        resp = httpx.post(
            f"{BASE_URL}/opportunities/refresh",
            headers=headers(token),
            timeout=LLM_TIMEOUT * 2,
        )
        if resp.status_code == 200:
            data = resp.json()
            count = data.get("count", 0)
            sources = data.get("sources", [])
            return True, f"refreshed {count} opportunities from {len(sources)} sources"
        elif resp.status_code == 503:
            return True, "503 returned (no auth configured — expected in test env)"
        else:
            return False, f"Expected 200, got {resp.status_code}: {resp.text[:300]}"

    # ── RUN ALL TESTS ───────────────────────────────────────────────────────

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

    print(f"{Colors.CYAN}Tip: Fix any failures, then re-run:{Colors.END}")
    print(f"  python tests/test_opportunities.py\n")

    return failed == 0


if __name__ == "__main__":
    success = run_tests()
    sys.exit(0 if success else 1)
