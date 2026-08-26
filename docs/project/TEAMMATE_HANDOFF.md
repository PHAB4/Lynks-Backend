# Lynks Backend — Teammate Handoff Document

**Created:** August 24, 2026  
**Author:** Jordan (project lead) + AI agent  
**Repo:** https://github.com/PHAB4/Lynks-Backend  
**Active Branch:** `feature/rate-limiting-security` (Railway deploys from this branch)  
**Production URL:** `https://lynks-backend-production.up.railway.app`  
**Supabase Dashboard:** https://supabase.com/dashboard → project `qcyxyunngbkupttcwlbk`

---

## 1. What Is Lynks?

Lynks is an **AI-powered career accelerator for Caribbean youth**. Users sign up, complete onboarding, and receive a personalized AI-generated career roadmap. A mentor chatbot (LLM via Groq) guides them, tracks progress, verifies achievements, and connects them with Caribbean opportunities.

**Target audience:** Young people in Jamaica, Trinidad, Barbados, and across the Caribbean.

**Tech stack:**
- **Backend:** FastAPI + SQLAlchemy async + Supabase (PostgreSQL + Auth + Storage) + Groq LLM
- **LLM Model:** Configurable via `LLM_MODEL` env var (currently `openai/gpt-ss-20b` via Groq)
- **Auth:** Supabase Auth (JWT tokens)
- **Database:** Supabase PostgreSQL (NOT local SQLite)
- **Storage:** Supabase Storage (`evidence` bucket, public)
- **No LangChain/CrewAI** — agents are self-contained Python modules
- **Deployment:** Railway (deploys from `feature/rate-limiting-security` branch)

---

## 2. Current Status (August 24, 2026)

### Test Results: 22/23 passing ✅

| # | Test | Status | Notes |
|---|------|--------|-------|
| 1 | GET /health | ✅ | Server healthy |
| 2 | POST /auth/v1/signup (get JWT) | ✅ | Auto-refreshes expired tokens |
| 3 | GET /profile (fresh user) | ✅ | Returns 200 with empty profile |
| 4 | PATCH /profile (fill career path) | ✅ | |
| 5 | PATCH /profile/career-path | ✅ | |
| 6 | POST /roadmap/generate | ✅ | LLM generates 5-6 steps |
| 7 | GET /roadmap (active roadmap) | ✅ | Returns all steps + tasks |
| 8 | POST /roadmap/regenerate | ✅ | Creates new, deactivates old |
| 9 | POST /tasks/{id}/evidence (upload) | ❌ | **500 error — see Section 6** |
| 10 | GET /portfolio (with evidence) | ✅ | |
| 11 | GET /opportunities | ✅ | 7+ opportunities returned |
| 12 | GET /opportunities?category=competition | ✅ | Filtering works |
| 13 | POST /chat/message (mentor chat) | ✅ | |
| 14 | POST /chat/message (mentor calls Job Scout) | ✅ | Tool-calling works |
| 15 | GET /chat/history | ✅ | |
| 16 | DELETE /chat/history | ✅ | |
| 17 | GET /nonexistent (404) | ✅ | |
| 18 | GET /roadmap without auth (401) | ✅ | |
| 19 | GET /opportunities?category=invalid (400) | ✅ | |
| 20 | PATCH /profile (employment_status) | ✅ | |
| 21 | GET /profile (employment_status persisted) | ✅ | |
| 22 | GET /health security headers | ✅ | All 6 headers present |
| 23 | Rate limiting | ✅ | Middleware working |

---

## 3. What We've Recently Built (This Session)

### A. Rate Limiting & Security Headers (feature/rate-limiting-security branch)
- **`app/middleware.py`** — NEW FILE
  - `RateLimitMiddleware`: 60 requests/minute per IP, returns 429 on burst
  - `SecurityHeadersMiddleware`: Adds 6 security headers (X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, Referrer-Policy, Strict-Transport-Security, Permissions-Policy)
- **`app/main.py`** — Updated to import and register both middleware

### B. Employment Status Support
- **`app/api/routes/profile.py`** — `ProfileUpdate` schema now includes `employment_status`
- **`app/models/db_models.py`** — `User` model has `employment_status` column
- Tests verify PATCH + GET persistence

### C. Auth Test Auto-Refresh
- **`tests/test_endpoints.py`** — Auth test now:
  1. Tries pre-supplied JWT from `.env`
  2. If expired, tries sign-in via Supabase API
  3. If user doesn't exist, signs up a new test user
- No more manual token regeneration needed

### D. Storage Upload Fix (IN PROGRESS)
- **`app/core/config.py`** — Added `supabase_admin` client using `SUPABASE_SERVICE_ROLE_KEY`
- **`app/services/storage.py`** — Updated to use `supabase_admin` instead of `supabase` for uploads
- Added detailed error logging to `upload_evidence_file()`
- **⚠️ Still returning 500 — see Section 6 for troubleshooting status**

