"""App configuration — env vars, settings."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    SUPABASE_URL: str
    SUPABASE_ANON_KEY: str
    SUPABASE_SERVICE_ROLE_KEY: str = ""
    DATABASE_URL: str
    LLM_API_BASE_URL: str
    LLM_API_KEY: str
    LLM_MODEL: str = "llama3-70b-8192"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()

from supabase import create_client
supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_ANON_KEY)