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

import supabase
sb = supabase.create_client(url, service_key)
sb.table("users").update({
    "username": "testuser",
    "name": "Test User",
    "age": 17,
    "country": "Jamaica",
    "education_level": "High School",
    "employment_status": "Student",
    "career_path": "Software Development",
    "interests": ["coding", "web development", "AI"],
}).eq("id", user_id).execute()

print("Profile updated!")
print("")
print("=" * 60)
print(f"  TOKEN (copy this into test_endpoints.py):")
print(f"  {token}")
print("=" * 60)
print("")
print(f"  Email:    {email}")
print(f"  Password: {password}")
print("=" * 60)
