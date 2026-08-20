"""
App configuration — env vars, settings.
"""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Supabase
    SUPABASE_URL: str
    SUPABASE_ANON_KEY: str
    SUPABASE_SERVICE_ROLE_KEY: str = ""

    # Postgres (Supabase provides this — pooler URL for async access)
    DATABASE_URL: str  # e.g. postgresql+asyncpg://user:pass@host:6543/postgres

    # LLM — OpenAI-compatible compute gateway
    LLM_API_BASE_URL: str  # e.g. https://api.groq.com/openai/v1
    LLM_API_KEY: str
    LLM_MODEL: str = "llama3-70b-8192"  # default for Groq

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()

# Supabase client (kept for backward compat with existing profile route)
from supabase import create_client

supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_ANON_KEY)