### E. LLM Timeout Fixes
- All agent LLM calls have explicit timeouts (10-20 seconds)
- Fallback to keyword matching if LLM times out (scout.py)
- Test timeouts increased: `LLM_TIMEOUT = 60s`, mentor+scout test uses `120s`

### F. All Changes Synced to `main` Branch
- Railway was previously deploying from `main` — all 14 updated files were pushed there
- Railway now deploys from `feature/rate-limiting-security` instead

---

## 4. Important Decisions Made

### Branching Strategy (MANDATORY)
- **NEVER push directly to `main`** for new features or improvements
- Create feature branches for all non-critical changes
- Branch naming: `feature/<name>` or `fix/<name>`
- Only merge to main after testing and approval
- **Railway deploys from `feature/rate-limiting-security`**

### Architecture: Routes vs Agents
| Layer | What it does | Location |
|-------|-------------|----------|
| **Routes** (HTTP layer) | Receive requests, extract JWT from token, call agents, return JSON | `app/api/routes/*.py` |
| **Agents** (business logic) | LLM calls, DB queries, AI intelligence | `app/agents/*.py` |

**Request flow:**
```
Frontend → Route (extract user_id from JWT) → Agent (do the work) → Route (return JSON) → Frontend
```

### Auth Flow
1. User signs up/in via Supabase Auth API (not your backend)
2. Supabase returns a JWT access token
3. Frontend sends JWT in `Authorization: Bearer <token>` header
4. Backend's `security.py` verifies the JWT using `supabase.auth.get_user(token)`
5. Returns `user_id` which routes use for DB queries

### LLM Integration
- Uses OpenAI-compatible SDK pointing to Groq API
- All LLM calls go through `app/agents/*.py` — NOT through routes directly
- **Always sanitize messages before sending to LLM** — Groq doesn't support `annotations` field
- Agent timeout: 10 seconds per LLM call, with fallback to keyword matching

### Key Gotchas
- **`_sanitize_messages()` is mandatory** — if you modify the mentor agent, always pass messages through this function before sending to LLM
- **Interests field** — Stored as JSONB in Supabase, may come back as string or list. Handle both with `isinstance()` checks
- **LLM calls are slow** — 5-15 seconds. Always use explicit httpx timeouts (30-60s in tests)
- **PostgreSQL constraint names with mixed case need double quotes** — e.g., `DROP CONSTRAINT IF EXISTS "Messages_conversation_id_key"`
- **Supabase free tier pauses after 7 days of inactivity**

---

## 5. Database Schema

All tables use **UUID primary keys** and live in the `public` schema.

```
users ──< roadmaps ──< steps ──< tasks ──< evidence
users ──< resumes
users ──< conversations ──< messages
opportunities (standalone)
```

### Tables (abbreviated — see docs/reference/SCHEMA.md for full spec)

| Table | Key Fields | Notes |
|-------|-----------|-------|
| **users** | id, email, name, age, country, education_level, career_path, employment_status, interests (text[]) | FK → auth.users.id |
| **roadmaps** | id, user_id, career_path, is_active | Only one active per user |
| **steps** | id, roadmap_id, title, description, order | |
| **tasks** | id, step_id, title, description, status, order, completed_at | |
| **evidence** | id, task_id, user_id, file_url, file_type, verification_status | pending/verified/rejected |
| **resumes** | id, user_id, content (jsonb), updated_at | LLM-generated resume |
| **conversations** | id, user_id | |
| **messages** | id, conversation_id, role, content, tool_calls (json) | ON DELETE CASCADE |
| **opportunities** | id (text, not uuid), title, company, location, category | Hardcoded in agent, not in DB |

### Supabase Storage
- **Bucket:** `evidence` (public)
- Anyone can upload/read
- URL format: `https://qcyxyunngbkupttcwlbk.supabase.co/storage/v1/object/public/evidence/{filename}`

---

## 6. Current Issue: Evidence Upload 500 Error

### What's happening
`POST /tasks/{task_id}/evidence` returns 500 Internal Server Error.

### What we've tried
1. ✅ Added `supabase_admin` client in `config.py` using `SUPABASE_SERVICE_ROLE_KEY`
2. ✅ Updated `storage.py` to use `supabase_admin` instead of `supabase`
3. ✅ Added detailed error logging to `upload_evidence_file()`
4. ✅ Updated test to show full error detail
5. ✅ Verified code is on the feature branch and deployed
6. ✅ User confirmed `SUPABASE_SERVICE_ROLE_KEY` is set on Railway
7. ✅ User confirmed the `evidence` bucket exists with correct policies

