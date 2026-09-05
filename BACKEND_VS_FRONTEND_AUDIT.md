# Backend vs Frontend Audit — Current State

**Date:** September 5, 2026 (updated — phone field added to profile)
**Frontend URL:** https://lynks-gen-ai.web.app
**Backend URL:** https://lynks-backend-production.up.railway.app
**Backend:** FastAPI + Supabase (Postgres + Auth + Storage)

---

## TL;DR

All major frontend pages are now connected to the backend API. The chat feature has been fully wired with conversation management (pin, reorder, delete). The remaining gaps are minor: onboarding bypasses the backend (acceptable), and the dashboard could consolidate 5 API calls into 1.

---

## Frontend Data Flow Map

```
                        ┌─── Uses Backend API ──────────────┐
                        │                                    │
                        │  ✅ Dashboard (5 calls)            │
                        │  ✅ Roadmap (5 calls)              │
                        │  ✅ Chat (8 calls)                 │
                        │  ✅ Opportunities (6 calls)        │
                        │  ✅ Resume (2 calls)               │
                        │  ✅ Settings (3 calls)             │
                        │  ✅ Portfolio/Evidence              │
                        │  ✅ Notifications (6 endpoints)    │
                        │                                    │
                        └────────────────────────────────────┘

                        ┌─── Calls Supabase Directly ───┐
                        │                                │
                        │  ⚠️ Onboarding (write)         │
                        │  ⚠️ AppLayout (read name)      │
                        │                                │
                        │  ✅ Login/Signup (auth)         │
                        │  ✅ SecurityTab (passwords)     │
                        │                                │
                        └────────────────────────────────┘
```

**Note:** Login/Signup and SecurityTab correctly use Supabase directly — auth operations should stay with Supabase.

---

## Page-by-Page Breakdown

### 1. Dashboard (`/dashboard`) ✅ Fully Connected

**Frontend calls:** `lib/dashboard-api.ts` → `lib/api.ts` → Backend API

| Frontend Call | Backend Endpoint | Status |
|---|---|---|
| `GET /profile` | `GET /profile` | ✅ Working |
| `GET /roadmap` | `GET /roadmap` | ✅ Working |
| `GET /opportunities` | `GET /opportunities` | ✅ Working |
| `GET /notifications/unread/count` | `GET /notifications/unread/count` | ✅ Working |
| `GET /portfolio` | `GET /portfolio` | ✅ Working |

**Optimization available:** Backend has `GET /dashboard/summary` which could replace all 5 calls with 1.

---

### 2. Roadmap (`/roadmap`) ✅ Fully Connected

**Frontend calls:** `lib/roadmap-api.ts` → Backend API

| Frontend Call | Backend Endpoint | Status |
|---|---|---|
| `GET /roadmap` | `GET /roadmap` | ✅ Working |
| `POST /roadmap/generate` | `POST /roadmap/generate` | ✅ Working |
| `POST /roadmap/regenerate` | `POST /roadmap/regenerate` | ✅ Working |
| Task completion | `PATCH /roadmap/tasks/{id}/complete` | ✅ Working |
| Task update | `PATCH /roadmap/tasks/{id}` | ✅ Working |

---

### 3. Chat (`/chat`) ✅ Fully Connected

**Frontend calls:** `lib/chat-api.ts` → Backend API

| Frontend Call | Backend Endpoint | Status |
|---|---|---|
| Send message | `POST /chat/message` | ✅ Working |
| List conversations (sidebar) | `GET /chat/conversations` | ✅ Working |
| Get conversation messages | `GET /chat/conversations/{id}` | ✅ Working |
| Pin/unpin conversation | `PATCH /chat/conversations/{id}` | ✅ Working |
| Reorder conversations | `POST /chat/conversations/reorder` | ✅ Working |
| Delete single conversation | `DELETE /chat/conversations/{id}` | ✅ Working |
| Clear all history | `DELETE /chat/history` | ✅ Working |

---

### 4. Opportunities (`/opportunities`) ✅ Fully Connected

