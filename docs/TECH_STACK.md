# Lynks Tech Stack

> **Last updated:** August 22, 2026

---

## Backend

| Component | Technology |
|-----------|------------|
| Language | Python 3.11+ |
| Web framework | FastAPI |
| ORM | SQLAlchemy (async) |
| Database driver | asyncpg |
| Auth | Supabase Auth (JWT verification) |
| LLM | Groq (OpenAI-compatible API, Llama 3 8B) |
| LLM SDK | OpenAI Python SDK |
| File storage | Supabase Storage |
| Validation | Pydantic v2 |

## Database

| Component | Technology |
|-----------|------------|
| PostgreSQL | Supabase Cloud (AWS us-west-2) |
| Connection | Pooler mode (port 5432) |
| Auth | Supabase Auth (auth.users + triggers) |
| Storage | Supabase Storage (public evidence bucket) |
| RLS | Row Level Security on all tables |

## Frontend (teammate's responsibility)

| Component | Technology |
|-----------|------------|
| Framework | Next.js (React) |
| Auth SDK | @supabase/supabase-js |
| UI | TBD by frontend dev |

## AI / LLM

| Component | Details |
|-----------|--------|
| Provider | Groq |
| Model | llama3-8b-8192 |
| Endpoint | https://api.groq.com/openai/v1 |
| Response time | 5-15 seconds |

## Key Design Decisions

1. UUID everywhere — every PK is UUID, not auto-increment
2. snake_case everywhere — fields, tables, endpoints
3. Async throughout — FastAPI + SQLAlchemy async + asyncpg
4. Supabase for everything — Auth, Database, Storage
5. LLM via OpenAI SDK — compatible with any OpenAI-format API
6. No LangChain/CrewAI — agents are self-contained Python modules