### What to try next
1. **Check Railway deployment logs** — go to Railway → backend service → Deployments → latest → View Logs. Run the test and look for the `Storage upload failed:` log line
2. **Verify the key format** — the Supabase legacy `service_role` key (from the "Legacy anon, service_role API keys" tab) should start with `eyJ...`. If it starts with `sb_secret_...`, that's the new format and won't work with supabase-py v2.31.0
3. **Check if `SUPABASE_SERVICE_ROLE_KEY` env var name matches exactly** — the Pydantic Settings model uses `SUPABASE_SERVICE_ROLE_KEY: str = ""` as the field name. If Railway has a typo or different casing, it defaults to empty string → falls back to anon key
4. **Try using the anon key with user authentication** — instead of relying on service role, authenticate as a user and use their JWT for storage upload (since the bucket has public INSERT policies)

### Files involved
- `app/core/config.py` — lines 37-41 (supabase_admin client creation)
- `app/services/storage.py` — `upload_evidence_file()` function
- `app/api/routes/portfolio.py` — `POST /tasks/{task_id}/evidence` endpoint

---

## 7. What's Planned Next (Priority Order)

### Immediate (competition deadline)
1. ~~Mentor with roadmap context~~ ✅ DONE
2. ~~More opportunities (30+)~~ ✅ DONE
3. ~~Resume builder~~ ✅ DONE
4. ~~Conversation memory~~ ✅ DONE
5. ~~Rate limiting & security headers~~ ✅ DONE
6. ~~Employment status~~ ✅ DONE
7. **Evidence upload fix** — IN PROGRESS (see Section 6)
8. **Notifications system** — NOT BUILT (see Section 8)

### Post-competition improvements
- Real web scraping for live opportunity data (see `docs/plans/SCRAPER_PLAN.md`)
- Conversation summarization (instead of last-3 limit)
- Vector database (pgvector) for embedding-based conversation search
- Resume download as PDF
- AI-powered evidence verification improvements

---

## 8. Feature Plans in the Repo (READ THESE)

The repo contains detailed implementation plans in `docs/`. **Read these before starting any new feature:**

| File | What it covers | Status |
|------|---------------|--------|
| `docs/plans/SCRAPER_PLAN.md` | Hybrid RSS + scraping architecture for live opportunities | Draft |
| `docs/plans/OPPORTUNITIES_UPGRADE_PLAN.md` | Smart filtering, category metadata, mentor prompt updates | Draft |
| `docs/reference/API_CONTRACT.md` | All endpoint shapes (request/response) — **read this before building routes** | Current |
| `docs/reference/SCHEMA.md` | Full database schema (matches Supabase exactly) | Current |
| `docs/project/PRD.md` | Full product requirements document | Current |
| `docs/reference/TECH_STACK.md` | Stack choices and design decisions | Current |

### Notifications System (planned, not built)
- Create `notifications` table: id, user_id, type, title, body, read (bool), created_at
- Endpoints: `GET /notifications`, `POST /notifications/{id}/read`, `POST /notifications/read-all`
- Trigger: new matching opportunities → notification
- Trigger: roadmap milestone completed → congratulations notification
- **This is a great task for a teammate** — fully independent, new code, no conflict with existing work

### Opportunity Scraper Upgrade (see docs/plans/SCRAPER_PLAN.md)
- **Phase 1:** RSS feeds from Caribbean news sites (Jamaica Gleaner, Loop Caribbean, Devpost, UWI)
- **Phase 2:** Web scraping from job boards (CaribbeanJobs, JEF, ScholarshipScanada)
- **Fallback:** Curated hardcoded list (always works)
- **Strategy:** Try RSS first → if fail, try scraping → if fail, return curated list

### Opportunity Smart Filtering (see docs/plans/OPPORTUNITIES_UPGRADE_PLAN.md)
- Pre-filter opportunities based on user's profile (career_path, country, age)
- Return metadata: `available_categories`, `total_available`, `returned`
- Update API contract to include `category` as user-facing filter

---

## 9. API Endpoints Reference

**Base URL:** `https://lynks-backend-production.up.railway.app`  
**Auth:** `Authorization: Bearer <supabase_jwt_token>` (all except `/health`)

