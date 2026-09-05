# Missing Endpoints & Integration Gaps

> **Last updated:** September 5, 2026

## Backend Agents vs API Routes

| Agent / Feature | Agent Code Exists? | API Endpoint Exists? | Notes |
|---|---|---|---|
| **Career Architect** (roadmap generation) | ✅ `architect.py` | ✅ `POST /roadmap/generate`, `GET /roadmap`, `POST /roadmap/regenerate` | Fully wired |
| **Mentor Orchestrator** (chat) | ✅ `mentor.py` | ✅ `POST /chat/message`, `GET /chat/history`, `DELETE /chat/history`, `GET /chat/conversations`, `GET /chat/conversations/{id}` | Fully wired |
| **Portfolio Manager** (evidence verification) | ✅ `portfolio_manager.py` | ✅ `POST /portfolio/tasks/{task_id}/evidence`, `GET /portfolio/portfolio` | Fully wired |
| **Job Scout** (opportunity discovery) | ✅ `scout.py` | ✅ `GET /opportunities`, `POST /opportunities/refresh`, `GET /opportunities/new-count`, `GET /opportunities/saved`, `POST /opportunities/{id}/save`, `DELETE /opportunities/{id}/save` | Fully wired |
| **Opportunity Scraper** (Devpost, Eventbrite, RSS, social media) | ✅ `opportunity_scraper.py` | ⚠️ Only via `POST /opportunities/refresh` | No scheduled/cron endpoint — must be manually triggered |
| **Memory Extractor** (long-term user facts) | ✅ `memory_extractor.py` | ✅ `GET /memory`, `POST /memory`, `PATCH /memory/{id}`, `DELETE /memory/{id}` | Auto-extracts during chat + manual CRUD |
| **Profile** | ✅ DB model | ✅ `GET /profile`, `PATCH /profile`, `PATCH /profile/career-path` | Fully wired |
| **Notifications** | ✅ `notifications.py` service | ✅ Full CRUD (`GET`, `GET /unread/count`, `GET /{id}`, `POST`, `PATCH /{id}/read`, `POST /read-all`) | Fully wired |
| **Resume** | ✅ `resume.py` route | ✅ `POST /resume/generate`, `GET /resume` | Fully wired |

---

## Frontend Pages vs Backend Connection Status

| Page | Backend Connected? | Current State |
|---|---|---|
| **`/dashboard`** | ⚠️ **Backend ready** | `GET /dashboard/summary` endpoint live. Frontend team needs to replace hardcoded data with API call. |
| **`/roadmap`** | ❌ **NOT connected** | Placeholder page — just shows "Your roadmap will appear here." Backend endpoints exist but no frontend integration. |
| **`/opportunities`** | ❌ **NOT connected** | Hardcoded `CAREER_JOBS` and `GENERAL_OPPORTUNITIES` arrays. Backend endpoints exist but no frontend integration. |
| **`/resume`** | ❌ Likely not connected | Needs verification. |
| **`/settings`** | ❌ Likely not connected | Needs verification. |
| **`/chat`** | ✅ **Connected** | Just integrated — calls backend API for messages, conversations, send/receive. |
| **`/onboarding`** | ⚠️ Partial | Writes to Supabase directly via client SDK, not through backend. |

---

## Missing Backend Endpoints (features with agent code but no dedicated endpoint)

### 1. ~~**Dashboard Summary Endpoint**~~ ✅ Done
`GET /dashboard/summary` — single-call aggregation endpoint that returns profile, roadmap progress, opportunities, notifications, and onboarding checklist. Merged to main on 2026-09-05.

### 2. ~~**Task Completion via REST**~~ ✅ Done
- `PATCH /roadmap/tasks/{task_id}/complete` — validates ownership + active roadmap, idempotent
- Frontend can call this from a checkbox click on the Roadmap page

