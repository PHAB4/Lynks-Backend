"""
Lynks Backend — FastAPI entry point.

This file registers every router. When you add a new route file in api/routes/,
import and include it here.
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.middleware import RateLimitMiddleware, SecurityHeadersMiddleware

from app.api.routes.chat import router as chat_router
from app.api.routes.memory import router as memory_router
from app.api.routes.notifications import router as notifications_router
from app.api.routes.opportunities import router as opportunities_router
from app.api.routes.portfolio import router as portfolio_router
from app.api.routes.profile import router as profile_router
from app.api.routes.resume import router as resume_router
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

# CORS — allow frontend origins
import os
cors_origins_str = os.getenv("CORS_ORIGINS", "http://localhost:3000")
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

# Profile
app.include_router(profile_router)

# Roadmap — Career Architect agent
app.include_router(roadmap_router)

# Portfolio — Portfolio Manager agent
app.include_router(portfolio_router)

# Opportunities — Job Scout agent
app.include_router(opportunities_router)

# Resume
app.include_router(resume_router)

# Chat — Mentor-Orchestrator agent
app.include_router(chat_router)

# Memory — long-term user facts
app.include_router(memory_router)

# Notifications
app.include_router(notifications_router)


@app.get("/health")
async def health():
    return {"status": "ok"}
