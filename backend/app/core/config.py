"""
App configuration — env vars, settings.
"""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Supabase
    SUPABASE_URL: str = ""
    SUPABASE_ANON_KEY: str = ""
    SUPABASE_SERVICE_ROLE_KEY: str = ""

    # Postgres (Supabase provides this — pooler URL for async access)
    DATABASE_URL: str = ""  # e.g. postgresql+asyncpg://user:pass@host:6543/postgres

    # LLM — Groq (text tasks: chat, roadmap, resume, memory)
    LLM_API_BASE_URL: str = ""  # https://api.groq.com/openai/v1
    LLM_API_KEY: str = ""
    LLM_MODEL: str = "openai/gpt-oss-120b"  # Groq model — override in .env if needed

    # Vision — Google Gemini Flash (evidence verification + model router fallback)
    GEMINI_API_KEY: str = ""  # Google AI Studio key — get from https://aistudio.google.com/apikey
    VISION_MODEL: str = "gemini-3.1-flash-lite"  # Cheapest available: $0.25/$1.50 per 1M tokens

    # MiniMax — OpenAI-compatible (https://platform.minimax.io)
    MINIMAX_API_KEY: str = ""

    # Model Router — auto-fallback across Groq + Gemini
    MODEL_ROUTER_ENABLED: bool = True

    # Test config (optional)
    JWT_TOKEN: str = ""

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"


settings = Settings()

# Supabase client (kept for backward compat with existing profile route)
from supabase import create_client  # noqa: E402

supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_ANON_KEY)

# Admin client for storage uploads (requires service role key)
supabase_admin = create_client(
    settings.SUPABASE_URL,
    settings.SUPABASE_SERVICE_ROLE_KEY or settings.SUPABASE_ANON_KEY,
)
