# Lynks Backend — Context Handoff Document

## Project Overview

Lynks is an **AI-powered career accelerator for Caribbean youth**. The backend is a Python FastAPI server with 4 AI agents, connected to Supabase (Postgres + Auth + Storage) and Groq (LLM).

**Repository:** https://github.com/PHAB4/Lynks-Backend
**Backend directory:** `backend/`
**Branch:** `main`

---

## What's Already Built

### 4 AI Agents (all in `backend/app/agents/`)

| Agent | File | What it does |
|-------|------|-------------|
| **Career Architect** | `architect.py` | Generates personalized career roadmaps via LLM. Takes user profile → calls Groq API → saves roadmap to DB |
| **Portfolio Manager** | `portfolio_manager.py` | Verifies evidence of task completion (certificates, photos) using LLM Vision |
| **Job Scout** | `scout.py` | Discovers Caribbean-specific opportunities (competitions, jobs, clubs, scholarships, events, volunteer). Has a curated list + LLM-based matching |
| **Mentor-Orchestrator** | `mentor.py` | Unified chatbot. Has access to all 3 other agents via tool-calling. Decides when to call an agent vs answer directly |

### Opportunity Scraper (`opportunity_scraper.py`)
- Pulls opportunities from Devpost API + LLM generation
- Needs to be run periodically (cron job) for fresh data

### API Routes (in `backend/app/api/routes/`)

| File | Prefix | Endpoints |
|------|--------|----------|
| `roadmap.py` | `/roadmap` | `POST /generate`, `GET /`, `POST /regenerate` |
| `portfolio.py` | `/` | `POST /tasks/{task_id}/evidence`, `GET /portfolio` |
| `opportunities.py` | `/opportunities` | `GET /?category=...` |
| `chat.py` | `/chat` | `POST /message`, `GET /history`, `DELETE /history` |

### Infrastructure

| File | What it does |
|------|-------------|
| `main.py` | FastAPI entry point, registers all routers, CORS, health check |
| `core/config.py` | Loads `.env` vars (Supabase, Postgres, LLM) |
| `core/security.py` | JWT verification via Supabase |
| `db/postgres.py` | Async SQLAlchemy session |
| `models/db_models.py` | SQLAlchemy ORM (users, roadmaps, steps, tasks, evidence, resumes, conversations, messages) |
| `models/schemas.py` | Pydantic request/response schemas |
| `services/common.py` | Shared helpers (get_user_or_404, compute_step_status) |
| `services/storage.py` | Supabase Storage file upload/delete |

### Tests

| File | What it does |
|------|-------------|
| `tests/test_endpoints.py` | 16 endpoint tests (health, auth, roadmap, portfolio, opportunities, chat, error handling) |
| `tests/check_env.py` | Checks all env vars load, tests DB connection, tests LLM connection |
| `tests/test_db_conn.py` | Raw socket connection test to Supabase |

---

## Environment Variables (`.env`)

```
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
DATABASE_URL=postgresql+asyncpg://postgres:password@db.xxxxx.supabase.co:5432/postgres
LLM_API_BASE_URL=https://api.groq.com/openai/v1
LLM_API_KEY=your-groq-api-key
LLM_MODEL=openai/gpt-ss-20b
```

**IMPORTANT:** The LLM model is `openai/gpt-ss-20b`. The old Llama models (`llama3-70b-8192`, `llama-3.3-70b-versatile`) have been decommissioned by Groq.

---

## Known Issues

### 1. Database Connection (CRITICAL)

The server boots, the LLM works, but **the database connection fails with `[Errno 11001] getaddrinfo failed`**.

**Root cause:** The Supabase hostname `db.qcyxyunngbkupttcwlbk.supabase.co` only resolves to an IPv6 address (`2600:1f14:359d:9302:fe9a:4201:217b:1e4e`). The backend dev's machine/network cannot connect via IPv6 (`WinError 10051 — unreachable network`).

