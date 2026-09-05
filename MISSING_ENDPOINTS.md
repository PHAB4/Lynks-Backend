# Missing Endpoints & Integration Gaps

> **Last updated:** September 10, 2026 (current build state)
>
> **Backend:** `https://lynks-backend-production.up.railway.app` (Railway)
> **Frontend:** `https://lynks-gen-ai.web.app` (Firebase Hosting)

## Backend Agents vs API Routes

| Agent / Feature | Agent Code Exists? | API Endpoint Exists? | Notes |
|---|---|---|---|
| **Career Architect** (roadmap generation) | ✅ `architect.py` | ✅ `POST /roadmap/generate`, `GET /roadmap`, `POST /roadmap/regenerate` | Fully wired |
| **Mentor Orchestrator** (chat) | ✅ `mentor.py` | ✅ `POST /chat/message`, `GET /chat/history`, `DELETE /chat/history`, `GET /chat/conversations`, `GET /chat/conversations/{id}`, `PATCH /chat/conversations/{id}`, `POST /chat/conversations/reorder`, `DELETE /chat/conversations/{id}` | Fully wired — includes pin, reorder, delete |
| **Portfolio Manager** (evidence verification) | ✅ `portfolio_manager.py` | ✅ `POST /portfolio/tasks/{task_id}/evidence`, `GET /portfolio/portfolio` | Fully wired |
| **Job Scout** (opportunity discovery) | ✅ `scout.py` | ✅ `GET /opportunities`, `GET /opportunities/matches`, `POST /opportunities/refresh`, `GET /opportunities/new-count`, `GET /opportunities/saved`, `POST /opportunities/{id}/save`, `DELETE /opportunities/{id}/save` | Fully wired — includes rule-based personal matching |
| **Opportunity Scraper** (Devpost, Eventbrite, RSS, social media) | ✅ `opportunity_scraper.py` | ✅ `POST /opportunities/refresh` + `GET /opportunities/scheduler/status` | Auto-scrapes every 6h via asyncio background task + notifications |
| **Memory Extractor** (long-term user facts) | ✅ `memory_extractor.py` | ✅ `GET /memory`, `POST /memory`, `PATCH /memory/{id}`, `DELETE /memory/{id}` | Auto-extracts during chat + manual CRUD |
| **Profile** | ✅ DB model | ✅ `GET /profile`, `PATCH /profile`, `PATCH /profile/career-path`, `POST /profile/avatar`, `GET /profile/suggested-interests` | Fully wired — includes dynamic interest suggestions (14 career domains) and avatar upload |
| **Notifications** | ✅ `notifications.py` service | ✅ Full CRUD (`GET`, `GET /unread/count`, `GET /{id}`, `POST`, `PATCH /{id}/read`, `POST /read-all`) | Fully wired |
| **Resume** | ✅ `portfolio_manager.py` agent | ✅ `POST /resume/generate`, `GET /resume` | Fully wired |

---

## Frontend Pages vs Backend Connection Status

| Page | Backend Connected? | Current State |
|---|---|---|
| **`/dashboard`** | ✅ **Connected** | Calls backend via 5 separate API calls (`getProfile`, `getRoadmap`, `getOpportunities`, `getUnreadNotificationCount`, `getPortfolio`). Has tab navigation (Overview, Skills, Experience, Goals, Resources). Could be consolidated into 1 call to `GET /dashboard/summary`. |
| **`/roadmap`** | ✅ **Connected** | Uses `roadmap-api.ts` — fetches roadmap, generates, regenerates. Task completion wired. |
| **`/opportunities`** | ✅ **Connected** | Full backend integration — fetching, filtering, save/unsave, new count badge, refresh all wired via backend API. No more hardcoded data. |
| **`/resume`** | ✅ **Connected** | Uses backend API (`GET /resume`, `POST /resume/generate`). Displays generated resume with content. |
| **`/settings`** | ✅ **Connected** | Reads/writes profile via backend API (`GET /profile`, `PATCH /profile`, `PATCH /profile/career-path`). Suggested interests are **dynamic** — fetched from `GET /profile/suggested-interests` based on user's career path. No more hardcoded `CAREER_INTERESTS` array. |
| **`/chat`** | ✅ **Connected** | Full backend integration — send/receive messages, pin/unpin, reorder, delete conversations, clear history. No conversations list screen — loads last conversation or starts new. Conversation management in expanded sidebar with 3-dot menus. |
| **`/onboarding`** | ⚠️ **Partial** | Writes to Supabase directly via client SDK, not through backend. Backend `PATCH /profile` not called. 7 steps: name, country, age, employment, education, career path, interests. |

---

## Chat Features (all connected ✅)

| Feature | Endpoint | Frontend |
|---|---|---|
| Send message | `POST /chat/message` | ✅ `chat-api.ts` |
| Load last conversation | `GET /chat/conversations` | ✅ Auto-loads on chat open |
| Get conversation messages | `GET /chat/conversations/{id}` | ✅ Loads on selection |
| Pin/Unpin conversation | `PATCH /chat/conversations/{id}` | ✅ 3-dot menu in expanded sidebar |
| Reorder conversations | `POST /chat/conversations/reorder` | ✅ 3-dot menu (top/up/down/bottom) in expanded sidebar |
| Delete single conversation | `DELETE /chat/conversations/{id}` | ✅ 3-dot menu in expanded sidebar |
| Clear all history | `DELETE /chat/history` | ✅ Clear All button with confirmation dialog |

**Note:** No conversations list screen — chat loads the last conversation automatically or starts a new one. Conversation management (pin/reorder/delete) is in the **expanded sidebar** with 3-dot menus.

---

## Auth Flow

- **"Get started"** and **"Sign up"** both go to `/signup` (email + password only, no name field)
- After signup → `/onboarding` (7 steps: name, country, age, employment, education, career path, interests)
- After onboarding → `/dashboard`
- Auth guard uses `useAuthGate()` which returns `{ checked, loading, user }`
- Protected pages show spinner while `!checked`, redirect to login only when `checked && !user`

---

## Sidebar Behavior

- **Left sidebar nav icons are ALWAYS visible** — never filtered or hidden
- **Top bar panel icons** (Steps, Roadmap, Chat, Resume) hide when you're on that page's route

---

## Remaining Gaps (sorted by priority)

| Priority | Gap | Effort |
|---|---|---|
| 🟡 Medium | Onboarding bypasses backend — writes to Supabase directly | Should call `PATCH /profile` instead |
| 🟢 Low | Dashboard could use `/dashboard/summary` | Currently 5 API calls — could be 1 |
| ✅ Done | Scheduled opportunity scraping | ✅ Done — asyncio background task every 6h, auto-generates notifications |
