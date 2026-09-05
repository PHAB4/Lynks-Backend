"""
Unit test configuration — sets dummy env vars so module-level
Supabase/DB initialization doesn't crash during import.
"""

import os

# Set dummy values BEFORE any app module is imported.
# These are overridden by real values in .env for integration tests.
os.environ.setdefault("SUPABASE_URL", "https://dummy.supabase.co")
os.environ.setdefault("SUPABASE_ANON_KEY", "dummy-anon-key")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "dummy-service-key")
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite://")
os.environ.setdefault("LLM_API_BASE_URL", "https://dummy.groq.com")
os.environ.setdefault("LLM_API_KEY", "dummy-llm-key")
os.environ.setdefault("GEMINI_API_KEY", "dummy-gemini-key")
