# Lynks Tech Stack

> **Last updated:** September 5, 2026

---

## Backend

| Component | Technology | Version |
|-----------|-----------|---------|
| Language | Python | 3.11+ |
| Web framework | FastAPI | latest |
| ORM | SQLAlchemy (async) | 2.x |
| Database driver | asyncpg | latest |
| Auth | Supabase Auth (JWT verification) | — |
| LLM (text) | Groq (OpenAI-compatible API) | openai/gpt-oss-120b |
| LLM (vision) | Google AI Studio (Gemini 3.5 Flash) | free tier |
| LLM SDK (text) | OpenAI Python SDK | latest |
| LLM SDK (vision) | google-genai | latest |
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

## CI/CD & Code Quality

| Component | Tool | Configuration |
|-----------|------|---------------|
| Linter | Ruff | `.github/workflows/ci.yml` — runs on every push/PR to `main` |
| Formatter | Ruff format | `.github/workflows/ci.yml` — enforces consistent code style |
| Type checker | Mypy | `.github/workflows/ci.yml` — catches type errors before merge |
| Test runner | Pytest | `.github/workflows/ci.yml` — runs 160 tests with PostgreSQL service container |
| Dependency audit | pip-audit | Both `ci.yml` (every push) and `security.yml` (weekly) |
| Security linter | Bandit | `.github/workflows/ci.yml` — catches common security anti-patterns |
| Secret scanner | Gitleaks | `.github/workflows/security.yml` — weekly scan for committed secrets |
| Dependency updates | Dependabot | `.github/dependabot.yml` — auto-creates PRs for new versions |

### CI Pipeline (`ci.yml`)

```
Push/PR to main
  ├── Lint & Type Check
  │   ├── ruff check (linting — BLE001, F, E, W rules)
  │   ├── ruff format --check (formatting)
  │   └── mypy --ignore-missing-imports (type checking)
  ├── Tests
  │   └── pytest (134 unit + 26 integration tests, PostgreSQL service container)
  └── Security Scan
      ├── pip-audit (dependency vulnerabilities)
      └── bandit (security linting — non-blocking)
```

### Weekly Security Pipeline (`security.yml`)

```
Monday 6 AM UTC (schedule)
  ├── Dependency Audit
  │   └── pip-audit on full dependency list
  ├── Secret Scan
  │   └── gitleaks detect (scans for committed secrets)
  └── Notify (extensible)
```

### Linting Rules

Ruff is configured in `backend/ruff.toml` with focused rules:
- **F** — Pyflakes (unused imports, undefined names)
- **E** — pycodestyle errors (indentation, whitespace)
- **W** — pycodestyle warnings
- **BLE001** — Blind exception catching (replaced 24 bare `except Exception` with specific types)
- **I** — Import sorting
- **DTZ** — DateTime timezone awareness
- **C4** — Comprehension suggestions

### Dependabot

- Checks `backend/requirements.txt` **daily** for pip dependency updates
- Checks `.github/workflows/` **weekly** for GitHub Actions updates
- Auto-creates PRs with changelog links and compatibility scores
- Can be limited via `open-pull-requests-limit` in `.github/dependabot.yml`

## AI / LLM

| Component | Details |
|-----------|---------|
| **Text Provider** | Groq (OpenAI-compatible endpoint) |
| **Text Model** | openai/gpt-oss-120b |
| **Text Base URL** | https://api.groq.com/openai/v1 |
| **Text Use Cases** | Roadmap generation, chat responses, resume generation, opportunity extraction |
| **Text Response Time** | 5-15 seconds per call |
| **Vision Provider** | Google AI Studio (google-genai SDK) |
| **Vision Model** | gemini-3.5-flash |
| **Vision Free Tier** | 10 RPM, 250K TPM, 1,500 RPD, $0 cost |
| **Vision Use Cases** | Evidence verification (certificates, screenshots, badges) |
| **Vision SDK** | google-genai (Google's official Python SDK) |
| **Note** | Impala/Highrise AI gateway is no longer accessible — all LLM calls go directly to Groq or Google AI Studio |

### Task Management
- Tasks can be completed via `PATCH /roadmap/tasks/{task_id}/complete` (REST) or through the Mentor chatbot
- Tasks can be updated (title, description, status) via `PATCH /roadmap/tasks/{task_id}` (partial update)
- Task status supports: `pending`, `in_progress`, `complete` — setting to "complete" auto-sets `completed_at`
- Endpoint validates ownership (task must belong to user's active roadmap)
- Step status is computed dynamically — completing the last pending task in a step marks that step as complete |

## Currency Detection System
### Profile Management
- `GET /profile` returns full user profile including `phone` and `avatar_url` fields
- `PATCH /profile` accepts partial updates (name, age, country, education_level, employment_status, phone, interests)
- Phone field is optional — nullable text column on `users` table
- Profile pictures supported via `POST /profile/avatar` (upload) + `DELETE /profile/avatar` (remove)
- Profile pictures stored in Supabase Storage bucket: `profile-pictures` (public, RLS-protected)

### Opportunity Matching
- `GET /opportunities/matches` — returns personalized matches using rule-based scoring (no LLM dependency)
- Scoring factors: career path (30 pts), education (20 pts), age eligibility (20 pts), interest alignment (15 pts), location match (15 pts)
- Only returns opportunities scoring ≥ 50, sorted by score descending
- `GET /opportunities` with `sort=relevance` applies rule-based scoring + LLM ranking
- `GET /opportunities/saved` now includes `relevance_score` for each saved opportunity
- Scoring engine: `backend/app/services/scoring.py` — pure functions, no DB, no network, no LLM


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
5. **Dual LLM providers** — Groq (text, OpenAI SDK) for chat/roadmap/resume + Google Gemini (vision, google-genai SDK) for evidence verification. Free tier on both.
6. **No LangChain/CrewAI** — agents are self-contained Python modules


### Dashboard Aggregation
- `GET /dashboard/summary` — single-call dashboard endpoint that aggregates profile, roadmap progress, opportunities, notifications, and onboarding state
- Reduces frontend round-trips from 4-5 separate API calls to 1
- Each section degrades gracefully — a failure in one section does not prevent others from returning
- No schema changes — data sourced from existing tables (`users`, `roadmaps`, `steps`, `tasks`, `notifications`, `conversations`)

