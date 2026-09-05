"""
Unit test configuration — sets dummy env vars so module-level
Supabase/DB initialization doesn't crash during import.

MUST run before any app module is imported (conftest.py is loaded
first by pytest, so this works).
"""

import os

# Force override — setdefault won't override empty strings from .env.
# These values let config.py and postgres.py initialize without real credentials.
os.environ["SUPABASE_URL"] = "https://dummy.supabase.co"
os.environ["SUPABASE_ANON_KEY"] = "dummy-anon-key"
os.environ["SUPABASE_SERVICE_ROLE_KEY"] = "dummy-service-key"
os.environ["DATABASE_URL"] = "sqlite+aiosqlite://"
os.environ["LLM_API_BASE_URL"] = "https://dummy.groq.com"
os.environ["LLM_API_KEY"] = "dummy-llm-key"
os.environ["GEMINI_API_KEY"] = "dummy-gemini-key"
