# Lynks Backend — Agent Handoff Document
**Last updated:** August 23, 2026
**Project:** Lynks Backend (Caribbean Career Mentor AI)
**Repo:** https://github.com/PHAB4/Lynks-Backend
**Supabase:** https://qcyxyunngbkupttcwlbk.supabase.co

---

## Project Overview

Lynks is a **Caribbean-focused career mentorship platform** for young people. Users sign up, answer onboarding questions, and get a personalized AI-generated career roadmap. A mentor chatbot (Llama 3 8B via Groq) guides them through their journey, tracks progress, and connects them with Caribbean opportunities.

**Tech Stack:**
- **Backend:** FastAPI + SQLAlchemy async + Supabase (PostgreSQL + Auth + Storage) + Groq LLM
- **LLM Model:** `openai/gpt-oss-120b` via Groq (configured in `.env` as `LLM_MODEL`)
- **Auth:** Supabase Auth (JWT tokens, not session-based)
- **Database:** Supabase PostgreSQL (NOT local SQLite)
- **Storage:** Supabase Storage (evidence bucket, public)
- **No LangChain/CrewAI** — agents are self-contained Python modules

---

## What's Working (All 18 Core Tests Passing ✅)

| Endpoint | Method | Status | Notes |
|----------|--------|--------|-------|
| `/health` | GET | ✅ | Server health check |
| `/auth/signup` | POST | ✅ | Creates Supabase Auth user + DB user (trigger) |
| `/profile` | GET | ✅ | Returns user profile |
| `/profile` | PATCH | ✅ | Updates name, age, country, education, interests |
| `/profile/career-path` | PATCH | ✅ | Updates career_path field |
| `/roadmap/generate` | POST | ✅ | LLM generates roadmap (5-6 steps, 10-20 tasks) |
| `/roadmap` | GET | ✅ | Returns active roadmap with steps and tasks |
| `/roadmap/regenerate` | POST | ✅ | Deactivates old roadmap, creates new one |
| `/tasks/{task_id}/evidence` | POST | ✅ | Uploads file to Supabase Storage, saves record |
| `/portfolio` | GET | ✅ | Returns completed tasks with evidence |
| `/opportunities` | GET | ✅ | Returns 30+ Caribbean opportunities |
| `/opportunities?category=X` | GET | ✅ | Filters by category (competition, job, etc.) |
| `/chat/message` | POST | ✅ | Creates conversation, LLM responds, saves messages |
| `/chat/history` | GET | ✅ | Retrieves message history for conversation |
| `/chat/history` | DELETE | ✅ | Deletes all conversations and messages |
| 404 handling | GET | ✅ | Returns proper 404 for nonexistent routes |
| 401 handling | GET | ✅ | Returns 401 without valid JWT |
| 400 handling | GET | ✅ | Returns 400 for invalid category filter |

---

## What's Also Working (3 New Features ✅)

| Feature | Endpoint | Status | Notes |
|---------|----------|--------|-------|
| Resume Builder | `POST /resume/generate` | ✅ | LLM generates structured resume from profile + portfolio + roadmap |
| Resume Builder | `GET /resume` | ✅ | Returns user's latest resume |
| Enhanced Mentor | `POST /chat/message` | ✅ | Now knows user's roadmap, progress, portfolio, past conversations |
| Expanded Opportunities | `GET /opportunities` | ✅ | 30+ opportunities across 5 categories and 8+ Caribbean countries |

---

## Database Schema (Supabase)

### Tables
- **users** — id (uuid), email, name, age, country, education_level, career_path, interests (jsonb), supabase_auth_id (uuid, unique), created_at, updated_at
- **roadmaps** — id (uuid), user_id (uuid FK→users), career_path (text), is_active (bool), created_at
- **steps** — id (uuid), roadmap_id (uuid FK→roadmaps), title (text), description (text), "order" (int), created_at
- **tasks** — id (uuid), step_id (uuid FK→steps), title (text), description (text), status (text), completed_at (timestamptz), "order" (int), created_at
- **evidence** — id (uuid), task_id (uuid FK→tasks), user_id (uuid FK→users), file_url (text), file_type (text), file_name (text), verification_status (text DEFAULT 'pending'), uploaded_at (timestamptz DEFAULT now()), created_at
- **conversations** — id (uuid), user_id (uuid FK→users), created_at
- **messages** — id (uuid), conversation_id (uuid FK→conversations), role (text), content (text), tool_calls (json), created_at
- **resumes** — id (uuid), user_id (uuid FK→users), content (jsonb), created_at, updated_at (DEFAULT now())

### Storage Buckets
- **evidence** — public, with INSERT/SELECT policies for all users

### Key RLS Policies
- Users can CRUD their own data (roadmaps, steps, tasks, conversations, messages)
- Users can upload/read their own evidence files
- Evidence storage bucket is public (anyone can upload/read)

