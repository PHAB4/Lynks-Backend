# Lynks Tech Stack

> **Last updated:** August 27, 2026

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
| HTTP client | httpx (RSS feeds, social media scraping) |
| Multipart forms | python-multipart (file uploads) |

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

## Scraper Sources

| Source | Type | Auth Required | Notes |
|--------|------|---------------|-------|
| Devpost | API | No | Hackathons |
| Eventbrite | API | No | Caribbean tech events |
| Jamaica Gleaner | RSS | No | Caribbean news/jobs |
| Loop Caribbean | RSS | No | Caribbean news |
| Devpost RSS | RSS | No | Hackathon feeds |
| UWI News | RSS | No | University opportunities |
| Facebook | Public scraping | No | Stretch goal |
| Instagram | Public scraping | No | Stretch goal (fragile) |
| Curated List | Hardcoded | No | Permanent fallback (17 Caribbean opportunities) |
| LLM Generation | AI | Yes (Groq) | Generates opportunities from training data |

## Key Design Decisions

1. UUID everywhere — every PK is UUID, not auto-increment
2. snake_case everywhere — fields, tables, endpoints
3. Async throughout — FastAPI + SQLAlchemy async + asyncpg
4. Supabase for everything — Auth, Database, Storage
5. LLM via OpenAI SDK — compatible with any OpenAI-format API
6. No LangChain/CrewAI — agents are self-contained Python modules
7. In-memory caching — 1-hour TTL for scraped opportunities, no Redis
8. Offset pagination — simple page/limit, cursor pagination deferred post-competition
9. Opportunities are curated + scraped — not stored in a dedicated DB table
10. Graceful scraper failure — each source returns [] on error, curated list is permanent fallback
