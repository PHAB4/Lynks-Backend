"""Lynks Backend — FastAPI entry point."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.app.api.routes.roadmap import router as roadmap_router
from backend.app.db.postgres import engine


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    await engine.dispose()


app = FastAPI(
    title="Lynks API",
    description="Career platform backend",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Register routers ───────────────────────────────────────────────────────

# Profile (your existing router — keep as-is)
# from backend.app.api.routes.profile import router as profile_router
# app.include_router(profile_router)

# Roadmap — Career Architect agent
app.include_router(roadmap_router)

# Future routers (uncomment as you build them):
# from backend.app.api.routes.portfolio import router as portfolio_router
# from backend.app.api.routes.resume import router as resume_router
# from backend.app.api.routes.opportunities import router as opportunities_router
# from backend.app.api.routes.chat import router as chat_router


@app.get("/health")
async def health():
    return {"status": "ok"}