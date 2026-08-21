"""Debug: check if users are actually being created in the database."""
import os
import time
import httpx
from dotenv import load_dotenv
load_dotenv()

url = os.getenv("SUPABASE_URL")
anon_key = os.getenv("SUPABASE_ANON_KEY")
service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or anon_key

print("=== STEP 1: Check if users table has any rows ===")
import supabase
sb = supabase.create_client(url, service_key)
result = sb.table("users").select("*").execute()
print(f"Users table has {len(result.data)} rows")
if result.data:
    for u in result.data:
        print(f"  - {u.get('email')} | username={u.get('username')} | career_path={u.get('career_path')}")
else:
    print("  (empty)")

print("\n=== STEP 2: Sign up a new user via Supabase Auth ===")
email = f"debug_{int(time.time())}@lynks.dev"
password = "Test1234!"
r = httpx.post(
    f"{url}/auth/v1/signup",
    headers={"apikey": anon_key, "Content-Type": "application/json"},
    json={"email": email, "password": password},
)
print(f"Signup status: {r.status_code}")
auth_data = r.json()
user_id = auth_data.get("user", {}).get("id", "")
token = auth_data.get("access_token", "")
print(f"User ID: {user_id}")
print(f"Token present: {bool(token)}")

if not user_id:
    print(f"Signup failed: {auth_data}")
    exit(1)

print("\n=== STEP 3: Wait 2 seconds for trigger to fire ===")
time.sleep(2)

print("\n=== STEP 4: Check if user exists in public.users ===")
result = sb.table("users").select("*").eq("id", user_id).execute()
print(f"Rows found: {len(result.data)}")
if result.data:
    print(f"  User exists: {result.data[0]}")
else:
    print("  USER NOT FOUND IN public.users!")
    print("  The signup trigger may not have fired.")

print("\n=== STEP 5: Try to insert directly with service key ===")
try:
    sb.table("users").insert({
        "id": user_id,
        "email": email,
        "username": f"debug_{int(time.time())}",
        "name": "Debug User",
        "age": 17,
        "country": "Jamaica",
        "education_level": "High School",
        "career_path": "Software Development",
        "interests": ["coding"],
    }).execute()
    print("  Direct insert: SUCCESS")
except Exception as e:
    print(f"  Direct insert FAILED: {e}")

print("\n=== STEP 6: Verify the user now exists ===")
result = sb.table("users").select("*").eq("id", user_id).execute()
print(f"Rows found: {len(result.data)}")
if result.data:
    u = result.data[0]
    print(f"  email: {u.get('email')}")
    print(f"  username: {u.get('username')}")
    print(f"  career_path: {u.get('career_path')}")
    print(f"\n  TOKEN: {token}")
else:
    print("  STILL NOT FOUND. Check table columns in Supabase Dashboard.")

print("\n=== STEP 7: Check what columns exist ===")
try:
    result = sb.table("users").select("id, email, username, name, age, country, education_level, career_path, interests").execute()
    print(f"  All expected columns exist: {len(result.data)} rows")
except Exception as e:
    print(f"  Column check failed: {e}")
