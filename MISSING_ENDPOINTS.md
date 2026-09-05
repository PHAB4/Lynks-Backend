# Missing Endpoints & Integration Gaps

> **Last updated:** September 5, 2026 (end of day — full audit)

## Backend Agents vs API Routes

| Agent / Feature | Agent Code Exists? | API Endpoint Exists? | Notes |
|---|---|---|---|
| **Career Architect** (roadmap generation) | ✅ `architect.py` | ✅ `POST /roadmap/generate`, `GET /roadmap`, `POST /roadmap/regenerate` | Fully wired |
| **Mentor Orchestrator** (chat) | ✅ `mentor.py` | ✅ `POST /chat/message`, `GET /chat/history`, `DELETE /chat/history`, `GET /chat/conversations`, `GET /chat/conversations/{id}`, `PATCH /chat/conversations/{id}`, `POST /chat/conversations/reorder`, `DELETE /chat/conversations/{id}` | Fully wired — includes pin, reorder, delete |
| **Portfolio Manager** (evidence verification) | ✅ `portfolio_manager.py` | ✅ `POST /portfolio/tasks/{task_id}/evidence`, `GET /portfolio/portfolio` | Fully wired |
| **Job Scout** (opportunity discovery) | ✅ `scout.py` | ✅ `GET /opportunities`, `POST /opportunities/refresh`, `GET /opportunities/new-count`, `GET /opportunities/saved`, `POST /opportunities/{id}/save`, `DELETE /opportunities/{id}/save` | Fully wired |
| **Opportunity Scraper** (Devpost, Eventbrite, RSS, social media) | ✅ `opportunity_scraper.py` | ⚠️ Only via `POST /opportunities/refresh` | No scheduled/cron endpoint — must be manually triggered |
| **Memory Extractor** (long-term user facts) | ✅ `memory_extractor.py` | ✅ `GET /memory`, `POST /memory`, `PATCH /memory/{id}`, `DELETE /memory/{id}` | Auto-extracts during chat + manual CRUD |
| **Profile** | ✅ DB model | ✅ `GET /profile`, `PATCH /profile`, `PATCH /profile/career-path` | Fully wired |
| **Notifications** | ✅ `notifications.py` service | ✅ Full CRUD (`GET`, `GET /unread/count`, `GET /{id}`, `POST`, `PATCH /{id}/read`, `POST /read-all`) | Fully wired |
| **Resume** | ✅ `portfolio_manager.py` agent | ✅ `POST /resume/generate`, `GET /resume` | Fully wired |

---

## Frontend Pages vs Backend Connection Status

| Page | Backend Connected? | Current State |
|---|---|---|
| **`/dashboard`** | ✅ **Connected** | Calls backend via 5 separate API calls (`getProfile`, `getRoadmap`, `getOpportunities`, `getUnreadNotificationCount`, `getPortfolio`). Could be consolidated into 1 call to `GET /dashboard/summary`. |
| **`/roadmap`** | ✅ **Connected** | Uses `roadmap-api.ts` — fetches roadmap, generates, regenerates. Task completion wired. |
| **`/opportunities`** | ✅ **Connected** | Full backend integration — fetching, filtering, save/unsave, new count badge, refresh all wired via backend API. No more hardcoded data. |
| **`/resume`** | ✅ **Connected** | Uses backend API (`GET /resume`, `POST /resume/generate`). Displays generated resume with content. |
| **`/settings`** | ✅ **Connected** | Reads/writes profile via backend API (`GET /profile`, `PATCH /profile`, `PATCH /profile/career-path`). No longer bypasses backend. |
| **`/chat`** | ✅ **Connected** | Full backend integration — conversations list, send/receive messages, pin/unpin, reorder, delete conversations, clear history. |
| **`/onboarding`** | ⚠️ **Partial** | Writes to Supabase directly via client SDK, not through backend. Backend `PATCH /profile` not called. |

---

## Chat Features (all connected ✅)

| Feature | Endpoint | Frontend |
|---|---|---|
| Send message | `POST /chat/message` | ✅ `chat-api.ts` |
| List conversations (sidebar) | `GET /chat/conversations` | ✅ Shows pills in chat header |
| Get conversation messages | `GET /chat/conversations/{id}` | ✅ Loads on click |
| Pin/Unpin conversation | `PATCH /chat/conversations/{id}` | ✅ 3-dot menu |
| Reorder conversations | `POST /chat/conversations/reorder` | ✅ 3-dot menu (top/up/down/bottom) |
| Delete single conversation | `DELETE /chat/conversations/{id}` | ✅ 3-dot menu |
| Clear all history | `DELETE /chat/history` | ✅ Clear All button with confirmation dialog |

---

## Remaining Gaps (sorted by priority)

| Priority | Gap | Effort |
|---|---|---|
| 🟡 Medium | Onboarding bypasses backend — writes to Supabase directly | Should call `PATCH /profile` instead |
| 🟢 Low | Dashboard could use `/dashboard/summary` | Currently 5 API calls — could be 1 |
| 🟢 Low | No scheduled opportunity scraping | Manual trigger only — add cron for auto-refresh |
| 🟢 Low | Saved opportunity sync — `/opportunities/saved` endpoint exists but frontend may not use it for initial load | Minor gap |