| Method | Endpoint | Description | Timeout |
|--------|----------|-------------|---------|
| GET | `/health` | Health check | — |
| GET | `/profile` | Get user profile | — |
| PATCH | `/profile` | Update profile fields | — |
| PATCH | `/profile/career-path` | Update career path | — |
| POST | `/roadmap/generate` | Generate career roadmap (LLM) | 5-15s |
| GET | `/roadmap` | Get active roadmap | — |
| POST | `/roadmap/regenerate` | Replace roadmap (LLM) | 5-15s |
| POST | `/tasks/{task_id}/evidence` | Upload evidence file | 5-10s |
| GET | `/portfolio` | Get tasks with evidence | — |
| GET | `/opportunities` | Get opportunities | — |
| GET | `/opportunities?category=X` | Filter by category | — |
| POST | `/chat/message` | Send message to mentor (LLM) | 5-15s |
| GET | `/chat/history` | Get conversation messages | — |
| DELETE | `/chat/history` | Clear all conversations | — |
| POST | `/resume/generate` | Generate resume (LLM) | 5-15s |
| GET | `/resume` | Get latest resume | — |

**Full request/response shapes:** see `docs/reference/API_CONTRACT.md`

---

## 10. File Structure

```
backend/
├── app/
│   ├── agents/
│   │   ├── architect.py          # Roadmap generation (LLM)
│   │   ├── mentor.py             # Main chatbot orchestrator (LLM + tools)
│   │   ├── opportunity_scraper.py # UNUSED (was for scraping)
│   │   ├── portfolio_manager.py  # Portfolio + resume + evidence verification
│   │   └── scout.py              # Opportunity discovery (30+ hardcoded)
│   ├── api/routes/
│   │   ├── auth.py               # POST /auth/signup
│   │   ├── chat.py               # POST /chat/message, GET/DELETE /chat/history
│   │   ├── opportunities.py      # GET /opportunities
│   │   ├── portfolio.py          # GET /portfolio, POST /tasks/{id}/evidence
│   │   ├── profile.py            # GET/PATCH /profile, resume endpoints
│   │   └── roadmap.py            # POST /roadmap/generate, GET /roadmap, POST /roadmap/regenerate
│   ├── core/
│   │   ├── config.py             # Settings (env vars), supabase clients
│   │   └── security.py           # JWT auth (get_current_user_id)
│   ├── db/
│   │   └── postgres.py           # Database engine + session
│   ├── models/
│   │   ├── db_models.py          # SQLAlchemy models
│   │   └── schemas.py            # Pydantic schemas
│   ├── services/
│   │   ├── common.py             # Shared helpers
│   │   └── storage.py            # Supabase Storage file uploads
│   ├── middleware.py              # Rate limiting + security headers (NEW)
│   └── main.py                   # FastAPI app + router registration
├── tests/
│   ├── create_test_user.py       # Creates test user, prints token
│   ├── test_endpoints.py         # 23 endpoint tests (auto-refreshes JWT)
│   └── test_new_features.ps1     # 3 new feature tests (PowerShell)
├── .env.example                  # Required env vars template
├── requirements.txt              # Python dependencies
└── railway.toml                  # Railway deployment config
```

**Also at repo root (not in backend/):**
- `docs/` — API contract, schema, PRD, tech stack, feature plans
- `LYNKS_HANDOFF.md` — Previous comprehensive handoff document
- `BACKEND_HANDOFF.md` — Original handoff document

---

## 11. How to Run

```powershell
# Start server (one terminal)
cd backend
uvicorn app.main:app --reload --port 8000

# Run tests (another terminal)
cd backend
python tests/test_endpoints.py

# Open Swagger UI (browser)
# Local: http://localhost:8000/docs
# Production: https://lynks-backend-production.up.railway.app/docs
```

### Environment Variables (.env)
```
SUPABASE_URL=https://qcyxyunngbkupttcwlbk.supabase.co
SUPABASE_ANON_KEY=<from Supabase dashboard — Legacy tab>
SUPABASE_SERVICE_ROLE_KEY=<from Supabase dashboard — Legacy tab, click Reveal>
SUPABASE_TOKEN=<your current JWT — test_endpoints.py auto-refreshes this>
DATABASE_URL=postgresql+asyncpg://postgres:...@db.qcyxyunngbkupttcwlbk.supabase.co:5432/postgres
LLM_API_BASE_URL=https://api.groq.com/openai/v1
LLM_API_KEY=<your Groq API key>
LLM_MODEL=openai/gpt-ss-20b
```

---

## 12. Platform Notes

- **Jordan is on Windows using PowerShell** — NOT bash/zsh
- PowerShell: use `Invoke-RestMethod` instead of `curl` for testing
- Swagger UI at `/docs` is the easiest way to test endpoints
- curl.exe needs escaped double quotes for JSON
- **GitHub PAT** stored in `credentials/github-pat.txt` — use for pushing large files via REST API (bypasses 12KB limit on GITHUB_COMMIT_MULTIPLE_FILES)

---

## 13. Contact

**Backend dev (Jordan):** PHAB4 on GitHub  
**Frontend dev:** Building UI in `frontend/` directory  
**Repo:** https://github.com/PHAB4/Lynks-Backend  
**Supabase project:** `qcyxyunngbkupttcwlbk`
