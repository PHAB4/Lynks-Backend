"""
Minimal debug test -- isolates the conversation INSERT issue.
Run this while the server is running in a SEPARATE terminal.
The server terminal will show the EXACT SQL being executed.

Run: python tests/debug_conversation.py
"""

import os
import sys
import time

import httpx
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "")
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8000")


def create_user():
    email = f"debug_{int(time.time())}@lynks-test.com"
    resp = httpx.post(
        f"{SUPABASE_URL}/auth/v1/signup",
        headers={"apikey": SUPABASE_ANON_KEY, "Content-Type": "application/json"},
        json={"email": email, "password": "DebugPass123!"},
        timeout=15,
    )
    data = resp.json()
    token = data.get("access_token", "")
    user_id = data.get("user", {}).get("id", "")
    return token, user_id, email


def main():
    print("=" * 60)
    print("  Conversation Debug Test")
    print("=" * 60)

    print("\n[1] Creating test user...")
    token, user_id, email = create_user()
    if not token:
        print(f"    FAIL: Could not create user")
        print(f"    Response: {email}")
        sys.exit(1)
    print(f"    OK: user_id={user_id}")

    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    print("\n[2] Updating profile with career_path...")
    resp = httpx.patch(
        f"{BACKEND_URL}/profile",
        headers=headers,
        json={"name": "Debug User", "age": 17, "country": "Jamaica",
              "education_level": "High School", "career_path": "Software Development",
              "interests": ["coding"]},
        timeout=10,
    )
    print(f"    Status: {resp.status_code}")
    if resp.status_code != 200:
        print(f"    Body: {resp.text[:300]}")

    print("\n[3] Sending chat message (this triggers the conversation INSERT)...")
    try:
        resp = httpx.post(
            f"{BACKEND_URL}/chat/message",
            headers=headers,
            json={"message": "Hi! What is Lynks?"},
            timeout=60,
        )
        print(f"    Status: {resp.status_code}")
        print(f"    Body: {resp.text[:500]}")
    except Exception as e:
        print(f"    Exception: {e}")

    print("\n[4] Getting chat history...")
    try:
        resp = httpx.get(f"{BACKEND_URL}/chat/history", headers=headers, timeout=10)
        print(f"    Status: {resp.status_code}")
        print(f"    Body: {resp.text[:500]}")
    except Exception as e:
        print(f"    Exception: {e}")

    print("\n[5] Server health check...")
    resp = httpx.get(f"{BACKEND_URL}/health", timeout=5)
    print(f"    Status: {resp.status_code}")
    print(f"    Body: {resp.text}")

    print("\n" + "=" * 60)
    print("  Done.")
    print("  CHECK THE SERVER TERMINAL for the exact SQL output.")
    print("  Copy that SQL output and send it to your dev.")
    print("=" * 60)


if __name__ == "__main__":
    main()
