"""
Lynks Backend — FastAPI entry point.

This file registers every router. When you add a new route file in api/routes/,
import and include it here.

NOTE: Your existing main.py only registers the profile router.
This is the UPDATED version that adds the roadmap router.
Copy the roadmap router registration into your existing main.py.
"""

from contextlib import asynccontextmanager
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.middleware import RateLimitMiddleware, SecurityHeadersMiddleware

from app.api.routes.chat import router as chat_router
from app.api.routes.memory import router as memory_router
from app.api.routes.notifications import router as notifications_router
from app.api.routes.dashboard import router as dashboard_router
from app.api.routes.opportunities import router as opportunities_router
from app.api.routes.portfolio import router as portfolio_router
from app.api.routes.profile import router as profile_router
from app.api.routes.resume import router as resume_router
from app.api.routes.roadmap import router as roadmap_router
from app.db.postgres import engine


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Auto-migrate: ensure the opportunities table exists with all required columns
    try:
        from sqlalchemy import text
        from app.db.postgres import async_session
        async with async_session() as db:
            await db.execute(text("""
                CREATE TABLE IF NOT EXISTS opportunities (
                    id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    company TEXT DEFAULT 'Unknown',
                    location TEXT DEFAULT 'Caribbean',
                    pay TEXT DEFAULT 'Varies',
                    url TEXT DEFAULT '',
                    age_requirement TEXT,
                    experience_required TEXT DEFAULT 'None',
                    category TEXT NOT NULL DEFAULT 'event',
                    description TEXT DEFAULT '',
                    posted_at TIMESTAMPTZ DEFAULT now(),
                    first_seen_at TIMESTAMPTZ DEFAULT now(),
                    source_name TEXT DEFAULT 'curated',
                    salary_min NUMERIC,
                    salary_max NUMERIC,
                    salary_currency TEXT DEFAULT 'JMD',
                    image_url TEXT
                )
            """))
            # Add any missing columns (idempotent)
            for col_sql in [
                "ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS age_requirement TEXT",
                "ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS experience_required TEXT DEFAULT 'None'",
                "ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'event'",
                "ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS description TEXT DEFAULT ''",
                "ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS posted_at TIMESTAMPTZ DEFAULT now()",
                "ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS first_seen_at TIMESTAMPTZ DEFAULT now()",
                "ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS source_name TEXT DEFAULT 'curated'",
                "ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS salary_min NUMERIC",
                "ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS salary_max NUMERIC",
                "ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS salary_currency TEXT DEFAULT 'JMD'",
                "ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS image_url TEXT",
            ]:
                await db.execute(text(col_sql))
            await db.commit()
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning("Opportunities table migration failed (non-fatal): %s", e)

    # Start the background opportunity scraper scheduler
    from app.services.scheduler import get_scheduler
    scheduler = get_scheduler()
    scheduler.start()
    yield
    # Shutdown
    await scheduler.stop()
    await engine.dispose()


app = FastAPI(
    title="Lynks API",
    description="Career platform backend — roadmap generation, portfolio, job discovery",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS — allow frontend origins
# In production, set CORS_ORIGINS env var to your frontend URL(s), comma-separated
_DEFAULT_ORIGINS = "http://localhost:3000,https://lynks-gen-ai.web.app,https://lynks-frontend.web.app"
cors_origins_str = os.getenv("CORS_ORIGINS", _DEFAULT_ORIGINS)
cors_origins = [o.strip() for o in cors_origins_str.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Security headers — add before rate limiting so they apply to all responses
app.add_middleware(SecurityHeadersMiddleware)

# Rate limiting — LLM endpoints: 10/min, auth: 20/min, default: 60/min
app.add_middleware(RateLimitMiddleware)

# ── Register routers ───────────────────────────────────────────────────────
# Each router handles one feature area (see API_CONTRACT.md for endpoints).

# Profile
app.include_router(profile_router)

# Roadmap — NEW (Career Architect agent)
app.include_router(roadmap_router)

# Portfolio — NEW (Portfolio Manager agent)
app.include_router(portfolio_router)

# Opportunities — Job Scout agent
app.include_router(opportunities_router)

# Resume
app.include_router(resume_router)

# Chat — Mentor-Orchestrator agent (has access to all other agents)
app.include_router(chat_router)


# Memory — long-term user facts
app.include_router(memory_router)

# Notifications — in-app notification center
app.include_router(notifications_router)

# Dashboard — aggregation endpoint for home screen
app.include_router(dashboard_router)

# ── Health check ───────────────────────────────────────────────────────────


@app.get("/health")
async def health():
    return {"status": "ok"}
