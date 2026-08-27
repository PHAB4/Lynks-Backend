# Lynks Tech Stack

> **Last updated:** August 22, 2026

---

## Backend

| Component | Technology | Version |
|-----------|-----------|---------|
| Language | Python | 3.11+ |
| Web framework | FastAPI | latest |
| ORM | SQLAlchemy (async) | 2.x |
| Database driver | asyncpg | latest |
| Auth | Supabase Auth (JWT verification) | — |
| LLM | Groq (OpenAI-compatible API) | Llama 3 8B |
| LLM SDK | OpenAI Python SDK | latest |
| File storage | Supabase Storage | — |
| Validation | Pydantic v2 | — |

## Database

| Component | Technology |
|-----------|-----------|
| PostgreSQL host | Supabase (AWS us-west-2) |
| Connection | Pooler mode (port 5432) |
| ORM | SQLAlchemy with UUID primary keys |
| Auth | Supabase Auth (auth.users + triggers) |
| Storage | Supabase Storage (public `evidence` bucket) |
| RLS | Row Level Security on all tables |

## Frontend ( teammate's responsibility )

| Component | Technology |
|-----------|-----------|
| Framework | Next.js (React) |
| Auth SDK | @supabase/supabase-js |
| UI | TBD by frontend dev |

## Infrastructure

| Component | Hosting |
|-----------|---------|
| Backend | TBD (Railway / Render / Fly.io) |
| Database | Supabase Cloud (free tier) |
| Storage | Supabase Storage (free tier) |
| Frontend | TBD |

## AI / LLM

| Component | Details |
|-----------|---------|
| Provider | Groq (OpenAI-compatible endpoint) |
| Model | openai/gpt-oss-120b |
| Base URL | https://api.groq.com/openai/v1 |
| Use cases | Roadmap generation, chat responses, resume generation, opportunity extraction |
| Response time | 5-15 seconds per call |

## Currency Detection System

The scraper uses a **priority-based lookup table** (`_CURRENCY_TABLE`) to detect currencies from salary text. Detection priority:

1. **Explicit 3-letter ISO codes** in the text (e.g. "JMD $500,000", "EUR 50,000") — highest confidence
2. **Unambiguous symbols** (€, £, ¥, ₹, ₩, ฿) — second priority
3. **Source context** — if text has bare `$` and the source is Jamaican → JMD, Trinidadian → TTD, etc.
4. **Bare `$` fallback** → USD (only when no source context available)

**Supported currencies (22+):** JMD, TTD, BBD, BSD, KYD, XCD, GYD, SRD, HTG, DOP, USD, EUR, GBP, CAD, AUD, NZD, CHF, JPY, CNY, INR, BRL, MXN, KRW, THB.

**Source-context detection** maps source names to local currencies:
- `_SOURCE_CURRENCY_MAP` — exact matches (e.g. `rss_jamaica_gleaner` → JMD)
- `_SOURCE_CURRENCY_KEYWORDS` — keyword matches (e.g. "trinidad" in source name → TTD)

### Conversation Memory Strategy

**Current:** Load last 3 conversation summaries into mentor context.
**Proposed:** Hybrid sliding window + summarization (see below).
**Future:** Add vector database (pgvector) for semantic search of past conversations.

### Vector Database for Embedding Search (Future)

| Component | Recommended | Notes |
|-----------|------------|-------|
| Vector DB | Supabase pgvector | Already on Supabase — enable the extension |
| Embedding model | text-embedding-3-small or Groq embedding | Fast, cheap |
| Use case | Search past conversations by similarity | "What did I ask about scholarships?" |

**pgvector setup (when ready):**
```sql
CREATE EXTENSION IF NOT EXISTS vector;
ALTER TABLE conversations ADD COLUMN embedding vector(1536);
CREATE INDEX ON conversations USING ivfflat (embedding vector_cosine_ops);
```

## Key Design Decisions

1. **UUID everywhere** — every primary key is UUID, not auto-increment
2. **snake_case everywhere** — field names, table names, endpoints
3. **Async throughout** — FastAPI + SQLAlchemy async + asyncpg
4. **Supabase for everything** — Auth, Database, Storage (no self-hosted services)
5. **LLM via OpenAI SDK** — compatible with any OpenAI-format API (Groq, OpenAI, Impala)
6. **No LangChain/CrewAI** — agents are self-contained Python modules