### 3. ~~**Task Status Update**~~ ✅ Done
`PATCH /roadmap/tasks/{task_id}` — general task update endpoint. Supports partial updates to title, description, and status (pending → in_progress → complete). Validates ownership. Merged to main on 2026-09-05.

### 4. **Step Status** — No endpoint to manage step progress
Step status is derived (complete only if ALL tasks in step are complete). But there's no endpoint to manage steps independently.

### 5. **Saved Opportunity Sync** — `GET /opportunities/saved` exists but frontend doesn't use it
The `/opportunities/saved` endpoint exists, but the Opportunities page uses a local `savedIds` state — no persistence.

### 6. **Onboarding → Profile Sync**
The onboarding flow writes directly to Supabase client-side (`supabase.from('users').update(...)`). The backend has `PATCH /profile` but the onboarding doesn't call it. This means the backend may not see updated profile data.

---

## Missing Frontend Integrations (endpoints exist, but UI uses hardcoded data)

### 1. `/dashboard` — Backend endpoint ready, needs frontend wiring ✅
```
Backend:
  - GET /dashboard/summary ✅ (live on main)
  - Returns: profile, roadmap progress, opportunities (count + top 3), notifications (count + top 3), onboarding checklist

Frontend needs:
  - Replace HARDCODED RECENT_OPPORTUNITIES with API data
  - Replace HARDCODED DASHBOARD_STATS with computed roadmap data
  - Single fetch('/api/dashboard/summary') call replaces 4-5 separate calls
```

### 2. `/roadmap` — Needs full integration
```
Currently:
  - Placeholder text: "Your personalized career roadmap will appear here"

Needs:
  - GET /roadmap (fetch active roadmap with steps + tasks)
  - PATCH /roadmap/tasks/{task_id}/complete (mark task done from UI)
  - PATCH /roadmap/tasks/{task_id} (edit task title, description, status)
  - Progress tracking UI (step cards, task checkboxes, completion %)
  - POST /roadmap/regenerate (regenerate roadmap button)
```

### 3. `/opportunities` — Needs real data
```
Currently:
  - HARDCODED CAREER_JOBS and GENERAL_OPPORTUNITIES arrays
  - Local saved IDs (not persisted)

Needs:
  - GET /opportunities (fetch from backend)
  - GET /opportunities/saved (fetch saved list)
  - POST /opportunities/{id}/save (persist saves)
  - DELETE /opportunities/{id}/save (unsave)
  - Category/timeframe/sort filtering from query params
  - POST /opportunities/refresh (manual refresh button)
```

### 4. `/resume` — Needs verification
```
Needs:
  - GET /resume (fetch existing resume)
  - POST /resume/generate (generate new resume from profile)
  - Display/download generated resume
```

### 5. `/settings` — Needs verification
```
Needs:
  - GET /profile (display current settings)
  - PATCH /profile (update settings)
  - PATCH /profile/career-path (change career direction)
```

---

## Priority Summary

| Priority | Gap | Effort |
|---|---|---|
| ✅ Done | Dashboard aggregation endpoint | `GET /dashboard/summary` live — frontend needs wiring |
| ✅ Done | Task completion via REST | `PATCH /roadmap/tasks/{task_id}/complete` live |
| ✅ Done | Task status update | `PATCH /roadmap/tasks/{task_id}` live — supports title, description, status |
| 🔴 High | Roadmap page is a placeholder, needs full UI + task completion endpoint | Large — full page build |
| 🔴 High | Opportunities page uses hardcoded data, needs real API integration | Medium — endpoints exist, just need frontend wiring |
| 🟡 Medium | Onboarding writes to Supabase directly, bypassing backend | Medium — reroute to `PATCH /profile` |
| 🟡 Medium | Settings page likely not connected to backend | Small — wire to existing profile endpoints |
| 🟢 Low | No scheduled opportunity scraping (manual trigger only) | Small — add a cron/scheduled task |
| 🟢 Low | Resume page needs verification | Small — check and wire existing endpoints |
