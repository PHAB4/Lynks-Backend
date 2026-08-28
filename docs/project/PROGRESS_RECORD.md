# Lynks Backend — Development Progress Record

**Last Updated:** August 28, 2026
**Prepared By:** Jordan (Project Lead) + Shogo AI Agent
**Branch:** `main`
**Total Tests:** 134 unit tests + 26 integration tests = 160 passing

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Session Log — August 25-26, 2026](#2-session-log)
3. [What Was Built](#3-what-was-built)
4. [Problems Encountered & Resolutions](#4-problems-encountered--resolutions)
5. [Key Decisions Made](#5-key-decisions-made)
6. [Database Changes Applied](#6-database-changes-applied)
7. [Test Results](#7-test-results)
8. [Files Changed Summary](#8-files-changed-summary)
9. [What Changed in Each Document](#9-what-changed-in-each-document)
10. [Current State](#10-current-state)
11. [What's Next](#11-whats-next)

---

## 1. Project Overview

**Lynks** is a Caribbean career mentorship platform powered by AI. The backend is built with FastAPI + SQLAlchemy async + Supabase (PostgreSQL + Auth + Storage) + OpenAI-compatible LLM (`openai/gpt-oss-120b`).

The system features 6 AI agents:
- **Mentor (Orchestrator)** — conversational career guide, routes to specialist agents
- **Career Architect** — generates personalized learning roadmaps
- **Job Scout** — discovers Caribbean opportunities (30+ curated)
- **Portfolio Manager** — tracks projects, evidence, AI-powered verification
- **Resume Builder** — generates professional resumes
- **Memory Extractor** — extracts key user facts from conversations (NEW — built this session)

---

## 2. Session Log

### August 25, 2026 — Planning & Implementation

| Time (est.) | Activity |
|---|---|
| Morning | Discovered LLM (openai/gpt-oss-120b) was rate-limited (429 — 199,993/200,000 tokens used). Pivoted to planning. |
| Morning | Researched how ChatGPT and Claude handle conversation history. Discovered the key insight: **Storage != Context** (all messages saved in DB, but only a subset sent to LLM per request). |
| Morning | Defined the **Three-Layer Loading Architecture** (sidebar titles -> messages -> LLM context) and **Hybrid Summarization** strategy. |
| Morning | Drafted the full AI Memory System Plan with 4 phases. |
| Midday | Pushed plan to GitHub `docs/AI_MEMORY_SYSTEM_PLAN.md`. |
| Afternoon | Created `feature/ai-memory-system` branch. |
| Afternoon | **Phase 1:** Extracted system prompt from hardcoded Python string to external `mentor_system.md` file. |
| Afternoon | **Phase 2:** Built long-term memory system — `UserMemory` model, `memory_extractor.py`, `memory.py` routes (GET/POST/PATCH/DELETE). |
| Afternoon | **Phase 3:** Built conversation history management — optimized context assembly, conversation summarization, `GET /chat/conversations`, `GET /chat/conversations/{id}`. |
| Afternoon | **Phase 4:** Added token budget management — `estimate_tokens()`, `MAX_CONTEXT_TOKENS=8000`, priority-based trimming. |
| Afternoon | Updated docs: SCHEMA.md, API_CONTRACT.md, PRD.md. |
| Afternoon | Created `test_ai_memory.py` test suite (15 tests). |

### August 26, 2026 — Testing, Debugging & Deployment

| Time (est.) | Activity |
|---|---|
| Morning | First test run: 7/15 passed, 8 skipped — all new endpoints returning 404. |
| Morning | **Diagnosis:** Tests running against `main` branch locally, but new code was on `feature/ai-memory-system`. User switched branches. |
| Morning | Second test run: 11/15 passed — `Conversations_user_id_key` unique constraint blocking multi-conversation support. |
| Morning | Created `fix_conversations_unique_constraint.sql` to drop the constraint. User ran it in Supabase. |
| Morning | Added pre-test cleanup and summary output to `test_ai_memory.py`. |
| Morning | Third test run: **15/15 passed** |
| Midday | Ran `test_endpoints.py` — 24/30 passed, 6 notification tests failed (404). |
| Midday | **Diagnosis:** `notifications.py` router existed but was never imported/registered in `main.py`. |
| Midday | Added notifications router import and registration to `main.py`. |
| Midday | Railway deploy crashed — `ImportError: cannot import name NotificationCreate from app.models.schemas`. |
| Midday | **Diagnosis:** Teammate created `notifications.py` routes but forgot to add `Notification` model to `db_models.py` and notification schemas to `schemas.py`. |
| Midday | Fixed: Added `Notification` model to `db_models.py`, added 3 Pydantic schemas to `schemas.py`, created `notifications_migration.sql`. |
| Midday | Fixed: Added `User.notifications` relationship and `Notification.user` back_populates. |
| Afternoon | User ran notifications SQL migration in Supabase (had to skip existing policies). |
| Afternoon | Final test run: **30/30 passed** (test_endpoints) + **15/15 passed** (test_ai_memory) |
| Afternoon | Merged `feature/ai-memory-system` -> `main`. |
| Afternoon | Deleted `feature/ai-memory-system` branch. |

---

## 3. What Was Built

### AI Memory System (4 Phases)

#### Phase 1: System Prompt Extraction
- **File:** `backend/app/agents/prompts/mentor_system.md` (NEW)
- **Change:** Moved mentor personality from hardcoded Python string to external markdown file
- **Benefit:** Anyone can edit the mentor personality without touching Python code
- **Impact:** Zero risk, no LLM needed, instant improvement in maintainability

#### Phase 2: Long-Term Memory
- **Model:** `UserMemory` in `db_models.py` — stores user facts (preference, goal, context, milestone, personality)
- **Extractor:** `memory_extractor.py` — LLM-powered extraction of key facts after conversations
- **Routes:** `memory.py` — GET/POST/PATCH/DELETE `/memory`
- **Benefit:** AI remembers the user across sessions. "You mentioned you prefer online learning..." becomes possible.
- **Token cost:** ~300 tokens per request for loading 20 memories

#### Phase 3: Conversation History Management
- **Optimized context:** Sends summary of old messages + last 10 messages verbatim (not full history)
- **Summarization:** Auto-summarizes conversations when they exceed 15 messages
- **Conversation list:** `GET /chat/conversations` returns all conversations for sidebar
- **Conversation messages:** `GET /chat/conversations/{id}` returns messages for a specific conversation
- **Benefit:** Users can see all past conversations. AI context stays compact. Token usage drops ~60%.

#### Phase 4: Token Budget Management
- **Token estimation:** `estimate_tokens()` — rough count based on character length
- **Budget cap:** `MAX_CONTEXT_TOKENS = 8000` (conservative for gpt-oss-120b)
- **Priority trimming:** System prompt > memories > roadmap > recent messages > summaries
- **Benefit:** Prevents context overflow even as memories and history grow

### Notifications System (Fixed)
- Registered `notifications.py` router in `main.py`
- Added `Notification` SQLAlchemy model to `db_models.py`
- Added `NotificationCreate`, `NotificationResponse`, `NotificationListResponse` Pydantic schemas
- Created `notifications_migration.sql` for Supabase
- Added `User.notifications` and `Notification.user` relationships

---

## 4. Problems Encountered & Resolutions

### Problem 1: Tests returning 404 for all new endpoints
- **Symptom:** Memory CRUD and conversation list endpoints all returned `{"detail":"Not Found"}`
- **Root cause:** Local server was running the `main` branch, but new code was on `feature/ai-memory-system`. Switching branches fixed it.
- **Lesson:** Always verify which branch you're on before testing. `git branch` shows current branch.

### Problem 2: `Conversations_user_id_key` unique constraint
- **Symptom:** `POST /chat/message` returned 500 with `UniqueViolationError: duplicate key value violates unique constraint "Conversations_user_id_key"`
- **Root cause:** Supabase had a UNIQUE constraint on `conversations.user_id`, meaning each user could only have ONE conversation. Our system needs multiple conversations per user.
- **Resolution:** Ran `ALTER TABLE conversations DROP CONSTRAINT IF EXISTS "Conversations_user_id_key";` in Supabase SQL Editor.
- **Note:** Similar constraints had already been dropped for Messages, Roadmaps, Steps, and Tasks — but this one was missed.
- **Lesson:** When creating tables in Supabase UI, it auto-adds unique constraints on FK columns. Always check and drop ones you don't need.

### Problem 3: Notifications tests failing (404)
- **Symptom:** All 6 notification endpoints returned 404 in `test_endpoints.py`
- **Root cause:** `notifications.py` router existed in `api/routes/` but was never imported or registered in `main.py`.
- **Resolution:** Added `from app.api.routes.notifications import router as notifications_router` and `app.include_router(notifications_router)` to `main.py`.
- **Lesson:** Creating a router file is not enough — it must be registered in `main.py` to be loaded by FastAPI.

### Problem 4: Railway deploy crash — ImportError
- **Symptom:** `ImportError: cannot import name 'NotificationCreate' from 'app.models.schemas'`
- **Root cause:** `notifications.py` imported `NotificationCreate`, `NotificationResponse`, `NotificationListResponse` from `schemas.py`, but those Pydantic models were never defined there.
- **Resolution:** Added the 3 missing schemas to `schemas.py`.
- **Lesson:** When building a new feature, create ALL required files (model, schemas, routes, SQL) together. Partial implementation causes cascading import errors.

### Problem 5: Railway deploy crash — Notification model missing
- **Symptom:** `notifications.py` service imports `Notification` from `db_models.py`, but the model didn't exist.
- **Root cause:** Teammate built the notifications feature in parts — routes and service first, forgot the model.
- **Resolution:** Added `Notification` SQLAlchemy model to `db_models.py` with proper relationships.
- **Lesson:** Always start with the data model. DB model -> schemas -> routes -> service is the correct order.

### Problem 6: OneDrive file locking
- **Symptom:** `git branch -d` repeatedly failed with "Deletion of directory .git/logs/refs/heads/feature failed" errors, asking to retry.
- **Root cause:** Projects stored under OneDrive (`C:\Users\jordo\OneDrive\Desktop\...`). OneDrive sync locks `.git` files, preventing Git from cleaning up.
- **Workaround:** Branch was deleted despite the warnings (Git confirmed "Deleted branch feature/rate-limiting-security"). Warnings are cosmetic.
- **Long-term fix:** Move projects outside OneDrive to avoid file locking issues.

### Problem 7: Groq rate limit (429)
- **Symptom:** `Error code: 429 - Rate limit reached for model openai/gpt-oss-120b. Limit 200000, Used 199993, Requested 4206`
- **Root cause:** Free tier daily token limit (200,000 tokens) fully consumed during testing.
- **Resolution:** Waited for daily reset. No code change needed.
- **Lesson:** Budget LLM usage during testing. Free tiers have aggressive limits.

### Problem 8: Supabase key format mismatch
- **Symptom:** Evidence upload returning 500 errors even after updating Supabase keys.
- **Root cause:** Supabase now has two key formats — new keys (`sb_secret_...`) don't work with the Python supabase SDK (v2.31.0). Must use legacy JWT-format keys (`eyJ...`).
- **Resolution:** Use the "Legacy anon, service_role API keys" tab in Supabase dashboard.
- **Lesson:** Check which SDK version you're using and which key format it supports.

### Problem 9: Notifications SQL migration "policy already exists"
- **Symptom:** Running the notifications migration in Supabase threw `ERROR: 42710: policy "Users can read own notifications" for table "notifications" already exists`
- **Root cause:** The notifications table and policies were already partially created (possibly by the teammate testing manually).
- **Resolution:** Only needed to run the index creation part since the table and policies already existed.
- **Lesson:** Use `IF NOT EXISTS` on policies, or check if table exists before running full migration.

---

## 5. Key Decisions Made

| Decision | Choice | Rationale |
|---|---|---|
| **Chat history strategy** | Hybrid Summarization (ChatGPT/Claude approach) | Industry standard. Store all, send subset. User sees everything, AI sees optimized context. |
| **Three-layer loading** | Sidebar (titles) -> Messages (per-chat) -> LLM context (optimized) | Prevents loading all conversations at once. Lazy-loading is fast and efficient. |
| **Memory extraction trigger** | After every 10 messages | Balances quality (enough context to extract) vs. cost (not too many LLM calls). |
| **Memory limit** | 20 facts per user | Prevents context bloat while capturing enough user information. |
| **Context budget** | 8,000 tokens max | Conservative cap for gpt-oss-120b (128K window). Leaves room for AI to think. |
| **Test file strategy** | Separate `test_ai_memory.py` vs. updating `test_endpoints.py` | Independence — memory tests can run separately. Easier to debug. Avoids merge conflicts. |
| **Notifications fix** | Fix all missing pieces in one pass | Teammate had partial implementation. Fixed model + schemas + registration together to avoid repeated deploy failures. |
| **Branch strategy** | Feature branch -> PR -> merge to main | Isolated development. Main always deployable. |

---

## 6. Database Changes Applied

### Via Supabase SQL Editor (Manual)

| Migration | What It Does |
|---|---|
| `ai_memory_migration.sql` | Adds `summary` column to `conversations`, creates `user_memories` table with RLS, drops `Conversations_user_id_key` unique constraint |
| `fix_conversations_unique_constraint.sql` | Drops `Conversations_user_id_key` if the migration didn't handle it |
| `notifications_migration.sql` | Creates `notifications` table with RLS policies and indexes |

### Table: `user_memories` (NEW)
```
id          UUID (PK, auto-generated)
user_id     UUID (FK -> users.id, CASCADE DELETE)
fact        TEXT NOT NULL
category    TEXT (default: "general") -- preference, goal, context, milestone, personality
source      TEXT (default: "conversation") -- conversation, profile, manual
created_at  TIMESTAMPTZ (default: now())
```

### Table: `notifications` (NEW)
```
id          UUID (PK, auto-generated)
user_id     UUID (FK -> users.id, CASCADE DELETE)
title       TEXT NOT NULL
body        TEXT
type        TEXT (default: "reminder")
link        JSONB
is_read     BOOLEAN (default: false)
created_at  TIMESTAMPTZ (default: now())
```

### Modified: `conversations` table
```
+ summary   TEXT (NEW -- stores compressed version of older messages)
```

### Dropped Constraints
```
"Conversations_user_id_key" UNIQUE constraint on conversations.user_id
```

---

## 7. Test Results

### test_endpoints.py — 30/30

| Section | Tests | Status |
|---|---|---|
| Authentication | 2/2 | PASS |
| Profile | 6/6 | PASS |
| Roadmap | 4/4 | PASS |
| Portfolio / Evidence | 4/4 | PASS |
| Opportunities | 2/2 | PASS |
| Resume | 2/2 | PASS |
| Notifications | 6/6 | PASS |
| Chat History | 4/4 | PASS |

### test_ai_memory.py — 15/15

| Section | Tests | Status |
|---|---|---|
| Authentication | 1/1 | PASS |
| Memory CRUD | 6/6 | PASS |
| Conversation History | 6/6 | PASS |
| Backwards Compatibility | 2/2 | PASS |

---

## 8. Files Changed Summary

### New Files Created (8)
| File | Purpose |
|---|---|
| `app/agents/prompts/mentor_system.md` | Editable system prompt (mentor personality, tone, rules) |
| `app/agents/memory_extractor.py` | LLM-powered extraction of key user facts from conversations |
| `app/api/routes/memory.py` | Memory CRUD endpoints (GET/POST/PATCH/DELETE /memory) |
| `app/sql/ai_memory_migration.sql` | SQL migration: user_memories table, conversations.summary, constraint drop |
| `app/sql/fix_conversations_unique_constraint.sql` | Standalone SQL to drop Conversations unique constraint |
| `app/sql/notifications_migration.sql` | SQL migration: notifications table with RLS and indexes |
| `tests/test_ai_memory.py` | AI Memory System test suite (15 tests with cleanup + summary output) |
| `docs/AI_MEMORY_SYSTEM_PLAN.md` | Full implementation plan with research, architecture, and change tracker |

### Modified Files (8)
| File | Changes |
|---|---|
| `app/agents/mentor.py` | Load prompt from external file, optimized context assembly, memory loading, summarization, token budget |
| `app/models/db_models.py` | Added `UserMemory` model, `Notification` model, `User.memories` relationship, `User.notifications` relationship |
| `app/models/schemas.py` | Added `MemoryResponse`, `MemoryCreateRequest`, `ConversationListItem`, `NotificationCreate`, `NotificationResponse`, `NotificationListResponse` |
| `app/api/routes/chat.py` | Added `GET /chat/conversations`, `GET /chat/conversations/{id}` |
| `app/main.py` | Registered `memory_router` and `notifications_router` |
| `docs/SCHEMA.md` | Added user_memories table, conversations.summary, notifications table |
| `docs/API_CONTRACT.md` | Added 6 new endpoints, updated POST /chat/message response |
| `docs/PRD.md` | Added Long-term Memory and Conversation History features |

---

## 9. What Changed in Each Document

### docs/SCHEMA.md
- Added `user_memories` table definition with columns, RLS policies, and index
- Added `notifications` table definition with columns, RLS policies, and indexes
- Added `conversations.summary` field
- Updated entity relationship diagram

### docs/API_CONTRACT.md
Added 6 new endpoints:

| Endpoint | Method | Purpose |
|---|---|---|
| `/memory` | GET | List user memories |
| `/memory` | POST | Create a memory manually |
| `/memory/{id}` | PATCH | Update a memory |
| `/memory/{id}` | DELETE | Delete a memory |
| `/chat/conversations` | GET | List all conversations (sidebar) |
| `/chat/conversations/{id}` | GET | Get messages for a specific conversation |

Updated existing endpoint:
- `POST /chat/message` — Added `summary_updated` field to response

### docs/PRD.md
- Added Long-term Memory feature under AI Mentor section
- Added Conversation History feature under AI Mentor section
- Added Memory Extractor to agent summary table
- Updated token efficiency notes

---

## 10. Current State

| Metric | Value |
|---|---|
| **Branch** | `main` (feature branch deleted) |
| **Tests passing** | 30/30 (test_endpoints) + 15/15 (test_ai_memory) = **45/45 total** |
| **Database tables** | users, conversations, messages, roadmaps, steps, tasks, evidence, resumes, user_memories, notifications |
| **API endpoints** | ~22 endpoints across 8 routers |
| **LLM model** | openai/gpt-oss-120b (128K context window) |
| **Railway deployment** | Deploying from `main` branch |
| **Supabase** | All migrations applied (user_memories, notifications, conversations.summary, constraint drops) |

---

### August 27, 2026 — Opportunities Scraper Upgrade + Currency Detection

| Time (est.) | Activity |
|---|---|
| Morning | Reviewed existing scraper plan, schema, API contract, frontend requirements, and tech stack docs. |
| Morning | Gathered frontend requirements: opportunities page with tabs, save/bookmark, source links, notifications. |
| Morning | Made structured decisions: offset-based pagination, 1-hour in-memory TTL caching, polling-based notifications. |
| Morning | Saved updated plan to GitHub at `docs/plans/SCRAPER_PLAN.md`. |
| Afternoon | Built all 6 implementation files locally: scraper, scout, endpoints, migration SQL, models, schemas. |
| Afternoon | Created branch `feature/opportunities-scraper-upgrade` and pushed 8 files to GitHub. |
| Afternoon | Wrote 26 integration tests (`test_opportunities.py`) — all 26 passing. |
| Afternoon | Wrote scraper unit tests (`test_scraper_unit.py`) — 45+ tests covering salary parsing, keyword matching, caching, curated list. |
| Afternoon | Wrote scout unit tests (`test_scout_unit.py`) — 30+ tests covering timeframe, sorting, pagination, curated list validation. |
| Evening | **Bug fix:** `test_jmd_range` failed — `_parse_salary` checked `$` before `jmd`, so `"JMD $800K"` returned USD. Fixed by reordering if/elif. |
| Evening | **Feature request:** Jordan asked why only 4 currencies. Replaced hardcoded if/elif with priority-based lookup table (`_CURRENCY_TABLE`) — now handles 22+ currencies including all Caribbean ISO 4217 codes. |
| Evening | **Feature request:** Jordan asked about source context — if a Trinidadian page uses bare `$`, shouldn't it default to TTD? Added source-context-aware currency detection: `_detect_currency(text, source_name)` checks source name against `_SOURCE_CURRENCY_MAP` and keyword matching before defaulting to USD. |
| Evening | Added `_SOURCE_CURRENCY_MAP` (exact matches like `rss_jamaica_gleaner` → JMD) and `_SOURCE_CURRENCY_KEYWORDS` (keyword matches like `"trinidad"` → TTD). |
| Evening | Updated `_parse_salary` signature to accept optional `source_name` parameter. |
| Evening | Wrote 10+ new tests for source-context-aware currency detection (Jamaican/Trinidadian/Barbadian sources). |
| Evening | All tests passing: **134 unit tests + 26 integration tests = 160 total**. |
| Evening | Created code walkthrough plan in `.shogo/plans/` — 7 phases covering every file in the codebase. |
| Evening | Created edge case & security test plan in `.shogo/plans/` — input validation, auth, scraper failures, currency edge cases, pagination edge cases. |
| Evening | Updated all project documentation: PROGRESS_RECORD, SCHEMA, API_CONTRACT, TECH_STACK, FRONTEND_HANDOFF, OPPORTUNITIES_UPGRADE_REPORT, PRD, SCRAPER_PLAN. |

---

## 11. What's Next

### August 28, 2026 — CI/CD Workflows, Lint Fixes, Mypy Type Fixes

| Time (est.) | Activity |
|---|---|
| Morning | Created Dependabot config (`.github/dependabot.yml`) for automated dependency updates. |
| Morning | Created CI workflow (`.github/workflows/ci.yml`) — lint (ruff), tests (pytest + PostgreSQL via service container), security scan (pip-audit + bandit). |
| Morning | Created security workflow (`.github/workflows/security.yml`) — weekly dependency audit + gitleaks secret scan. |
| Morning | Updated `requirements.txt` with secure minimum versions (all dependencies bumped to patch-level safe versions). |
| Morning | First CI run: ruff lint failed — 24 BLE001 violations (bare `except Exception` catches). |
| Morning | Fixed all BLE001 violations across 9 files: `opportunity_scraper.py`, `scout.py`, `notifications.py`, `common.py`, `mentor.py`, `memory_extractor.py`, `portfolio.py`, `chat.py`, `security.py`. |
| Morning | Second CI run: ruff format failed — 3 pre-existing files needed formatting (`db_models.py`, `middleware.py`, `memory.py`). |
| Morning | Fixed formatting, pushed. Third CI run: all passing except mypy type check (18 errors in 7 files). |
| Morning | Fixed all 18 mypy errors: `config.py` (env var defaults), `postgres.py` (AsyncGenerator return type), `storage.py` (remove() arg type), `notifications.py` + `schemas.py` (link type broadened), `opportunities.py` (rowcount ignore), `mentor.py` (OpenAI SDK type ignores + Message annotation). |
| Morning | Dependabot created 9 branches for dependency updates. Advised Jordan on safe vs risky merges. |

### What Was Built — CI/CD & Code Quality

#### GitHub Actions Workflows

**`.github/workflows/ci.yml`** — Runs on every push and PR to `main`:
| Job | What It Does |
|-----|-------------|
| **Lint & Type Check** | Installs deps, runs `ruff check` (linting) + `ruff format --check` (formatting) + `mypy` (type checking) |
| **Tests** | Runs all pytest tests with PostgreSQL service container for integration tests |
| **Security Scan** | Runs `pip-audit` (dependency vulnerabilities) + `bandit` (security linting) |

**`.github/workflows/security.yml`** — Weekly schedule (Monday 6 AM UTC):
| Job | What It Does |
|-----|-------------|
| **Dependency Audit** | Runs `pip-audit` on full dependency list |
| **Secret Scan** | Runs `gitleaks` to detect committed secrets |
| **Notify** | Reports results (extensible for Slack/email notifications) |

#### Dependabot Configuration

**`.github/dependabot.yml`**:
- Checks `backend/requirements.txt` daily for pip dependency updates
- Checks `.github/workflows/` weekly for GitHub Actions updates
- Auto-creates PRs for new versions
- Configurable `open-pull-requests-limit` to control PR volume

#### Code Quality Fixes

**BLE001 — Bare Exception Catches (24 violations fixed):**
Replaced generic `except Exception` with specific exception types across 9 files:
- `opportunity_scraper.py` — `httpx.HTTPError`, `json.JSONDecodeError`, `ValueError`, `KeyError`
- `scout.py` — `httpx.HTTPError`, `ValueError`
- `notifications.py` — `httpx.HTTPError`
- `mentor.py` — `httpx.HTTPError`, `ValueError`
- `memory_extractor.py` — `httpx.HTTPError`
- `portfolio.py` — `httpx.HTTPError`, `ValueError`
- `chat.py` — `httpx.HTTPError`
- `common.py` — `httpx.HTTPError`
- `security.py` — `ValueError`

**Mypy Type Errors (18 violations fixed):**
| File | Error Count | Fix |
|------|-------------|-----|
| `config.py` | 5 | Added `=""` defaults to Settings fields (CI lacks env vars) |
| `postgres.py` | 1 | Return type `AsyncGenerator[AsyncSession, None]` instead of `AsyncSession` |
| `storage.py` | 1 | Wrapped `file_path` in `[file_path]` — `remove()` expects `list[str]` |
| `notifications.py` | 1 | Added `# type: ignore[attr-defined]` for `rowcount` (SQLAlchemy typing limitation) |
| `schemas.py` | 4 | Broadened `link` field to `Optional[str \| dict]` (DB stores JSON dicts) |
| `opportunities.py` | 1 | Added `# type: ignore[attr-defined]` for `rowcount` |
| `mentor.py` | 5 | `# type: ignore[call-overload]` on OpenAI SDK calls + explicit `list[Message]` annotation |

**Ruff Format Fixes (3 files):**
- `db_models.py` — Collapsed multi-line dict definitions, normalized whitespace
- `middleware.py` — Normalized blank lines and dict alignment
- `memory.py` — Collapsed multi-line query chains

**Updated `requirements.txt`:**
- All dependencies pinned to secure minimum versions
- `pydantic>=2.11.0`, `sqlalchemy>=2.0.40`, `openai>=1.0.0`, `supabase>=2.15.0`, etc.

---

### Before Merge
1. ✅ All 160 tests passing
2. ✅ All documentation updated
3. ✅ CI/CD workflows (lint, tests, security, Dependabot)
4. ✅ All lint/format/type errors fixed
5. Teammate code review
6. Merge to main

### High Priority (Post-Merge)
1. Frontend dev builds opportunities page UI (FRONTEND_HANDOFF.md has complete guide)
2. Run migration SQL for new opportunities columns in Supabase
3. Railway deployment verification

### Medium Priority
4. Edge case & security tests (see `.shogo/plans/edge-case--security-tests_*.plan.md`)
5. Memory extraction in production
6. Conversation auto-titling

### Lower Priority (Post-Competition)
7. Cursor-based pagination
8. Web push notifications (replaces polling)
9. Social media scraping (Facebook, Instagram)
10. Admin source health dashboard
11. Evidence verification (AI-powered)
12. Full code walkthrough (see `.shogo/plans/code-walkthrough-plan_*.plan.md`)

---

## Appendix: Git Commit History

```
 1. [2026-08-24] 4fd1ea1e — docs: update all docs to reflect notifications system
 2. [2026-08-24] d86002a6 — docs: add Privacy Policy and Terms of Service
 3. [2026-08-25] e5092650 — docs: add AI Memory System implementation plan
 4. [2026-08-25] dea9dc68 — feat: add external system prompt file for mentor personality
 5. [2026-08-25] cacc1cf2 — feat: load system prompt from external .md file
 6. [2026-08-25] 520a0c60 — feat: add external system prompt file for mentor personality
 7. [2026-08-25] f1392412 — feat: add UserMemory model + conversation summary field
 8. [2026-08-25] 597ed286 — feat: add Memory + ConversationList schemas
 9. [2026-08-25] 70750cad — feat: optimized context assembly, memory loading, summarization, token budget
10. [2026-08-25] 61b89835 — feat: add memory extraction logic
11. [2026-08-25] 22489889 — feat: add memory API routes (GET/POST/PATCH/DELETE)
12. [2026-08-25] a00b3948 — feat: add conversation list + messages endpoints
13. [2026-08-25] e3862904 — feat: register memory router
14. [2026-08-25] 251f6622 — feat: add AI memory system SQL migration
15. [2026-08-25] 3e7d13d0 — docs: add user_memories table + conversations.summary to schema
16. [2026-08-25] ae80f6d5 — docs: add memory + conversation list endpoints to API contract
17. [2026-08-25] 8d318f77 — docs: add long-term memory + conversation history features to PRD
18. [2026-08-25] ebb8c50b — test: add AI memory system test suite
19. [2026-08-26] 30b1fcc3 — deleted old test files
20. [2026-08-26] 17b04a1c — test: add cleanup, summary output, and section breakdown
21. [2026-08-26] 0bfa629d — fix: add SQL to drop Conversations_user_id_key constraint
22. [2026-08-26] 38e64865 — fix: add Conversations unique constraint drop to migration
23. [2026-08-26] 08fd61fc — fix: register notifications router in main.py
24. [2026-08-26] 2fd70256 — feat: add Notification model to db_models.py
25. [2026-08-26] 8eff4611 — feat: add NotificationCreate, NotificationResponse, NotificationListResponse schemas
26. [2026-08-26] 3ab3cc92 — feat: add notifications table SQL migration
27. [2026-08-26] 86ef7798 — feat: add notifications relationship to User model
28. [2026-08-26] 9facfefc — fix: add Notification.user back_populates relationship
29. [2026-08-26] ca0f5aa7 — Merge branch 'feature/ai-memory-system' into main
```

---

*This document was generated on August 26, 2026 by Jordan with assistance from Shogo AI.*
*It serves as a development progress record for the Lynks Backend project.*
