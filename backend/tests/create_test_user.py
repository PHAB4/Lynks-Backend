"""Create a test user with a complete profile for testing."""
import os
import time
import httpx
from dotenv import load_dotenv
load_dotenv()

url = os.getenv("SUPABASE_URL")
anon_key = os.getenv("SUPABASE_ANON_KEY")
service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or anon_key

email = f"testuser_{int(time.time())}@lynks.dev"
password = "Test1234!"
username = f"tester_{int(time.time())}"

print(f"Creating user: {email}")

r = httpx.post(
    f"{url}/auth/v1/signup",
    headers={"apikey": anon_key, "Content-Type": "application/json"},
    json={"email": email, "password": password},
)

if r.status_code != 200:
    print(f"Signup failed: {r.status_code} {r.text[:300]}")
    exit(1)

data = r.json()
token = data.get("access_token", "")
user_id = data.get("user", {}).get("id", "")

if not token:
    print(f"No token received: {data}")
    exit(1)

print(f"User ID: {user_id}")
time.sleep(2)

import supabase
sb = supabase.create_client(url, service_key)

profile = {
    "id": user_id,
    "email": email,
    "username": username,
    "name": "Test User",
    "age": 17,
    "country": "Jamaica",
    "education_level": "High School",
    "career_path": "Software Development",
    "interests": ["coding", "web development", "AI"],
}

try:
    result = sb.table("users").upsert(profile, on_conflict="id").execute()
    print(f"Profile upserted: {len(result.data)} row")
except Exception as e:
    print(f"Upsert failed: {e}")
    try:
        result = sb.table("users").update(profile).eq("id", user_id).execute()
        print(f"Profile updated: {len(result.data)} row")
    except Exception as e2:
        print(f"Update also failed: {e2}")

result = sb.table("users").select("*").eq("id", user_id).execute()
if result.data:
    u = result.data[0]
    print(f"\n  Verified: email={u.get('email')} | username={u.get('username')} | career_path={u.get('career_path')}")
else:
    print("\n  WARNING: User not found after upsert!")

print("")
print("=" * 60)
print(f"  TOKEN (copy into test_endpoints.py):")
print(f"  {token}")
print("=" * 60)
print(f"  Email:    {email}")
print(f"  Password: {password}")
print("=" * 60)