**Frontend calls:** `lib/api.ts` opportunities namespace → Backend API

| Frontend Call | Backend Endpoint | Status |
|---|---|---|
| List opportunities | `GET /opportunities` | ✅ Working |
| Search/filter | `GET /opportunities?search=X&category=Y` | ✅ Working |
| Save opportunity | `POST /opportunities/{id}/save` | ✅ Working |
| Unsave opportunity | `DELETE /opportunities/{id}/save` | ✅ Working |
| Saved list | `GET /opportunities/saved` | ✅ Working |
| Refresh/scrape | `POST /opportunities/refresh` | ✅ Working |
| New count | `GET /opportunities/new-count` | ✅ Working |

**Note:** "Personal matches" tab uses the same list with profile-based filtering — no separate endpoint needed.

---

### 5. Resume (`/resume`) ✅ Fully Connected

**Frontend calls:** `lib/api.ts` resume namespace → Backend API

| Frontend Call | Backend Endpoint | Status |
|---|---|---|
| Fetch existing resume | `GET /resume` | ✅ Working |
| Generate resume | `POST /resume/generate` | ✅ Working |

---

### 6. Settings (`/settings`) ✅ Fully Connected

**Frontend calls:** `lib/api.ts` profile namespace → Backend API

| Frontend Call | Backend Endpoint | Status |
|---|---|---|
| Fetch profile | `GET /profile` | ✅ Working (includes phone) |
| Update profile | `PATCH /profile` | ✅ Working (phone field supported) |
| Update career path | `PATCH /profile/career-path` | ✅ Working |

---

### 7. Onboarding (`/onboarding`) ⚠️ Bypasses Backend

**What frontend does:** Calls Supabase directly via `supabase.from('users').update(...)`

**Backend has:** `PATCH /profile` — same functionality

**Impact:** Data ends up in the same place either way. Not critical — works as-is.

**Action needed:** 🟢 Low priority — could wire to `PATCH /profile` for consistency.

---

### 8. Login/Signup — Auth (Supabase) ✅ No Change Needed

Auth operations correctly stay with Supabase. No backend involvement.

---

### 9. SecurityTab (Password, Email, Account delete) ✅ No Change Needed

Auth operations correctly stay with Supabase. No backend involvement.

---

### 10. AppLayout (Sidebar name) ⚠️ Minor

Uses `supabase.from('users').select('name')` for sidebar display. Caches in localStorage. Skips DB query when cached.

**Action needed:** 🟢 None critical — works fine, low latency with cache.

---

### 11. Notifications ✅ Backend Ready

**Backend has:** Full notification system (6 endpoints)
- ✅ `GET /notifications/unread/count` — Dashboard uses this
- ⚠️ Full notification UI (list, mark-read) — not yet built in frontend

---

### 12. Profile Pictures ✅ Built

Backend has `POST /profile/avatar` and `DELETE /profile/avatar` endpoints. Storage bucket `profile-pictures` in Supabase. Frontend wired — upload opens file picker, displays avatar, remove clears it.

**Status:** ✅ Complete. Run migration SQL before deploying.

---

## CORS Configuration

**Issue found:** Backend CORS was configured to `http://localhost:3000` only. The frontend at `https://lynks-gen-ai.web.app` was being blocked.

**Fixed:** Updated default CORS origins in `main.py` to include:
- `http://localhost:3000`
- `https://lynks-gen-ai.web.app`
- `https://lynks-frontend.web.app`

---

## Summary: Remaining Action Items

| Priority | Item | Effort |
|---|---|---|
| 🟢 Low | Onboarding → `PATCH /profile` instead of Supabase direct | Small |
| 🟢 Low | Dashboard → `GET /dashboard/summary` instead of 5 calls | Small |
| 🟢 Low | Notification UI (bell, list, mark-read) | Medium |
| 🟡 Medium | Profile picture upload (endpoint + storage + UI) | ✅ Done |
| 🟡 Medium | Opportunity personal matching scoring | Medium |
| 🟡 Medium | Scheduled opportunity scraping (cron) | Medium |
