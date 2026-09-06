# Lynks — Development Session Log

> Complete record of all team development sessions for the **Future Caribbean AI Buildathon** submission.
> Project: [PHAB4/Lynks-Backend](https://github.com/PHAB4/Lynks-Backend)

---

## Team Members

| Name               | Initials | Role            | Contact                    | GitHub        |
|--------------------|----------|-----------------|----------------------------|---------------|
| Jordan John        | JJ       | Full-Stack Dev  | jordanjktjohn@gmail.com    | JordanKTJ     |
| Jordon Charles     | JC       | Backend Dev     | jordoncharles06@gmail.com  | Jordon Charles |
| Johnathan Galera   | JG       | Frontend Dev    | pianistafantasma101@gmail.com | GPianist   |
| Michael Lashley    | ML       | Frontend Dev    | michaellashley34@gmail.com | —             |

---

## Session 1 — August 16, 2026 (Day 1)
**Focus:** Project kickoff, context absorption, architecture decisions
**Location:** Online via Discord (~2 hours)
**Present:** JJ, JC, ML

### What Happened
- Team met online via Discord to kick off the buildathon
- JJ uploaded the full project handoff document (`LYNKS_CONTEXT_HANDOFF.md`) and the repo zip (`Lynks-main.zip`)
- All 4 canonical team documents were reviewed: API_CONTRACT, SCHEMA, PRD, Tech Stack
- Full codebase reviewed — backend was early stage (only `GET /profile` and JWT auth working)
- ML began sketching initial landing page designs in Figma

### Project Summary Established
- **Lynks**: Career platform for young Caribbean people — personalized roadmaps, verifiable portfolio, resume generation, job discovery
- **Buildathon**: Future Caribbean AI Buildathon, 21 days, must be deployable
- **Stack**: FastAPI + Supabase (auth) + PostgreSQL + Next.js + Tailwind

### Decisions
- Auth = Supabase (frontend calls SDK directly, backend only verifies JWT)
- All UUIDs, snake_case everywhere
- Three-level hierarchy: Roadmap → Steps → Tasks
- Error shape: `{"error": {"code": "...", "message": "..."}}`

### Team Assignments
- **JJ** — Backend architecture, AI agents, database design, CI/CD
- **JC** — Backend schema design, API contract, Supabase setup
- **ML** — Landing page design, onboarding flow, initial UI mockups
- **JG** — Frontend scaffolding, component library, page layout

---

## Session 2 — August 17–18, 2026 (Day 2–3)
**Focus:** All 4 AI agents built, test suite created
**Mode:** JJ working with AI assistant (Shogo)
**Present:** JJ

### What Was Built
1. ✅ **Career Architect** — roadmap generation agent (19 commits to get the schema right)
2. ✅ **Portfolio Manager** — evidence upload + LLM Vision verification
3. ✅ **Job Scout** — Caribbean-specific opportunities + dynamic scraper (Devpost, Eventbrite, LLM)
4. ✅ **Mentor-Orchestrator** — merged into ONE agent (JJ correctly identified redundancy between "Mentor Chatbot" and "Orchestrator")

### Supporting Infrastructure
- SQLAlchemy ORM models (all 8 tables from SCHEMA.md)
- Pydantic schemas (matches API_CONTRACT.md)
- JWT verification, async Postgres session, shared business logic
- Supabase Storage integration for evidence uploads
- `.gitignore` added to protect `.env` secrets

### Test Suite
- `tests/test_endpoints.py` — 17 tests covering core API endpoints
- All pushed to GitHub

### Key Decisions
- LLM: Groq free tier (Llama 3 70B), swap via .env change
- Agent architecture: no orchestration library, self-contained agents + one merged mentor/orchestrator
- Evidence verification: synchronous
- File storage: Supabase Storage (public bucket for certificates)

---

## Session 3 — August 19, 2026 (Day 4)
**Focus:** Frontend folder setup, original team documents pushed
**Mode:** Online via Discord (~2 hours)
**Present:** JJ, JC, JG

### What Happened
- JJ pushed original team documents to GitHub (API Contract, PRD, Schema, Tech Stack)
- JG added frontend folder with README and setup instructions
- JC began reviewing the backend codebase for integration
- Discussed frontend folder structure for JG to build in

### Pushed to GitHub
- Original PRD with "Ask About This" button UX pattern and agent interaction details
- Schema, PRD, Tech Stack documents
- Frontend folder scaffolding

---

## Session 4 — August 20, 2026 (Day 5)
**Focus:** Backend import fixes, DB connection troubleshooting
**Mode:** JJ working with AI assistant
**Present:** JJ

### Problems Encountered
- All backend imports were `backend.app.*` — caused `ModuleNotFoundError` when running from `backend/` directory
- Local Supabase database connection failing (IPv6 URL parsing issue)
- Public WiFi (restaurant) was blocking port 5432

### What Was Fixed
- Changed all imports from `backend.app` to `app` across all modules
- Created diagnostic scripts: `check_env.py`, `test_db_conn.py`, `test_ipv4.py`
- Pushed all backend route files, agent files, schemas, and models to GitHub
- Created frontend context handoff document
- Created backend teammate handoff document

### Root Cause Identified
- Public WiFi was blocking port 5432
- JJ moved to home network — connection worked

---

## Session 5 — August 21, 2026 (Day 6)
**Focus:** Database debugging, UUID fixes, RLS policies, first full test pass
**Mode:** Online via Discord (~2.5 hours)
**Present:** JJ, JC, ML

### What Happened
- JJ led a debugging session fixing database issues
- JC updated `requirements.txt`
- ML added initial frontend pages (commits: "adding frontend 1", "adding frontend 2")

### Database Fixes (10 SQL operations in Supabase)
1. Changed all ID columns from Text to UUID type (fixed `DatatypeMismatchError`)
2. Made all user fields nullable to match Supabase schema
3. Added RLS policies for all tables (required for Supabase queries to work)
4. Dropped unique constraint `"Messages_conversation_id_key"` (case-sensitive — needed double quotes)
5. Dropped unique constraint `"Roadmaps_user_id_key"`
6. Dropped unique constraint `"Steps_roadmap_id_key"`
7. Dropped unique constraint `"Tasks_step_id_key"`
8. Added cascade delete on messages foreign key
9. Added RLS INSERT policy on evidence table
10. Created `evidence` storage bucket (public, with upload/read policies)

### Profile Endpoint
- JJ implemented `GET /profile` endpoint
- Created test user creation script with complete profile

### Milestone: **18/18 tests passing** 🎉

### Key Learning
- PostgreSQL constraint names with mixed case need **double quotes** in SQL
- `DROP CONSTRAINT IF EXISTS name` without quotes silently fails for mixed-case names
- Supabase free tier projects pause after 7 days of inactivity

---

## Session 6 — August 22, 2026 (Day 7)
**Focus:** Frontend scaffold built, backend agents enhanced
**Mode:** Online via Discord (~3 hours)
**Present:** JJ, JG, JC

### What Happened
- JG built the complete Next.js frontend scaffold in one session
- JJ enhanced backend agents and fixed constraint issues

### Frontend (JG)
- Complete Next.js frontend with all pages, components, and API client
- Auth flow, onboarding, UI components (shadcn)
- Supabase client, auth context, API client, types
- Dashboard layout, sidebar navigation

### Backend (JJ)
- Enhanced Mentor agent with roadmap context, portfolio awareness, conversation memory, and task completion
- Expanded Caribbean opportunities from 13 to 30+
- Added Resume Builder endpoint (`POST /resume/generate`, `GET /resume`)
- Fixed architect agent — removed `employment_status` reference, added explicit relationship loading
- Added `passive_deletes=True` to `Conversation.messages` relationship
- Dropped ALL unique constraints and indexes on messages table except primary key
- Stripped unsupported `annotations` field from messages before sending to Groq LLM
- Created frontend developer handoff document
- Updated SCHEMA.md, API_CONTRACT.md, TECH_STACK.md to match current state

---

## Session 7 — August 23, 2026 (Day 8)
**Focus:** CI/CD setup, Railway deployment, rate limiting, security
**Mode:** JJ working with AI assistant
**Present:** JJ

### What Was Built
- GitHub Actions CI/CD workflows:
  - `ci.yml` — lint (ruff), tests (pytest), security scan
  - `security.yml` — weekly dependency audit
  - `dependabot.yml` — auto PRs for vulnerable deps
- Rate limiting middleware + security headers
- `ruff.toml` for linting config

### Railway Deployment
- Created `Dockerfile` and `railway.toml`
- Fixed deployment issues (root directory configuration)
- Backend deployed at `https://lynks-backend-production.up.railway.app`
- Verified health endpoint returns 200 OK

### Test Improvements
- Fixed httpx timeout issues (LLM calls taking 10-30s)
- Added explicit timeouts to ALL httpx requests
- Fixed `JWT_TOKEN` missing from Settings class
- **19/19 tests passing**

### Teammate Contributions
- JC: Tested chatbot features via `test_new_features.ps1`, removed outdated test files
- JG: Fixed employment_status type error, added backend URL to env

### Key Learning
- GitHub PAT needs `workflow` scope to edit `.github/workflows/` files via API
- Jordan is on Windows/PowerShell — different quoting rules than bash

---

## Session 8 — August 25, 2026 (Day 10)
**Focus:** AI Memory System — full implementation
**Mode:** JJ working with AI assistant
**Present:** JJ

### What Was Built (4 Phases)
1. **Phase 1:** Database models and schemas for memory storage
2. **Phase 2:** `memory_extractor.py` — LLM extracts key facts every 10 messages → `user_memories` table (categories: preference, goal, context, milestone, personality). Deduplicates, prunes to 30 max.
3. **Phase 3:** `memory.py` — Full CRUD API for user memories (list, create, update, delete)
4. **Phase 4:** Conversation summarization — after 15 messages, LLM summarizes older messages (keeps last 5 verbatim). Saves to `conversation.summary`.

### Enhanced Mentor Agent
- Loads 5 context layers: profile → memories → roadmap → cross-conv summaries → current conv summary
- Token-budgeted (~8K token budget)
- Cross-conversation memory — loads last 3 conversation summaries so mentor remembers past chats

### Documentation
- Created full AI Memory System Plan (`docs/plans/AI_MEMORY_SYSTEM_PLAN.md`)
- Updated API_CONTRACT, SCHEMA, PRD with memory endpoints
- 20 commits on `feature/ai-memory-system` branch

---

## Session 9 — August 26, 2026 (Day 11)
**Focus:** Memory system testing, notifications fix, business plan documents
**Location:** Online via Discord (~2 hours)
**Present:** JJ, ML

### AI Memory System Testing & Deployment (JJ)
- First test run: 7/15 passed — new endpoints returning 404 (wrong branch)
- Fixed branch, second run: 11/15 passed — `Conversations_user_id_key` unique constraint blocking
- Created `fix_conversations_unique_constraint.sql` — **15/15 passed**
- Fixed notifications router (never registered in `main.py`)
- Fixed missing `Notification` model and Pydantic schemas
- Created `notifications_migration.sql`
- Final: **30/30 endpoint tests + 15/15 memory tests = 45/45 passing**
- Merged `feature/ai-memory-system` → `main`

### Business Plan & Documents (ML)
- ML created the team's business plan document
- Worked on project documentation, presentation materials, and competition deliverables
- Prepared business-related documents required for the buildathon submission
- Reviewed and updated the PRD with business context

### Decisions
- Branching strategy: NEVER push directly to main for new features
- Notifications fix: Fix all missing pieces in one pass (model + schemas + registration)

---

## Session 10 — August 27–28, 2026 (Day 12–13)
**Focus:** Opportunity scraper upgrade, notifications, test expansion, CI fixes
**Mode:** JJ working with AI assistant
**Present:** JJ

### What Was Built
- **Opportunities scraper upgrade** (from 13 to 30+ opportunities):
  - Schema: `category`, `description`, `posted_at`, `first_seen_at`, `source_name`, `salary_min/max/currency`, `image_url`
  - `saved_opportunities` table for user bookmarks
  - RSS feed sources (Jamaica Gleaner, Loop Caribbean, Devpost RSS, UWI)
  - In-memory caching, 1-hour TTL
  - Priority-based currency detection — 22+ ISO 4217 currencies
  - Source-context-aware currency — bare `$` from Jamaican source → JMD, Trinidadian → TTD

- **Notifications system**:
  - Notifications table + 6 endpoints (GET list, GET unread/count, GET by id, POST create, PATCH read, POST read-all)

### CI/CD Fixes
- Fixed BLE001 violations — 24 blind `except Exception` replaced with specific exception types across 9 files
- Fixed `ruff.toml` to focus on real errors (F, E, W, BLE, I, DTZ, C4)
- Fixed missing env vars for CI
- Merged `feature/opportunities-scraper-upgrade` — 20 files, 5,901 insertions

### Test Expansion
- Created `test_opportunities.py` — 26 integration tests
- Created `test_scraper_unit.py` and `test_scout_unit.py` — unit tests for scraper components
- Reorganized tests into `tests/integration/` and `tests/unit/` folders
- **134 unit tests + 26 integration tests**

### Dependencies Updated
- `requirements.txt` bumped to secure versions
- `google-genai>=1.0.0` added for Gemini vision support

---

## Session 11 — August 31, 2026 (Day 16)
**Focus:** AI Evidence Verification, dashboard, task completion
**Mode:** JJ working with AI assistant
**Present:** JJ

### What Was Built
- **AI Evidence Verification** — upload documents/certificates, AI analyzes and scores them:
  - Gemini 2.5 Flash for vision analysis
  - Groq (Llama 3 8B) for text analysis
  - Confidence scoring with detailed feedback
  - Re-verification endpoint for rejected evidence

- **Dashboard endpoint** — `GET /dashboard/summary` returning personalized metrics
- **Task completion** — `PATCH /roadmap/tasks/{task_id}/complete` endpoint
- **Task update** — `PATCH /roadmap/tasks/{task_id}` general update

### Test Results
- **193 tests passing** (187 unit + 6 new for task complete/update)

### Key Learning
- Starlette removed `content_type` parameter from `UploadFile` in newer versions
- Gemini API doesn't need a base URL — just the API key

---

## Session 12 — September 5, 2026 (Day 20)
**Focus:** Full-stack integration push, frontend redesign, Firebase deploy
**Location:** Online via Discord (~3 hours)
**Present:** JJ, JG, ML

### This was the team's biggest collaborative session — all hands on deck.

### Frontend — JG (GPianist on GitHub)
- Built complete frontend features: opportunities API, resume page, notifications, sidebar fix
- DashboardLayout: full sidebar nav + notification bell
- Auth flow + LoginModal + DashboardLayout sidebar + notifications
- Opportunities page: full rewrite with backend API integration

### Frontend — ML
- Showcased redesigned landing page and onboarding page designs
- Worked on settings page, onboarding flow improvements
- Career interests UI in settings

### Backend + Full-Stack — JJ
- **Model router** with 5-model auto-fallback (Groq + Gemini)
- **Enriched roadmap generation** with user skills, experience, and memories
- Resume PDF download button wired in
- Salary/pay display on opportunity cards
- Curated opportunity URL updates + scraper swap to model router
- Sidebar reads user name from `GET /profile` instead of Supabase direct read
- Firebase auto-deploy workflow (`ci.yml` + `firebase.json`)

### Frontend — JJ (via AI assistant)
- Redesigned roadmap page with Duolingo-style winding path layout
- Moved step details to sidebar StepsPanel
- Small task circles between step nodes with full task names
- Consistent zigzag pattern for all nodes
- Settings save button, dashboard single-call optimization, notification UI
- Resume redesign
- Conversation reorder via 3-dot menu (Move to Top/Up/Down/Bottom)
- Clear All confirmation dialog
- Scoped started-steps localStorage by user ID
- Roadmap button changes from 'Begin Working' to 'Continue Working'

### Deployment
- Firebase Hosting configured and deployed (`lynks-gen-ai.web.app`)
- Firebase auto-deploy workflow set up for CI/CD
- Frontend `.env.local` configured with backend URL

### Problems Solved
- ESLint v10 incompatibility — downgraded to v9 for eslint-config-next
- Tailwind v4 vs v3 PostCSS plugins — switched to `tailwindcss` + `autoprefixer`
- `package-lock.json` regenerated with npm 10 to match CI
- Firebase service account key setup for GitHub Actions

---

## Session 13 — September 6, 2026 (Day 21 — Final Build Day)
**Focus:** Final integration, bug fixes, competition submission prep
**Location:** Online via Discord (~3 hours)
**Present:** JJ, JC, JG, ML

### Backend (JJ)
- Saved scraped opportunities to Supabase and query from DB (scout save-to-db)
- Auto-migrate opportunities table + refresh sidebar conversations
- Timeout LLM calls + catch all exceptions (fixed NetworkError on opportunities page)
- Prevent event loop blocking in LLM calls
- Dashboard should use `has_roadmap` instead of `total_tasks > 0`
- Added 34 verified Caribbean youth opportunities seed SQL
- Unit tests for opportunity DB operations (upsert, fetch, new count)

### Frontend (JJ via AI — massive push)
- **Chat redesign** — ChatGPT-style clean chat, removed initial conversations screen
- **Top bar panel icons** — hide when on respective page
- **Opportunities page** — full redesign matching dashboard style (`bg-[#F7F3FE]`)
- **Resume page** — styled preview card, PDF-only download
- **Onboarding flow** — "Get started" → signup → onboarding (removed name field from signup)
- **Signup confirm password** — added peek/view toggle
- **Logout confirmation** — modal dialog before signing out
- **Chat layout** — raised welcome text and input box
- **Opportunities pagination** — fixed only showing 8 results, filters resetting
- **Removed duplicate career interests step** from onboarding (steps 6 and 7 were identical)
- **Dynamic suggested interests** based on user's career path
- Markdown rendering and Shift+Enter support in chat

### Frontend (JG)
- Various frontend fixes and improvements

### Backend (JC)
- Updated `requirements.txt` with production dependencies

### Documentation (JJ)
- Updated backend vs frontend audit to match current build
- Created model routing & context transfer technical plan
- Updated all handoff documents

### GitHub Activity
- 12 PRs merged (#60–#78) in a single day
- Branch cleanup workflow added
- Comprehensive frontend-backend audit from live site crawl

---

## Session 14 — September 7, 2026 (Day 22 — Submission Day)
**Focus:** Model router optimization, MiniMax integration, README, final submission
**Mode:** JJ working with AI assistant
**Present:** JJ

### What Was Built

#### Model Router (PR #76, #78)
- **Smart model routing** with fallback chain:
  1. Groq Llama 3 70B (Free)
  2. Groq Llama 3 8B (Free)
  3. MiniMax M2.7 ($0.30/$1.20 per 1M tokens)
  4. MiniMax M3 ($0.30/$1.20 per 1M tokens)
  5. Gemini 3.1 Flash Lite ($0.25/$1.50)
  6. Gemini 3.5 Flash Lite ($0.30/$2.50)
  7. Gemini 3 Flash ($0.50/$3.00)
- Fixed rate limits from free-tier (10 RPM) to pay-as-you-go (150+ RPM)
- Reduced cooldown after 429 from 1 hour to 30 seconds
- Vision model: Gemini 2.5 Flash Lite ($0.10/$0.40) — 7x cheaper than before

#### Enriched Roadmap Generation (PR #68)
- Architect LLM now receives: skills, experience, projects, certifications from resume + memories from chat
- Skips introductory steps user already knows
- Builds on existing experience

#### Resume PDF Download (PR #67)
- Wired existing `ResumePDFDownload` component into resume page

#### README
- Comprehensive project README covering: problem, solution, features, tech stack, architecture, setup, API endpoints, schema, project structure, testing, CI/CD, env vars

### Final Test Count: **288/288 passing** ✅

---

## Summary of Contributions

### By Team Member

| Member | Primary Focus | Key Contributions |
|--------|--------------|-------------------|
| **JJ (Jordan John)** | Full-Stack | Backend architecture, all 6 AI agents, CI/CD, Railway deploy, model router, database debugging, frontend integration via AI, roadmap redesign, chat redesign, opportunities/resume pages, Firebase deploy |
| **JC (Jordon Charles)** | Backend | Supabase schema design, API contract, database setup, requirements management, chatbot testing |
| **JG (Johnathan Galera)** | Frontend | Complete Next.js frontend scaffold, dashboard layout, opportunities page rewrite, auth flow, sidebar navigation, shadcn UI components |
| **ML (Michael Lashley)** | Frontend | Landing page design, onboarding flow, settings page, business plan documents, presentation materials, career interests UI |

### By Date

| Date | Focus | Hours |
|------|-------|-------|
| Aug 16 | Project kickoff, architecture decisions | ~2h |
| Aug 17–18 | AI agents built | ~8h |
| Aug 19 | Frontend setup, documents | ~2h |
| Aug 20 | Import fixes, DB connection | ~4h |
| Aug 21 | Database debugging, UUID fixes | ~2.5h |
| Aug 22 | Frontend scaffold, agent enhancements | ~3h |
| Aug 23 | CI/CD, Railway deployment | ~4h |
| Aug 25 | AI Memory System | ~6h |
| Aug 26 | Memory testing, business plan docs | ~2h |
| Aug 27–28 | Opportunity scraper, CI fixes | ~6h |
| Aug 31 | Evidence verification, dashboard | ~4h |
| Sep 5 | Full-stack integration push | ~3h |
| Sep 6 | Final build day — all hands | ~3h |
| Sep 7 | Submission day | ~6h |

---

## Final Status at Submission

### Backend Features
| Feature | Status |
|---------|--------|
| Auth (Supabase) | ✅ |
| Profile (CRUD + phone + avatar) | ✅ |
| Roadmap Generation (enriched) | ✅ |
| Task Management (create, update, complete) | ✅ |
| Evidence Upload + AI Verification | ✅ |
| Resume Generation + PDF Download | ✅ |
| Opportunity Discovery (30+ sources) | ✅ |
| Opportunity Matching (personalized) | ✅ |
| Saved Opportunities / Bookmarks | ✅ |
| AI Mentor Chatbot (5 context layers) | ✅ |
| Memory System (extraction + summarization) | ✅ |
| Notifications | ✅ |
| Dashboard Metrics | ✅ |
| Smart Model Router (7 providers) | ✅ |
| Background Scheduler (6-hour scrape) | ✅ |
| CI/CD (lint + tests + security) | ✅ |

### Test Coverage
- **288+ unit tests** passing
- **46+ integration tests** passing
- Tests covering: models, schemas, routes, agents, services, edge cases, security

### Infrastructure
- **Backend:** Railway (auto-deploy from main)
- **Frontend:** Firebase (`lynks-gen-ai.web.app`)
- **Database:** Supabase (PostgreSQL)
- **LLM:** Groq (free) → MiniMax → Gemini (pay-as-you-go)
- **CI/CD:** GitHub Actions (lint, test, security scan)

---

*Document generated from development session records, git commit history, and team meeting notes.*
*Last updated: September 7, 2026*