### Important SQL Fixes Applied (in Supabase SQL Editor)
1. Dropped unique constraints: `Messages_conversation_id_key`, `Roadmaps_user_id_key`, `Steps_roadmap_id_key`, `Tasks_step_id_key`
2. Added `career_path` (text) to roadmaps table
3. Added `"order"` (integer DEFAULT 0) to tasks table
4. Added `uploaded_at` (timestamptz DEFAULT now()) to evidence table
5. Added `updated_at` (timestamptz DEFAULT now()) to resumes table
6. Added cascade delete on messages foreign key
7. Created evidence storage bucket (public)
8. Added RLS INSERT/SELECT policies on evidence table
9. Added storage policies for evidence bucket (public upload + read)

---

## Architecture: Routes vs Agents

| Layer | What it does | Location |
|-------|-------------|----------|
| **Routes** (HTTP layer) | Receive requests, extract JWT, call agents, return JSON | `app/api/routes/*.py` |
| **Agents** (business logic) | LLM calls, DB queries, AI intelligence | `app/agents/*.py` |

**Request flow:**
```
Frontend → Route (extract user_id from JWT) → Agent (do the work) → Route (return JSON) → Frontend
```

### Routes
- `routes/profile.py` — GET/PATCH /profile, PATCH /profile/career-path, POST /resume/generate, GET /resume
- `routes/roadmap.py` — POST /roadmap/generate, GET /roadmap, POST /roadmap/regenerate
- `routes/portfolio.py` — GET /portfolio, POST /tasks/{task_id}/evidence
- `routes/opportunities.py` — GET /opportunities (with optional category filter)
- `routes/chat.py` — POST /chat/message, GET /chat/history, DELETE /chat/history
- `routes/auth.py` — POST /auth/signup

### Agents
- `agents/architect.py` — Career roadmap generation (LLM + DB)
- `agents/mentor.py` — **Main conversational agent** (orchestrator + chat). Knows user's full context (profile, roadmap, portfolio, past conversations). Can call other agents as tools (generate_roadmap, get_portfolio, find_opportunities, complete_task)
- `agents/scout.py` — Opportunity discovery (currently hardcoded list of 30+ Caribbean opportunities)
- `agents/portfolio_manager.py` — Portfolio management, evidence upload, resume generation

---

## Known Issues & Gotchas

### Windows-specific
- **curl doesn't work well on Windows** — use PowerShell `Invoke-RestMethod` or Swagger UI at `http://localhost:8000/docs` (local) or `https://lynks-backend-production.up.railway.app/docs` (production) instead
- **Unicode rendering** — Windows terminal may garble special characters (â, à, ō) — this is a display issue, not a code bug
- **Test file corruption** — If `test_endpoints.py` shows `name 'headers' is not defined`, the file was corrupted. Fix: `git fetch origin main && git checkout origin/main -- backend/tests/test_endpoints.py`

### Code-specific
- **`annotations` field** — Groq's API doesn't support the `annotations` field in messages. The mentor agent uses `_sanitize_messages()` to strip it before sending to the LLM. If you modify the mentor, always pass messages through `_sanitize_messages()`.
- **Interests field** — Stored as JSONB in Supabase, may come back as a string or list. The mentor handles both cases with `isinstance()` checks.
- **LLM calls are slow** — Roadmap generation and chat messages take 5-15 seconds. Set httpx timeout to 30-60 seconds in tests.
- **`model_dump()` includes extra fields** — OpenAI SDK's `choice.message.model_dump()` includes `annotations`, `function_call`, etc. that Groq doesn't support. Always sanitize before sending to LLM.

### Supabase-specific
- **PostgreSQL constraint names with mixed case need double quotes** — e.g., `DROP CONSTRAINT IF EXISTS "Messages_conversation_id_key"`
- **Supabase free tier pauses after 7 days of inactivity**
- **RLS policies must be explicit** — every table needs INSERT/SELECT/UPDATE/DELETE policies for the `authenticated` role
- **Storage buckets need separate policies** from database RLS

---

## Test Files

### `tests/test_endpoints.py` (18 core tests)
- Tests every CRUD endpoint in order
- Auto-creates a fresh test user for each run
- Run: `python tests/test_endpoints.py`

### `tests/test_new_features.ps1` (3 new feature tests)
- Tests resume generation, enhanced mentor, and expanded opportunities
- Requires a JWT token from `create_test_user.py`
- Run: `powershell -ExecutionPolicy Bypass -File tests/test_new_features.ps1`

---

## What We Built in This Session

