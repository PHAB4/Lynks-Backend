"""
Lynks Backend — FastAPI entry point.

This file registers every router. When you add a new route file in api/routes/,
import and include it here.

NOTE: Your existing main.py only registers the profile router.
This is the UPDATED version that adds the roadmap router.
Copy the roadmap router registration into your existing main.py.
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes.chat import router as chat_router
from app.api.routes.opportunities import router as opportunities_router
from app.api.routes.portfolio import router as portfolio_router
from app.api.routes.roadmap import router as roadmap_router
from app.db.postgres import engine


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    await engine.dispose()


app = FastAPI(
    title="Lynks API",
    description="Career platform backend — roadmap generation, portfolio, job discovery",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS — allow the Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Next.js dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Register routers ───────────────────────────────────────────────────────
# Each router handles one feature area (see API_CONTRACT.md for endpoints).

# Profile (your existing router — keep as-is)
# from app.api.routes.profile import router as profile_router
# app.include_router(profile_router)

# Roadmap — NEW (Career Architect agent)
app.include_router(roadmap_router)

# Portfolio — NEW (Portfolio Manager agent)
app.include_router(portfolio_router)

# Opportunities — Job Scout agent
app.include_router(opportunities_router)

# Chat — Mentor-Orchestrator agent (has access to all other agents)
app.include_router(chat_router)

# Future routers (uncomment as you build them):
# from app.api.routes.resume import router as resume_router


# ── Health check ───────────────────────────────────────────────────────────


@app.get("/health")
async def health():
    return {"status": "ok"}