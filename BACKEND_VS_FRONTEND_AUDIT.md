# Backend vs Frontend Audit — What's Missing?

**Date:** September 5, 2026
**Frontend URL:** https://lynks-gen-ai.web.app
**Backend:** Lynks-Backend (FastAPI + Supabase)

---

## TL;DR

The frontend uses **two separate data paths** — some pages call the backend API, others call Supabase directly. The backend has all endpoints the frontend currently calls, but **4 pages bypass the backend entirely**. Here's exactly what needs to change.

---

## Frontend Data Flow Map

```
                        ┌─── Uses Backend API ──────────┐
                        │                                │
                        │  ✅ Dashboard (5 calls)        │
                        │  ✅ Roadmap (3 calls)          │
                        │  ✅ Chat (4 calls)             │
                        │  ✅ Opportunities (partial)    │
                        │  ✅ Portfolio/Evidence          │
                        │  ✅ Notifications              │
                        │                                │
                        └────────────────────────────────┘

                        ┌─── Calls Supabase Directly ───┐
                        │                                │
                        │  ❌ Settings (read + write)    │
                        │  ❌ Resume (read)              │
                        │  ❌ Onboarding (write)         │
                        │  ❌ Login/Signup (auth)        │
                        │  ❌ AppLayout (read name)      │
                        │  ❌ SecurityTab (passwords)    │
                        │                                │
                        └────────────────────────────────┘
```

---

## Page-by-Page Breakdown

### 1. Dashboard (`/dashboard`) ✅ Backend Connected

**Frontend calls:** `lib/dashboard-api.ts` → `lib/api.ts` → Backend API

| Frontend Call | Backend Endpoint | Status |
|---|---|---|
| `GET /profile` | `GET /profile` | ✅ Working |
| `GET /roadmap` | `GET /roadmap` | ✅ Working |
| `GET /opportunities` | `GET /opportunities` | ✅ Working |
| `GET /notifications/unread/count` | `GET /notifications/unread/count` | ✅ Working |
| `GET /portfolio` | `GET /portfolio` | ✅ Working |

**Backend also has but frontend doesn't use yet:**
- `GET /dashboard/summary` — could replace all 5 calls above

**Action needed:** None — fully connected.

---

### 2. Roadmap (`/roadmap`) ✅ Backend Connected

**Frontend calls:** `lib/roadmap-api.ts` → Backend API

| Frontend Call | Backend Endpoint | Status |
|---|---|---|
| `GET /roadmap` | `GET /roadmap` | ✅ Working |
| `POST /roadmap/generate` | `POST /roadmap/generate` | ✅ Working |
| `POST /roadmap/regenerate` | `POST /roadmap/regenerate` | ✅ Working |
| Task completion (via UI) | `PATCH /roadmap/tasks/{id}/complete` | ✅ Working |
| Task update (via UI) | `PATCH /roadmap/tasks/{id}` | ✅ Working |

**Action needed:** None — fully connected.

---

### 3. Chat (`/chat`) ✅ Backend Connected

**Frontend calls:** `lib/chat-api.ts` → Backend API

| Frontend Call | Backend Endpoint | Status |
|---|---|---|
| `POST /chat/message` | `POST /chat/message` | ✅ Working |
| `GET /chat/conversations` | `GET /chat/conversations` | ✅ Working |
| `GET /chat/conversations/{id}` | `GET /chat/conversations/{id}` | ✅ Working |
| `GET /chat/history?conversation_id=X` | `GET /chat/history` | ✅ Working |
| `DELETE /chat/history` | `DELETE /chat/history` | ✅ Working |

**⚠️ One issue:** The chat page also calls `supabase.from('users').select('name')` to get the user's name for the header. The backend should return this in `GET /profile` so the frontend doesn't need to call Supabase directly.

**Action needed:** None critical — works as-is. Could remove the Supabase direct call later.

---

### 4. Opportunities (`/opportunities`) ⚠️ Partially Connected

**What frontend currently does:** Uses **hardcoded data** (`CAREER_JOBS` array in `page.tsx`). Does NOT call the backend API.

**Frontend UI features observed:**
- Search bar ("Search opportunity...")
- Time filter ("Month" dropdown)
- View filter ("View: Career" vs "Personal matches")
- Tabs: "All Web-scraped" / "Personal matches"
- Job cards with: title, company, location, salary, "Go to source" link, bookmark icon
- "6 opportunities found" counter

