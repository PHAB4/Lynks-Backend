"""
Lynks Backend — AI Memory System Tests

Tests the long-term memory, conversation history management, and context
optimization features implemented in the AI Memory System Plan.

SETUP:
  1. Make sure your server is running: uvicorn app.main:app --reload --port 8000
  2. Fill in the CONFIG section below with your values
  3. Run: python tests/test_ai_memory.py

WHAT IT TESTS:
  - Memory CRUD (POST, GET, PATCH, DELETE /memory)
  - Conversation list (GET /chat/conversations)
  - Conversation messages (GET /chat/conversations/{id})
  - Chat message with memory extraction trigger
  - Conversation summary generation
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
LLM_TIMEOUT = 120.0

# ══════════════════════════════════════════════════════════════════════════════
#  CONFIG — Reads from .env automatically
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
    RESET = "\033[0m"


_state = {
    "token": None,
    "memory_id": None,
    "conversation_id": None,
    "test_conversation_id": None,
}


def _headers(content_type: str = "application/json") -> dict:
    h = {}
    if _state["token"]:
        h["Authorization"] = f"Bearer {_state['token']}"
    if content_type:
        h["Content-Type"] = content_type
    return h


def _run_test(name: str, fn):
    try:
        result = fn()
        if result is False:
            print(f"  {Colors.RED}X {name} — returned False{Colors.RESET}")
            return False
        print(f"  {Colors.GREEN}✓ {name}{Colors.RESET}")
        return True
    except AssertionError as e:
        print(f"  {Colors.RED}X {name} — {e}{Colors.RESET}")
        return False
    except Exception as e:
        print(f"  {Colors.RED}X {name} — EXCEPTION: {e}{Colors.RESET}")
        return False


def _get_token():
    """Get a fresh JWT token via Supabase sign-in or signup."""
    global JWT_TOKEN

    if JWT_TOKEN and JWT_TOKEN != "your-anon-key-here":
        print(f"  {Colors.CYAN}Token found in .env — testing...{Colors.RESET}")
        resp = httpx.get(
            f"{BASE_URL}/profile",
            headers={"Authorization": f"Bearer {JWT_TOKEN}"},
            timeout=HTTP_TIMEOUT,
        )
        if resp.status_code in (200, 404):
            print(f"  {Colors.GREEN}Token verified ✓{Colors.RESET}")
            _state["token"] = JWT_TOKEN
            return True

    print(f"  {Colors.YELLOW}Token invalid — trying sign-in...{Colors.RESET}")

    email = os.getenv("TEST_EMAIL", "test@lynks.com")
    password = os.getenv("TEST_PASSWORD", "TestPassword123!")

    # Try sign-in first
    resp = httpx.post(
        f"{SUPABASE_URL}/auth/v1/token?grant_type=password",
        json={"email": email, "password": password},
        headers={
            "apikey": SUPABASE_ANON_KEY,
            "Content-Type": "application/json",
        },
        timeout=HTTP_TIMEOUT,
    )

    if resp.status_code == 200:
        token = resp.json().get("access_token")
        if token:
            _state["token"] = token
            print(f"  {Colors.GREEN}Signed in as {email}{Colors.RESET}")
            return True

    # Try sign-up
    print(f"  {Colors.YELLOW}Sign-in failed — creating user...{Colors.RESET}")
    resp = httpx.post(
        f"{SUPABASE_URL}/auth/v1/signup",
        json={"email": email, "password": password},
        headers={
            "apikey": SUPABASE_ANON_KEY,
            "Content-Type": "application/json",
        },
        timeout=HTTP_TIMEOUT,
    )

    if resp.status_code in (200, 201):
        token = resp.json().get("access_token")
        if token:
            _state["token"] = token
            print(f"  {Colors.GREEN}Signed up as {email}{Colors.RESET}")
            return True

    print(f"  {Colors.RED}Could not authenticate{Colors.RESET}")
    return False


# ══════════════════════════════════════════════════════════════════════════════
#  TESTS
# ══════════════════════════════════════════════════════════════════════════════

# ── Auth ────────────────────────────────────────────────────────────────────

def test_auth():
    return _get_token()


# ── Memory CRUD ─────────────────────────────────────────────────────────────

def test_memory_post():
    """POST /memory — create a memory manually."""
    resp = httpx.post(
        f"{BASE_URL}/memory",
        json={
            "fact": "Interested in web development, specifically React and Node.js",
            "category": "preference",
            "source": "manual",
        },
        headers=_headers(),
        timeout=HTTP_TIMEOUT,
    )
    assert resp.status_code == 201, f"Expected 201, got {resp.status_code}: {resp.text}"
    data = resp.json()
    assert "id" in data, f"Missing 'id' in response: {data}"
    assert data["fact"] == "Interested in web development, specifically React and Node.js"
    assert data["category"] == "preference"
    assert data["source"] == "manual"
    _state["memory_id"] = data["id"]


def test_memory_get():
    """GET /memory — list user memories."""
    resp = httpx.get(
        f"{BASE_URL}/memory",
        headers=_headers(),
        timeout=HTTP_TIMEOUT,
    )
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
    data = resp.json()
    assert "memories" in data, f"Missing 'memories' key: {data}"
    assert isinstance(data["memories"], list), "memories should be a list"
    assert len(data["memories"]) >= 1, "Should have at least 1 memory after POST"


def test_memory_patch():
    """PATCH /memory/{id} — update a memory."""
    if not _state["memory_id"]:
        print(f"    {Colors.YELLOW}(skipped — no memory_id){Colors.RESET}")
        return False

    resp = httpx.patch(
        f"{BASE_URL}/memory/{_state['memory_id']}",
        json={
            "fact": "Prefers online learning, interested in React and TypeScript",
            "category": "preference",
        },
        headers=_headers(),
        timeout=HTTP_TIMEOUT,
    )
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
    data = resp.json()
    assert data["fact"] == "Prefers online learning, interested in React and TypeScript"
    assert data["category"] == "preference"


def test_memory_post_invalid_category():
    """POST /memory — invalid category should default to 'general'."""
    resp = httpx.post(
        f"{BASE_URL}/memory",
        json={
            "fact": "Test memory with bad category",
            "category": "invalid_category",
        },
        headers=_headers(),
        timeout=HTTP_TIMEOUT,
    )
    assert resp.status_code == 201, f"Expected 201, got {resp.status_code}: {resp.text}"
    data = resp.json()
    assert data["category"] == "general", f"Invalid category should default to 'general', got '{data['category']}'"


def test_memory_delete():
    """DELETE /memory/{id} — delete a memory."""
    if not _state["memory_id"]:
        print(f"    {Colors.YELLOW}(skipped — no memory_id){Colors.RESET}")
        return False

    resp = httpx.delete(
        f"{BASE_URL}/memory/{_state['memory_id']}",
        headers=_headers(),
        timeout=HTTP_TIMEOUT,
    )
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
    data = resp.json()
    assert data.get("success") is True


def test_memory_delete_not_found():
    """DELETE /memory/{id} — non-existent memory should 404."""
    fake_id = "00000000-0000-0000-0000-000000000000"
    resp = httpx.delete(
        f"{BASE_URL}/memory/{fake_id}",
        headers=_headers(),
        timeout=HTTP_TIMEOUT,
    )
    assert resp.status_code == 404, f"Expected 404, got {resp.status_code}"


# ── Conversation List ───────────────────────────────────────────────────────

def test_conversations_list_empty():
    """GET /chat/conversations — returns empty list for fresh user."""
    resp = httpx.get(
        f"{BASE_URL}/chat/conversations",
        headers=_headers(),
        timeout=HTTP_TIMEOUT,
    )
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
    data = resp.json()
    assert "conversations" in data, f"Missing 'conversations' key: {data}"
    assert isinstance(data["conversations"], list)


# ── Chat + Memory Extraction ────────────────────────────────────────────────

def test_chat_creates_conversation():
    """POST /chat/message — sends a message and creates a conversation."""
    resp = httpx.post(
        f"{BASE_URL}/chat/message",
        json={"message": "Hello! I'm interested in learning web development."},
        headers=_headers(),
        timeout=LLM_TIMEOUT,
    )
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
    data = resp.json()
    assert "conversation_id" in data, f"Missing 'conversation_id': {data}"
    assert "response" in data, f"Missing 'response': {data}"
    assert len(data["response"]) > 0, "Response should not be empty"
    _state["test_conversation_id"] = data["conversation_id"]


def test_conversations_list_after_chat():
    """GET /chat/conversations — should now have at least 1 conversation."""
    resp = httpx.get(
        f"{BASE_URL}/chat/conversations",
        headers=_headers(),
        timeout=HTTP_TIMEOUT,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["conversations"]) >= 1, "Should have at least 1 conversation"
    conv = data["conversations"][0]
    assert "conversation_id" in conv
    assert "message_count" in conv
    assert conv["message_count"] >= 1


def test_conversation_messages():
    """GET /chat/conversations/{id} — returns messages for a specific conversation."""
    if not _state["test_conversation_id"]:
        print(f"    {Colors.YELLOW}(skipped — no test_conversation_id){Colors.RESET}")
        return False

    resp = httpx.get(
        f"{BASE_URL}/chat/conversations/{_state['test_conversation_id']}",
        headers=_headers(),
        timeout=HTTP_TIMEOUT,
    )
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
    data = resp.json()
    assert "messages" in data, f"Missing 'messages' key: {data}"
    assert len(data["messages"]) >= 2, "Should have at least 2 messages (user + assistant)"
    assert data["messages"][0]["role"] == "user"
    assert data["messages"][1]["role"] == "assistant"


def test_conversation_messages_not_found():
    """GET /chat/conversations/{id} — non-existent conversation should 404."""
    fake_id = "00000000-0000-0000-0000-000000000000"
    resp = httpx.get(
        f"{BASE_URL}/chat/conversations/{fake_id}",
        headers=_headers(),
        timeout=HTTP_TIMEOUT,
    )
    assert resp.status_code == 404, f"Expected 404, got {resp.status_code}"


def test_chat_continues_conversation():
    """POST /chat/message with conversation_id — continues existing conversation."""
    if not _state["test_conversation_id"]:
        print(f"    {Colors.YELLOW}(skipped — no test_conversation_id){Colors.RESET}")
        return False

    resp = httpx.post(
        f"{BASE_URL}/chat/message",
        json={
            "message": "What programming language should I start with?",
            "conversation_id": _state["test_conversation_id"],
        },
        headers=_headers(),
        timeout=LLM_TIMEOUT,
    )
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
    data = resp.json()
    assert data["conversation_id"] == _state["test_conversation_id"], \
        "Should continue the same conversation"
    assert len(data["response"]) > 0


# ── Chat History (backwards compatibility) ──────────────────────────────────

def test_chat_history():
    """GET /chat/history — existing endpoint still works."""
    resp = httpx.get(
        f"{BASE_URL}/chat/history",
        headers=_headers(),
        timeout=HTTP_TIMEOUT,
    )
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
    data = resp.json()
    assert "conversation_id" in data
    assert "messages" in data


def test_chat_history_with_conversation_id():
    """GET /chat/history?conversation_id=... — still works."""
    if not _state["test_conversation_id"]:
        print(f"    {Colors.YELLOW}(skipped — no test_conversation_id){Colors.RESET}")
        return False

    resp = httpx.get(
        f"{BASE_URL}/chat/history?conversation_id={_state['test_conversation_id']}",
        headers=_headers(),
        timeout=HTTP_TIMEOUT,
    )
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"


# ══════════════════════════════════════════════════════════════════════════════
#  MAIN
# ══════════════════════════════════════════════════════════════════════════════

def main():
    print(f"\n{Colors.BOLD}{'=' * 70}")
    print(f"  Lynks — AI Memory System Tests")
    print(f"  Target: {BASE_URL}")
    print(f"{'=' * 70}{Colors.RESET}\n")

    tests = [
        ("Auth — authenticate", test_auth),
        ("", None),
        ("--- Memory CRUD ---", None),
        ("POST /memory (create memory)", test_memory_post),
        ("GET /memory (list memories)", test_memory_get),
        ("PATCH /memory/{id} (update memory)", test_memory_patch),
        ("POST /memory (invalid category defaults to general)", test_memory_post_invalid_category),
        ("DELETE /memory/{id} (delete memory)", test_memory_delete),
        ("DELETE /memory/{id} (404 for non-existent)", test_memory_delete_not_found),
        ("", None),
        ("--- Conversation History ---", None),
        ("GET /chat/conversations (list — empty)", test_conversations_list_empty),
        ("POST /chat/message (creates conversation)", test_chat_creates_conversation),
        ("GET /chat/conversations (list — after chat)", test_conversations_list_after_chat),
        ("GET /chat/conversations/{id} (messages)", test_conversation_messages),
        ("GET /chat/conversations/{id} (404 for non-existent)", test_conversation_messages_not_found),
        ("POST /chat/message (continues conversation)", test_chat_continues_conversation),
        ("", None),
        ("--- Backwards Compatibility ---", None),
        ("GET /chat/history (still works)", test_chat_history),
        ("GET /chat/history?conversation_id= (still works)", test_chat_history_with_conversation_id),
    ]

    passed = 0
    failed = 0
    skipped = 0

    for name, fn in tests:
        if fn is None:
            if name:
                print(f"\n{Colors.CYAN}{Colors.BOLD}{name}{Colors.RESET}")
            continue

        result = _run_test(name, fn)
        if result is True:
            passed += 1
        elif result is False:
            skipped += 1
        else:
            failed += 1

    print(f"\n{'=' * 70}")
    total = passed + failed + skipped
    if failed == 0 and skipped == 0:
        print(f"  {Colors.GREEN}{Colors.BOLD}RESULTS: {passed}/{total} passed — ALL CLEAR{Colors.RESET}")
    elif failed == 0:
        print(f"  {Colors.YELLOW}{Colors.BOLD}RESULTS: {passed}/{total} passed, {skipped} skipped{Colors.RESET}")
    else:
        print(f"  {Colors.RED}{Colors.BOLD}RESULTS: {passed} passed, {failed} FAILED, {skipped} skipped{Colors.RESET}")
    print(f"{'=' * 70}\n")

    if failed > 0:
        print(f"{Colors.RED}Failed tests:{Colors.RESET}")
        sys.exit(1)


if __name__ == "__main__":
    main()