**What's been tried:**
- DNS resolution works via `nslookup` but Python's `socket.getaddrinfo` fails
- `sslmode=require` breaks asyncpg (asyncpg doesn't accept sslmode as URL param)
- Direct IPv6 address in URL causes URL parsing errors
- Hosts file entry was suggested but not yet confirmed working
- Network was identified as public restaurant WiFi which likely blocks IPv6 + non-web ports

**What needs to happen:**
- Test on an unrestricted network (home WiFi, mobile hotspot)
- If IPv6 is the issue, may need to configure asyncpg to use IPv4-only or force IPv4 resolution
- Alternative: check if Supabase has an IPv4 endpoint available

### 2. Test Results (with JWT token)

With a valid JWT token, the test results were:
- **5 passed:** health, 404 handling, auth enforcement, invalid category validation
- **11 failed:** All due to database connection errors (500s)
- **LLM:** Working ✅

### 3. Missing Pieces

| Item | Status |
|------|--------|
| Notification system | Not built — needs to match new opportunities to user profiles and alert them |
| Resume builder | Schema exists (`resumes` table) but no agent or routes |
| Opportunity scraper scheduling | Needs cron job or background worker for periodic execution |
| Supabase Storage bucket | Needs `evidence` bucket created as public in Supabase Dashboard |
| Supabase trigger | Teammate already created the `auth.users → public.users` sync trigger |

---

## How to Run

```bash
cd backend
python -m venv venv
source venv/bin/activate    # Mac/Linux
venv\Scripts\activate       # Windows
pip install -r requirements.txt
pip install httpx python-multipart

# Fill in .env (copy from .env.example)

# Start server
uvicorn app.main:app --reload --port 8000

# In another terminal — run diagnostics
python tests/check_env.py

# Run full test suite (needs JWT token in test file)
python tests/test_endpoints.py
```

---

## Key Design Decisions

1. **LLM uses OpenAI SDK** pointed at Groq's API — swap provider by changing `.env` (URL + key + model name)
2. **Step status is computed** from child tasks ("complete" only if ALL tasks complete)
3. **Evidence verification is synchronous** — user waits for LLM to check the file
4. **Opportunity matching is rule-based**, not AI — profile fields matched against opportunity metadata
5. **Mentor-Orchestrator is ONE agent** — not separate router + assistant. It has personality + tool access
6. **All imports use `from app.xxx`** (not `from backend.app.xxx`) — the server runs from inside `backend/` directory
7. **Original PRD decisions are documented** — see `docs/ORIGINAL_PRD.md` for what the team decided before backend work began

---

## What Needs to Be Done Next

1. **Fix the database connection** — test on unrestricted network, resolve IPv6 issue
2. **Run the full test suite** — get all 16 tests passing
3. **Build the notification system** — match opportunities to users, create notification records
4. **Build the resume builder** — agent + routes for the `resumes` table
5. **Set up opportunity scraper scheduling** — cron job or Supabase Edge Function
6. **Create the `evidence` bucket** in Supabase Storage

---

## Docs Reference

| Doc | Path | What it covers |
|-----|------|---------------|
| PRD | `docs/PRD.md` | Full product requirements with all decisions |
| API Contract | `docs/API_CONTRACT.md` | Every endpoint shape |
| Schema | `docs/SCHEMA.md` | Database tables and relationships |
| Original PRD | `docs/ORIGINAL_PRD.md` | Team's original decisions |
| Tech Stack | `docs/TECH_STACK.md` | Stack summary |

---

## How to Use Shogo for This Project

1. Connect Shogo to repo: `https://github.com/PHAB4/Lynks-Backend.git`
2. Set working directory to `backend/`
3. The `.env` file needs to be created locally (it's gitignored)
4. Copy `.env.example` → `.env` and fill in real values
5. The server auto-rebuilds when files change (uvicorn `--reload`)
6. Read `docs/API_CONTRACT.md` before making any API changes
7. Do NOT edit `server.tsx` or `src/generated/` — this is a raw FastAPI project, not a Shogo-generated one

---

## Contact

Backend developer: PHAB4 on GitHub
Frontend developer: Separate Shogo workspace connected to the same repo (working in `frontend/`)
