# Lynks Backend — Teammate Handoff Document

**Last updated:** August 27, 2026
**Author:** Jordan (project lead) + AI agent
**Repo:** https://github.com/PHAB4/Lynks-Backend
**Active Branch:** `feature/opportunities-scraper-upgrade`
**Production URL:** `https://lynks-backend-production.up.railway.app`
**Supabase Dashboard:** https://supabase.com/dashboard → project `qcyxyunngbkupttcwlbk`

---

## 1. What Is Lynks?

Lynks is an **AI-powered career accelerator for Caribbean youth**. Users sign up, complete onboarding, and receive a personalized AI-generated career roadmap. A mentor chatbot (LLM via Groq) guides them, tracks progress, verifies achievements, and connects them with Caribbean opportunities.

---

## 2. Current Status (August 27, 2026)

### Test Results: 26/26 passing ✅

All endpoints tested and verified:
- Profile CRUD ✅
- Roadmap generation + regeneration ✅
- Evidence upload ✅
- Portfolio ✅
- Opportunities (filtering, sorting, pagination, save/unsave) ✅
- Chat + mentor tool-calling ✅
- Notifications ✅
- Rate limiting + security headers ✅
- Auth (signup, JWT refresh) ✅

---

## 3. What Was Recently Built (August 27, 2026)

### Opportunities Scraper Upgrade
- **New schema columns:** category, description, posted_at, first_seen_at, source_name, salary_min/max/currency, image_url
- **New table:** saved_opportunities (user bookmarks)
- **New endpoints:** 6 opportunity + 6 notification endpoints
- **Scraper sources:** RSS feeds, Devpost API, Eventbrite API, LLM generation, curated list
- **Caching:** In-memory, 1-hour TTL
- **26 tests:** All passing

### See `docs/project/OPPORTUNITIES_UPGRADE_REPORT.md` for full technical details.

---

## 4. Architecture

### Routes vs Agents
| Layer | What it does | Location |
|-------|-------------|----------|
| **Routes** (HTTP layer) | Receive requests, extract JWT, call agents, return JSON | `app/api/routes/*.py` |
| **Agents** (business logic) | LLM calls, DB queries, scraping | `app/agents/*.py` |

### Auth Flow
1. User signs up/in via Supabase Auth API
2. Supabase returns a JWT access token
3. Frontend sends JWT in `Authorization: Bearer <token>` header
4. Backend's `security.py` verifies the JWT using `supabase.auth.get_user(token)`
5. Returns `user_id` which routes use for DB queries

---

## 5. Branching Strategy

- **NEVER push directly to `main`** for new features
- Create feature branches: `feature/<name>` or `fix/<name>`
- Only merge to main after testing and approval
- **Railway deploys from the active feature branch**

---

## 6. Key Gotchas

- **`_sanitize_messages()` is mandatory** for LLM calls — Groq doesn't support `annotations` field
- **Interests field** — Stored as JSONB, may come back as string or list
- **LLM calls are slow** — 5-15 seconds, always use explicit timeouts
- **PostgreSQL constraint names with mixed case need double quotes**
- **Supabase free tier pauses after 7 days of inactivity**
- **Opportunities are in-memory** — no dedicated DB table, curated + scraped
- **`python-multipart` is required** for file uploads — must be in requirements.txt
- **FK constraints need a real table** — saved_opportunities.opportunity_id has no FK since opportunities are in-memory

---

## 7. Feature Plans

| File | What it covers | Status |
|------|---------------|--------|
| `docs/project/OPPORTUNITIES_UPGRADE_REPORT.md` | Full technical report | Current |
| `docs/plans/SCRAPER_PLAN.md` | Scraper architecture and backlog | Current |
| `docs/reference/API_CONTRACT.md` | All endpoint shapes | Current |
| `docs/reference/SCHEMA.md` | Full database schema | Current |
| `docs/project/PRD.md` | Product requirements | Current |
| `docs/reference/TECH_STACK.md` | Stack choices | Current |
| `FRONTEND_HANDOFF.md` | Frontend-specific guide | Current |