1. **Fixed 10 Supabase schema mismatches** (unique constraints, missing columns, RLS policies, storage bucket)
2. **Fixed 6 code bugs** (profile route, main.py registration, db_models nullable fields, test_endpoints rewrite, architect agent, conversation passive_deletes)
3. **Enhanced Mentor** — now knows user's roadmap (with steps/tasks/progress), portfolio (completed tasks + evidence), past conversations (last 3 summaries), and can mark tasks complete from chat
4. **Expanded Opportunities** — from 13 hardcoded to 30+ across competition, job, club, scholarship, event, volunteer categories and 8+ Caribbean countries
5. **Resume Builder** — POST /resume/generate creates structured resume from profile + portfolio + roadmap using LLM; GET /resume retrieves it
6. **Fixed Groq annotations error** — added `_sanitize_messages()` to strip unsupported fields before LLM calls
7. **Pushed all fixes to GitHub** — repo is up to date

---

## What's Next (Priority Order)

### Competition-ready enhancements
1. **Mentor with roadmap context** ✅ DONE
2. **More opportunities** ✅ DONE
3. **Resume builder** ✅ DONE
4. **Conversation memory** ✅ DONE (last 3 conversation summaries loaded into mentor context)
5. **Evidence AI verification** — AI analyzes uploaded images to verify task completion (not yet built)
6. **Notifications** — Deadline reminders, new opportunity alerts (not yet built)

### Real web scraping (see docs/SCRAPER_PLAN.md)
- **Phase 1:** RSS feeds from Caribbean news sites (Jamaica Gleaner, Loop Caribbean, Devpost, UWI) — reliable, structured data
- **Phase 2:** Web scraping from job boards (CaribbeanJobs, JEF, ScholarshipScanada) — more complete but fragile
- **Fallback:** Curated hardcoded list (always works)
- **Strategy:** Try RSS first → if fail, try scraping → if fail, return curated list

### Future improvements
- Conversation summarization (instead of last-3 limit) — summarize each conversation into 2-3 sentences when it ends
- Vector database (pgvector on Supabase) for embedding-based conversation search
- Full web scraping for live opportunity data
- Resume download as PDF
- Evidence verification (AI-powered image analysis)

---

## Running the Server

```powershell
# Start server (in one terminal)
uvicorn app.main:app --reload --port 8000

# Run core tests (in another terminal)
python tests/test_endpoints.py

# Run new feature tests (get token first)
python tests/create_test_user.py
# Copy token, paste into test_new_features.ps1
powershell -ExecutionPolicy Bypass -File tests/test_new_features.ps1

# Open Swagger UI (browser)
# https://lynks-backend-production.up.railway.app/docs
```

---

## File Structure

```
backend/
├── app/
│   ├── agents/
│   │   ├── architect.py      # Roadmap generation (LLM)
│   │   ├── mentor.py         # Main chatbot orchestrator (LLM + tools)
│   │   ├── opportunity_scraper.py  # UNUSED (was for scraping)
│   │   ├── portfolio_manager.py    # Portfolio + resume generation
│   │   └── scout.py          # Opportunity discovery
│   ├── api/routes/
│   │   ├── auth.py           # POST /auth/signup
│   │   ├── chat.py           # POST /chat/message, GET/DELETE /chat/history
│   │   ├── opportunities.py  # GET /opportunities
│   │   ├── portfolio.py      # GET /portfolio, POST /tasks/{id}/evidence
│   │   ├── profile.py        # GET/PATCH /profile, PATCH /profile/career-path, resume endpoints
│   │   └── roadmap.py        # POST /roadmap/generate, GET /roadmap, POST /roadmap/regenerate
│   ├── core/
│   │   ├── config.py         # Settings (env vars)
│   │   └── security.py       # JWT auth helpers
│   ├── db/
│   │   └── postgres.py       # Database engine + session (echo=True for debugging)
│   ├── models/
│   │   ├── db_models.py      # SQLAlchemy models
│   │   └── schemas.py        # Pydantic schemas
│   ├── sql/                  # SQL fix scripts
│   └── main.py               # FastAPI app + router registration
├── tests/
│   ├── create_test_user.py   # Creates test user, prints token
│   ├── test_endpoints.py     # 18 core endpoint tests
│   └── test_new_features.ps1 # 3 new feature tests (PowerShell)
├── .env.example              # Required env vars template
├── requirements.txt          # Python dependencies
└── docs/
    ├── API_CONTRACT.md       # All endpoints with request/response examples
    ├── SCHEMA.md             # Full database schema (matches Supabase exactly)
    ├── SCRAPER_PLAN.md       # Web scraping architecture plan
    └── TECH_STACK.md         # Stack choices and design decisions
```

Also at repo root:
- `LYNKS_CONTEXT_HANDOFF_V2.md` — Previous handoff document
- `BACKEND_HANDOFF.md` — Original handoff document
- `FRONTEND_HANDOFF.md` — Complete guide for frontend developer
- `LYNKS_HANDOFF.md` — This document