**Backend has everything the frontend needs:**

| Frontend Feature | Backend Endpoint | Status |
|---|---|---|
| List opportunities | `GET /opportunities` | ✅ Ready |
| Search/filter | `GET /opportunities?search=X&category=Y` | ✅ Ready |
| Personal matches | Not a separate endpoint — same list with profile matching | ⚠️ See below |
| Bookmark/save | `POST /opportunities/{id}/save` | ✅ Ready |
| Unsave | `DELETE /opportunities/{id}/save` | ✅ Ready |
| Saved list | `GET /opportunities/saved` | ✅ Ready |
| Refresh/scrape | `POST /opportunities/refresh` | ✅ Ready |
| New count | `GET /opportunities/new-count` | ✅ Ready |

**Missing: No "Personal matches" concept in the backend.** The frontend has a "Personal matches" tab but the backend doesn't have a separate endpoint for personalized/opportunity-matching. Opportunities are returned as a flat list — there's no scoring/matching against user profile.

**Action needed:**
1. 🔴 **Wire frontend to backend API** (replace hardcoded data)
2. 🟡 **Consider adding opportunity matching** — either a `?personalized=true` query param or a separate endpoint that scores opportunities against the user's profile (career_path, education_level, interests)

---

### 5. Resume (`/resume`) ❌ Bypasses Backend

**What frontend currently does:** Calls Supabase directly
```typescript
supabase.from('users').select('name, email, education_level, interests')
```

**Backend has:**
| Backend Endpoint | What It Does | Frontend Uses It? |
|---|---|---|
| `GET /resume` | Fetch existing resume | ❌ No |
| `POST /resume/generate` | Generate resume from profile + portfolio | ❌ No |

**What frontend is missing:**
- The resume page just displays profile info from Supabase
- No resume generation
- No resume download/export
- No portfolio data shown in resume

**Action needed:**
1. 🔴 **Wire `GET /resume`** instead of direct Supabase query
2. 🔴 **Wire `POST /resume/generate`** so users can generate resumes
3. 🔴 **Add resume download/export** (PDF generation) — backend may need a new endpoint

---

### 6. Settings (`/settings`) ❌ Bypasses Backend

**What frontend currently does:** Reads AND writes to Supabase directly
```typescript
// Read
supabase.from('users').select('*').eq('id', user.id).single()

// Write
supabase.from('users').update({
  name, phone, role, interests, education_level, country, age, employment_status
}).eq('id', user.id)
```

**Backend has:**
| Backend Endpoint | What It Does | Frontend Uses It? |
|---|---|---|
| `GET /profile` | Fetch user profile | ❌ No |
| `PATCH /profile` | Update profile (name, age, country, education_level, employment_status, interests) | ❌ No |
| `PATCH /profile/career-path` | Update career path | ❌ No |

**What frontend is missing in backend:**
- `phone` — the settings page has a phone field, but `PATCH /profile` doesn't support it
- `role` — the settings page displays a "role" field (shows "employed"), but this maps to `employment_status` in the backend

**Action needed:**
1. 🔴 **Wire frontend to `GET /profile` and `PATCH /profile`**
2. 🟡 **Add `phone` field** to `ProfileUpdate` schema and `users` table if the frontend needs it
3. 🟡 **Map `role` ↔ `employment_status`** — the frontend shows "Role: employed" which is actually employment_status

---

### 7. Onboarding (`/onboarding`) ⚠️ Bypasses Backend (Acceptable)

**What frontend currently does:** Calls Supabase directly
```typescript
supabase.from('users').update({
  name, country, age, employment_status, education_level, career_path, interests
}).eq('id', user.id)
```

**Backend has:**
| Backend Endpoint | What It Does |
|---|---|
| `PATCH /profile` | Update all profile fields |

**Action needed:**
1. 🟡 **Could wire to `PATCH /profile`** but the current approach works since Supabase writes directly to the same DB table
2. Not critical — the data ends up in the same place either way

---

### 8. Login/Signup — Auth (Supabase handles this) ✅ No Change Needed

**Frontend:** Uses `supabase.auth.signUp()` and `supabase.auth.signInWithPassword()`
**Backend:** Doesn't handle auth — Supabase Auth manages this

**Action needed:** None. This is correct — auth should stay with Supabase.

---

### 9. SecurityTab (Password change, email verify, account delete) ✅ No Change Needed

