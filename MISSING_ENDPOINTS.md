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
| **`/dashboard`** | ✅ **Connected** | Calls backend via 5 separate API calls (`getProfile`, `getRoadmap`, `getOpportunities`, `getUnreadNotificationCount`, `getPortfolio`). Does NOT use the `GET /dashboard/summary` aggregation endpoint yet — could be consolidated into 1 call. |
| **`/roadmap`** | ✅ **Connected** | Uses `roadmap-api.ts` — fetches roadmap, generates, regenerates. Task completion wired. |
| **`/opportunities`** | ❌ **NOT connected** | Still uses hardcoded `CAREER_JOBS` and `GENERAL_OPPORTUNITIES` arrays. Backend endpoints exist but no frontend integration. |
| **`/resume`** | ❌ **NOT connected** | Reads profile from Supabase directly (`supabase.from('users')`), not through backend API. No resume generation. |
| **`/settings`** | ❌ **NOT connected** | Reads and writes profile via Supabase client SDK (`supabase.from('users').update(...)`) — bypasses backend `PATCH /profile` entirely. |
| **`/chat`** | ✅ **Connected** | Calls backend API for messages, conversations, send/receive. |
| **`/onboarding`** | ⚠️ **Partial** | Writes to Supabase directly via client SDK, not through backend. Backend `PATCH /profile` not called. |

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

### 1. `/dashboard` — ✅ Frontend Connected (could consolidate to /summary)
```
Backend:
  - GET /dashboard/summary ✅ (live on main)
  - Returns: profile, roadmap progress, opportunities (count + top 3), notifications (count + top 3), onboarding checklist

Frontend (current):
  - ✅ Calls getProfile(), getRoadmap(), getOpportunities(), getUnreadNotificationCount(), getPortfolio()
  - ✅ No more hardcoded data — all dynamic content from backend API
  - ⚠️ Makes 5 separate API calls instead of 1 call to GET /dashboard/summary
  - Optional improvement: consolidate to single /dashboard/summary call
```

### 2. `/roadmap` — ✅ Frontend Connected
```
Backend:
  - GET /roadmap, POST /roadmap/generate, POST /roadmap/regenerate
  - PATCH /roadmap/tasks/{task_id}/complete, PATCH /roadmap/tasks/{task_id}

Frontend (current):
  - ✅ Uses roadmap-api.ts — fetches roadmap, generates, regenerates
  - ✅ Task completion wired via PATCH /roadmap/tasks/{task_id}/complete
  - ✅ Step cards, task checkboxes, progress tracking all functional
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

### 4. `/resume` — ❌ NOT connected
```
Currently:
  - Reads profile from Supabase directly (supabase.from('users'))
  - Does NOT call backend API for resume data or generation

Needs:
  - GET /resume (fetch existing resume from backend)
  - POST /resume/generate (generate resume from profile via backend)
  - Display/download generated resume
```

### 5. `/settings` — ❌ NOT connected (bypasses backend)
```
Currently:
  - Reads profile via supabase.from('users').select('*')
  - Writes profile via supabase.from('users').update({...})
  - Completely bypasses backend PATCH /profile endpoint

Needs:
  - Replace Supabase client calls with backend API:
    - GET /profile (display current settings)
    - PATCH /profile (update settings)
    - PATCH /profile/career-path (change career direction)
```

---

## Priority Summary

| Priority | Gap | Effort |
|---|---|---|
| ✅ Done | Dashboard aggregation endpoint | `GET /dashboard/summary` live — frontend uses 5 separate calls, could consolidate |
| ✅ Done | Task completion via REST | `PATCH /roadmap/tasks/{task_id}/complete` live |
| ✅ Done | Task status update | `PATCH /roadmap/tasks/{task_id}` live — supports title, description, status |
| ✅ Done | Dashboard frontend connected | Uses `dashboard-api.ts` — calls backend for profile, roadmap, opportunities, notifications, portfolio |
| ✅ Done | Roadmap frontend connected | Uses `roadmap-api.ts` — generates, regenerates, completes tasks |
| 🔴 High | Opportunities page uses hardcoded data | Needs `GET /opportunities` + save/unsave/refresh wired |
| 🟡 Medium | Settings bypasses backend | Uses `supabase.from('users')` directly — needs `PATCH /profile` |
| 🟡 Medium | Resume not connected | Uses Supabase directly — needs backend API + generation |
| 🟡 Medium | Onboarding bypasses backend | Writes to Supabase directly — needs `PATCH /profile` |
| 🟢 Low | No scheduled opportunity scraping | Manual trigger only — add cron for auto-refresh |
| 🟢 Low | Dashboard could use /summary endpoint | Currently 5 API calls — could be 1 call to `GET /dashboard/summary` |