**Frontend:**
- Password change: `supabase.auth.updateUser({ password })` ✅ Correct
- Email verify: `supabase.auth.resend({ type: 'signup' })` ✅ Correct
- Account delete: `supabase.from('users').delete()` + `supabase.auth.signOut()` ✅ Correct

**Action needed:** None. Auth operations should stay with Supabase.

---

### 10. AppLayout (Sidebar name display) ⚠️ Minor

**What frontend does:** Calls `supabase.from('users').select('name')` to show user name in sidebar

**Could use:** `GET /profile` instead — but this would require the backend to be running

**Action needed:** None critical — works fine with Supabase direct call.

---

### 11. Notifications — Backend Ready, Frontend?

**Backend has:** Full notification system (6 endpoints)
- `GET /notifications` — list all
- `GET /notifications/unread/count` — badge count ✅ Dashboard uses this
- `GET /notifications/{id}` — get single
- `POST /notifications` — create
- `PATCH /notifications/{id}/read` — mark read
- `POST /notifications/read-all` — mark all read

**Frontend:** Only uses `GET /notifications/unread/count` on the dashboard. No notification bell, list, or mark-read UI observed in the browser audit.

**Action needed:**
1. 🟢 **Build notification UI** — the backend is ready, just needs a frontend component

---

### 12. Profile Pictures — ❌ Not Built Anywhere

**Frontend:** Settings page has "Upload new photo" and "Remove" buttons (decorative — don't do anything)

**Backend:** No avatar endpoint, no storage bucket for profile pictures, no `avatar_url` column

**Action needed:**
1. 🟡 **Add `avatar_url` column** to users table
2. 🟡 **Create `profile-pictures` storage bucket** in Supabase
3. 🟡 **Build `POST /profile/avatar`** and `DELETE /profile/avatar` endpoints
4. 🟡 **Wire frontend upload buttons** to the new endpoints

---

## Summary: Action Items by Priority

### 🔴 Must Fix (Frontend wiring)
| # | Issue | Pages Affected | Effort |
|---|---|---|---|
| 1 | **Wire opportunities page to backend API** (replace hardcoded data) | `/opportunities` | Medium |
| 2 | **Wire resume page to backend** (`GET /resume` + `POST /resume/generate`) | `/resume` | Medium |
| 3 | **Wire settings page to backend** (`GET /profile` + `PATCH /profile`) | `/settings` | Small |

### 🟡 Should Build (Backend gaps)
| # | Issue | Pages Affected | Effort |
|---|---|---|---|
| 4 | **Add `phone` field** to `ProfileUpdate` schema + users table | `/settings` | Small |
| 5 | **Profile picture upload** (endpoint + storage bucket + UI wiring) | `/settings` | Medium |
| 6 | **Opportunity personal matching** (score opportunities against user profile) | `/opportunities` | Medium |

### 🟢 Nice to Have
| # | Issue | Pages Affected | Effort |
|---|---|---|---|
| 7 | **Build notification UI** (bell icon, list, mark-read) | All pages | Medium |
| 8 | **Wire onboarding to `PATCH /profile`** instead of Supabase direct | `/onboarding` | Small |
| 9 | **Use `GET /dashboard/summary`** instead of 5 separate API calls | `/dashboard` | Small |

---

## What the Backend Already Has That the Frontend Doesn't Use

| Endpoint | What It Does | Frontend Usage |
|---|---|---|
| `GET /dashboard/summary` | Single-call dashboard aggregation | ❌ Uses 5 separate calls |
| `POST /resume/generate` | AI-powered resume generation | ❌ Not wired |
| `GET /resume` | Fetch generated resume | ❌ Not wired |
| `POST /opportunities/refresh` | Trigger opportunity scraping | ❌ Not wired |
| `GET /opportunities/saved` | Get saved opportunities | ❌ Not wired |
| `GET /opportunities/new-count` | Count new opportunities since last view | ❌ Not wired |
| `POST /memory` | User memory management | ❌ Not used in UI |
| `GET /notifications` | Full notification list | ❌ Only unread count used |
| `PATCH /notifications/{id}/read` | Mark notification as read | ❌ Not wired |
| `POST /notifications/read-all` | Mark all as read | ❌ Not wired |
| `GET /evidence/{id}/verification` | AI verification of portfolio evidence | ❌ Not wired |
| `POST /evidence/{id}/re-verify` | Re-run verification | ❌ Not wired |
