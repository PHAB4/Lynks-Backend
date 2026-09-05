# Frontend ↔ Backend Audit — Live Site Review

**Date:** September 10, 2026
**Frontend URL:** https://lynks-gen-ai.web.app
**Backend URL:** https://lynks-backend-production.up.railway.app
**Methodology:** Browser crawl of every page + cross-reference against `API_CONTRACT.md`, `SCHEMA.md`, `PRD.md`, and existing `BACKEND_VS_FRONTEND_AUDIT.md`

---

## TL;DR

All major pages (Dashboard, Roadmap, Chat, Opportunities, Resume, Settings) are connected to the backend API and working. The **Notifications list** page returns **404** — no frontend route (deferred post-competition). The **Portfolio/Evidence** page has been **POSTPONED until after the competition** — no frontend work needed for now. The **Resume editing UI** has been built by the frontend teammate and is live on the site. **Model routing** is complete — all LLM calls go through `call_llm()` for optimal model selection and fallback. **Salary/pay** is now displayed on opportunity cards. **Opportunities** is in the sidebar. Several smaller gaps remain around onboarding wiring and notification UI.

---

## Frontend Data Flow Map (Verified Live)

```
┌─── Backend API Connected ────────────────────────────────┐
│                                                          │
│  ✅ Dashboard    — single API call via dashboard/summary  │
│  ✅ Roadmap      — generate, regenerate, get, task       │
│                    complete, task update                  │
│  ✅ Chat         — send message, conversations CRUD,     │
│                    pin/reorder/delete, clear history       │
│  ✅ Opportunities — list, filter, search, save/unsave,   │
│                     refresh, new-count, matches           │
│  ✅ Resume       — get, generate, download PDF           │
│  ✅ Settings     — get profile, update profile,          │
│                    career-path, suggested-interests,      │
│                    avatar upload/delete                   │
│                                                          │
└──────────────────────────────────────────────────────────┘

┌─── Supabase Direct (Acceptable) ─────────────────────────┐
│                                                          │
│  ✅ Auth (signup/login/logout) — correct, stays Supabase │
│  ✅ SecurityTab (password, email verify, delete)          │
│  ⚠️ Onboarding — writes profile via Supabase directly    │
│  ✅ AppLayout — reads user name from GET /profile         │
│                                                          │
└──────────────────────────────────────────────────────────┘

┌─── Missing Frontend Routes ──────────────────────────────┐
│                                                          │
│  ❌ /notifications — 404 (backend has 6 endpoints)       │
│  ⏸️ /portfolio     — POSTPONED (after competition)       │
│  ⏸️ /evidence      — POSTPONED (after competition)       │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

---

## Page-by-Page Audit (Live Browser Verification)

### 1. Login / Signup ✅ No Backend Changes Needed

**Landing page (`/`):**
- Top nav: "Log in" and "Sign up" links
- Hero section with "Get started" CTA
- Footer: "© 2026 LYNKS" with social links

**Login (`/login`):**
- Fields: Email, Password (with eye toggle)
- Actions: "Sign In" button, "Forgot password?" link
- Error state: inline red banner "Invalid email or password."
- CTA: "Get Started" link → `/signup`

**Signup (`/signup`):**
- Fields: Email, Password, Confirm Password (both with eye toggles)
- Actions: "Create Account" button
- CTA: "Sign In" link → `/login`
- On success → redirects to `/onboarding`

**Backend status:** Auth handled entirely by Supabase — no backend endpoints involved. This is correct per architecture.

---

### 2. Onboarding Flow (`/onboarding`) ⚠️ Bypasses Backend

**Steps observed (7 steps):**

| Step | Heading | Input Type | Options/Placeholder |
|---|---|---|---|
| 1 | Welcome to LYNKS | — | Intro text, Continue button |
| 2 | What is your name? | Text input | "What is your name" |
| 3 | What country are you from? | Select dropdown | Trinidad and Tobago, Jamaica, Barbados, Bahamas, Guyana, Other |
| 4 | How old are you? | Number input | "Enter your age" |
| 5 | What is your current employment status? | Select dropdown | Student, Employed, Self-Employed, Unemployed, Intern, Freelance |
| 6 | What is your education level? | Radio-style cards | High School, Associate's Degree, Bachelor's Degree, Master's Degree, PhD, Self-taught |
| 7 | What career path are you interested in? | Text input | "e.g. Software Engineering" |
| 8 | What career are you most interested in? | Pill buttons | Technology, Design, Business, Healthcare, Education, Finance, Marketing, Engineering, Data Science, AI/ML |

**Backend data written:** Fields collected: `name`, `country`, `age`, `employment_status`, `education_level`, `career_path`, `interests`

**Backend mapping:**
| Onboarding Field | Backend Field | Endpoint |
|---|---|---|
| name | `name` | `PATCH /profile` |
| country | `country` | `PATCH /profile` |
| age | `age` | `PATCH /profile` |
| employment_status | `employment_status` | `PATCH /profile` |
| education_level | `education_level` | `PATCH /profile` |
| career_path | `career_path` | `PATCH /profile/career-path` |
| interests (career category) | `interests` | `PATCH /profile` |

**Gap:** Onboarding writes directly to Supabase (`supabase.from('users').update(...)`), bypassing `PATCH /profile`. Data ends up in the same table either way, so it works — but if backend validation or side-effects are ever added to `PATCH /profile`, onboarding would miss them.

**Backend action needed:** 🟢 Low priority — consider wiring onboarding to `PATCH /profile` for consistency.

---

### 3. Dashboard (`/dashboard`) ✅ Fully Connected

**UI elements observed:**
- **Left sidebar:** Icon rail with Home, Steps, Roadmap, Chat, Resume, Settings + user avatar "QT"
- **Profile card:** Avatar initials, name "QA Tester", email, career path, role, interests (as chips), "Edit Profile" button
- **Roadmap card:** "Your Roadmap" heading, empty state message, "Generate roadmap" button (or progress if roadmap exists)
- **Recent Opportunities card:** Empty state or recent listings, "Browse opportunities" + "View all" buttons
- **Quick Stats card:** Roadmap Progress (%), Tasks Completed (count), Opportunities Saved (count)
- **Career Tip card:** AI-generated tip with chat prompt

**API calls made:**
| Frontend Call | Backend Endpoint | Status |
|---|---|---|
| `GET /profile` | `GET /profile` | ✅ Working |
| `GET /roadmap` | `GET /roadmap` | ✅ Working |
| `GET /opportunities` | `GET /opportunities` | ✅ Working |
| `GET /notifications/unread/count` | `GET /notifications/unread/count` | ✅ Working |
| `GET /portfolio` | `GET /portfolio` | ✅ Working |

**Note:** Dashboard uses `GET /dashboard/summary` (single-call aggregation). ✅ Optimized.

**Field visibility on dashboard:**
- `name` ✅
- `email` ✅
- `career_path` ✅
- `employment_status` ✅ (labeled as "ROLE")
- `interests` ✅ (displayed as chips)
- `phone` — NOT displayed on dashboard (only in Settings)

---

### 4. Roadmap (`/roadmap`) ✅ Fully Connected

**Empty state:** "No roadmap yet" + "Generate My Roadmap" button

**Generation state:** Spinner with "Generating your roadmap… This takes 5–15 seconds."

**Generated state:**
- Left panel: Timeline/step visualization with numbered step nodes
- Center: "Begin Working on Step" CTA for current step
- Right panel: Steps sidebar with progress counter (e.g., "0/18 DONE"), task checklist per step, "Begin in Chat" button
- Step navigation: numbered buttons (1–6) for jumping between steps

**API calls:**
| Frontend Call | Backend Endpoint | Status |
|---|---|---|
| `GET /roadmap` | `GET /roadmap` | ✅ Working |
| `POST /roadmap/generate` | `POST /roadmap/generate` | ✅ Working |
| `POST /roadmap/regenerate` | `POST /roadmap/regenerate` | ✅ Available |
| Task completion | `PATCH /roadmap/tasks/{id}/complete` | ✅ Working |
| Task update | `PATCH /roadmap/tasks/{id}` | ✅ Working |

**"Begin in Chat" flow:** Clicking "Begin Working on Step" navigates to `/chat?roadmap_step=...` with a prefilled message containing the step details. The chat input is temporarily disabled while the mentor generates its first response.

**Data displayed per task:** task title, description, status (pending/complete), order

---

### 5. Chat / Mentor (`/chat`) ✅ Fully Connected

**UI elements:**
- Message area with user/assistant message bubbles (purple for user, white for assistant)
- Bottom input bar: textbox "Ask Lynks anything…" + send button (paper plane icon)
- During generation: input disabled, send button disabled
- Top-right icons (unlabeled): likely conversation actions (copy, delete)
- Conversation management in expanded sidebar with 3-dot menus

**API calls:**
| Frontend Call | Backend Endpoint | Status |
|---|---|---|
| Send message | `POST /chat/message` | ✅ Working |
| List conversations | `GET /chat/conversations` | ✅ Working |
| Get conversation messages | `GET /chat/conversations/{id}` | ✅ Working |
| Pin/unpin | `PATCH /chat/conversations/{id}` | ✅ Working |
| Reorder | `POST /chat/conversations/reorder` | ✅ Working |
| Delete conversation | `DELETE /chat/conversations/{id}` | ✅ Working |
| Clear all history | `DELETE /chat/history` | ✅ Working |

**Observations:**
- Chat works with conversation context (roadmap step data passed via URL params)
- The mentor responds with structured content including task IDs and actionable guidance
- No conversation list screen — loads last conversation or starts new one
- Conversation management is in expanded sidebar with 3-dot menus (pin, reorder, delete)

---

### 6. Opportunities (`/opportunities`) ✅ Fully Connected

**UI elements (verified via screenshot):**
- **Header:** "Opportunities" title + "Refresh" button (purple, top-right)
- **Tabs:** "Discover" (active) / "Saved (0)" — switches between all and bookmarked
- **Search:** "Search opportunities…" text input
- **Category filter chips:** All, Jobs, Scholarships, Competitions, Events, Volunteer, Clubs
- **Count:** "8 opportunities found"
- **Opportunity cards:** Each shows:
  - Title (e.g., "Caribbean Red Cross Youth Volunteer")
  - Organization (e.g., "International Red Cross")
  - Location (e.g., "CARICOM-wide")
  - Description text
  - Category badge (e.g., "Volunteer") + age requirement (e.g., "Age: Ages 15-30")
  - "Visit" link button (external link icon)
  - Bookmark icon button (save/unsave)

**API calls:**
| Frontend Call | Backend Endpoint | Status |
|---|---|---|
| List opportunities | `GET /opportunities` | ✅ Working |
| Search/filter | `GET /opportunities?search=X&category=Y` | ✅ Working |
| Save opportunity | `POST /opportunities/{id}/save` | ✅ Working (count updates) |
| Unsave | `DELETE /opportunities/{id}/save` | ✅ Working |
| Saved list | `GET /opportunities/saved` | ✅ Working |
| Refresh/scrape | `POST /opportunities/refresh` | ✅ Working |
| New count | `GET /opportunities/new-count` | ✅ Available |
| Personal matches | `GET /opportunities/matches` | ✅ Available |

**Observations:**
- Bookmark functionality confirmed working (Saved count updated from 0 → 1 after clicking bookmark)
- Category filtering via chips works
- The "Discover" vs "Saved" tab split is clean
- Each card has organization name, location, description, category badge, and age range
- No "salary/pay" field visible on cards (backend has `pay` field in schema but frontend cards don't show it)

**Gap:** The `pay` field exists in the backend schema and API response, but the frontend opportunity cards do **not display salary/pay information**. This is a frontend-only display gap.

---

### 7. Resume (`/resume`) ✅ Fully Connected

**Empty state:** "No resume yet" with "Generate My Resume" CTA + top "Generate Resume" button

**Generated state (verified via screenshot):**
- **Header:** "My Resume" + subtitle "AI-generated resume based on your profile and completed tasks"
- **Actions:** "Download PDF" button (with icon) + "Regenerate" button (purple)
- **Resume card content:**
  - Purple header with name "QA Tester" + email
  - Professional summary/objective paragraph
  - **SKILLS** section: tag chips (Software Testing, Automation Testing, Selenium WebDriver, Java, Python, REST API Testing, Git, Jenkins, Agile Methodologies, Test Planning, Bug Tracking)
  - **EDUCATION** section: institution + degree + details
  - **EXPERIENCE** section: job entries
  - **PROJECTS** section: project entries
  - **CERTIFICATIONS** section: list items (ISTQB, CSM)
  - **Interests** section

**API calls:**
| Frontend Call | Backend Endpoint | Status |
|---|---|---|
| Fetch existing resume | `GET /resume` | ✅ Working |
| Generate resume | `POST /resume/generate` | ✅ Working |
| Download PDF | `GET /resume/download` | ✅ "Download PDF" button present |

**Gaps identified:**
1. ~~**No resume editing UI**~~ ✅ **RESOLVED** — Frontend teammate has built and deployed the resume editing UI (live on the site as of competition deadline push). The `PATCH /resume` endpoint is now wired.
2. **`PATCH /resume` endpoint** — Exists in the API contract and is now connected to the frontend editing UI.

**Note:** The resume editing UI is live but **has not been fully verified end-to-end**. The backend `PATCH /resume` endpoint should be tested to confirm it saves edits correctly.

**Backend action needed:** Verify `PATCH /resume` works correctly with the new frontend editing UI.

---

### 8. Settings (`/settings`) ✅ Fully Connected

**Three tabs:** Profile, Notifications, Security

#### Profile Settings tab:
- **Avatar:** Upload new photo button + "JPG, GIF or PNG. Max size of 800K" note
- **Fields:**
  - Full Name (text input, pre-filled)
  - Email Address (text input, pre-filled, read-only appearance)
  - Phone Number (text input, placeholder "Enter your phone number")
  - Current Role (text input, pre-filled with "student")
  - Career Path (text input, pre-filled, with helper text)
  - Career Interests: suggested interest pills (Frontend Engineering, Backend Engineering, DevOps, API Design, System Design, Cloud Computing, Mobile Development, Testing & QA) + custom interest input
- **Actions:** Cancel + Continue (save) buttons

**API calls:**
| Frontend Call | Backend Endpoint | Status |
|---|---|---|
| Fetch profile | `GET /profile` | ✅ Working |
| Update profile | `PATCH /profile` | ✅ Working |
| Update career path | `PATCH /profile/career-path` | ✅ Working |
| Suggested interests | `GET /profile/suggested-interests` | ✅ Working |
| Upload avatar | `POST /profile/avatar` | ✅ Working |
| Delete avatar | `DELETE /profile/avatar` | ✅ Working |

**Field mapping:**
| Settings Field | Backend Field | Backend Support |
|---|---|---|
| Full Name | `name` | ✅ `PATCH /profile` |
| Email Address | `email` | ⚠️ Display only — not editable via API |
| Phone Number | `phone` | ✅ Backend supports it |
| Current Role | `employment_status` | ✅ `PATCH /profile` (labeled "role" in UI) |
| Career Path | `career_path` | ✅ `PATCH /profile/career-path` |
| Career Interests | `interests` | ✅ `PATCH /profile` |
| Avatar | `avatar_url` | ✅ `POST /profile/avatar` |

**Observations:** "Current Role" in the UI maps to `employment_status` in the backend — the value shown is "student" which is an employment_status value, not a job title. This naming could be confusing to users.

#### Notifications tab:
- **Content:** "Notification settings coming soon." — no settings UI
- Backend has full notification CRUD (6 endpoints) but the frontend notification settings tab is a placeholder

#### Security tab:
- **Email Verification:** Shows current email + "Verified" status
- **Change Password:** Current Password, New Password, Confirm New Password fields + "Update Password" button
- Both handled by Supabase directly — correct behavior

---

### 9. Notifications Page ❌ Missing Frontend Route

**Backend has (6 endpoints):**
| Endpoint | Purpose |
|---|---|
| `GET /notifications` | List all notifications |
| `GET /notifications/unread/count` | Unread count (used by dashboard) ✅ |
| `GET /notifications/{id}` | Get single notification |
| `POST /notifications` | Create notification |
| `PATCH /notifications/{id}/read` | Mark as read |
| `POST /notifications/read-all` | Mark all as read |

**Frontend status:**
- `/notifications` route → **404**
- No notification bell icon in the top bar or sidebar
- No notification list page
- No mark-as-read UI
- Only `GET /notifications/unread/count` is used (on the dashboard)
- Settings → Notifications tab just says "coming soon"

**Gap:** The entire notification UI is missing. The backend is fully built and ready. The frontend needs:
1. A notification bell icon (top bar or sidebar) showing unread count badge
2. A notification dropdown or dedicated page with list of notifications
3. Mark-as-read functionality (individual + mark all)
4. Notification types: new opportunities, roadmap updates, evidence verification results

**Action needed:** 🔴 **Build notification UI** — backend is complete, frontend is entirely missing.

---

### 10. Portfolio / Evidence Page — ⏸️ POSTPONED (After Competition)

> **Status:** This feature has been **postponed until after the competition**. The frontend will NOT be built before the deadline. The backend endpoints remain fully functional and ready for when this is revisited.

**Backend has:**
| Endpoint | Purpose |
|---|---|
| `GET /portfolio` | Get all completed tasks + uploaded evidence |
| `POST /portfolio/tasks/{task_id}/evidence` | Upload evidence file |
| `GET /evidence/{id}/verification` | AI verification status |
| `POST /evidence/{id}/re-verify` | Re-run verification |

**Frontend status:**
- `/portfolio` route → **404**
- `/evidence` route → **404**
- No portfolio page exists
- No evidence upload UI
- No verification status display
- No portfolio/evidence navigation item in sidebar

**Gap:** The entire portfolio/evidence feature is missing from the frontend. The backend has:
- Evidence file upload to Supabase Storage
- AI-powered evidence verification (dual-provider: Groq text + Gemini Flash vision)
- Portfolio aggregation endpoint

**Action needed:** ⏸️ **POSTPONED** — Not being built before the competition deadline. Revisit after the competition ends.

---

### 11. Profile Pictures ✅ Backend Complete, Frontend Wired

**Backend:** `POST /profile/avatar` + `DELETE /profile/avatar` + `profile-pictures` storage bucket
**Frontend:** Settings page has "Upload new photo" button + file picker + avatar display

**Status:** ✅ Complete (per previous audit)

---

## Sidebar Navigation (Verified)

The left sidebar icon rail contains these items (always visible):

| Icon | Page | Route |
|---|---|---|
| Home | Dashboard | `/dashboard` |
| Steps | Steps/Tasks view | (step details) |
| Roadmap | Roadmap | `/roadmap` |
| Chat | Mentor Chat | `/chat` |
| Resume | Resume | `/resume` |
| Settings | Settings | `/settings` |
| User avatar | Profile/logout | (dropdown) |

**Missing from sidebar:**
- 🔴 Notifications (bell icon) — no entry point
- ⏸️ Portfolio/Evidence — POSTPONED (after competition)
- ✅ Opportunities — IS in the sidebar (confirmed)

**Top bar icons (per page):**
- Dashboard: steps, roadmap, chat, resume icons (top right)
- These hide when you're on that page's route
- No notification bell anywhere

---

## Gaps Summary — Action Items by Priority

### 🔴 Must Fix (Missing Pages / Broken UX)

| # | Issue | Frontend Gap | Backend Status | Effort |
|---|---|---|---|---|
| 1 | **Notifications page** — `/notifications` returns 404 | No route, no bell icon, no list UI | ✅ 6 endpoints ready | Medium |
| 2 | ~~**Portfolio/Evidence page**~~ | ⏸️ **POSTPONED** — not being built before competition | ✅ Backend endpoints ready | Post-competition |
| 3 | ~~**Resume editing**~~ | ✅ **RESOLVED** — teammate built editing UI and deployed | ✅ `PATCH /resume` exists | Done |

### 🟡 Should Fix (Wiring / Field Gaps)

| # | Issue | Details | Effort |
|---|---|---|---|
| 4 | ~~**Opportunities: salary not displayed**~~ | ✅ **RESOLVED** — Green salary badge now shows on opportunity cards | Done |
| 5 | ~~**Opportunities: no sidebar icon**~~ | ✅ **RESOLVED** — Opportunities is in the sidebar | Done |
| 6 | **Onboarding bypasses backend** | Writes directly to Supabase instead of `PATCH /profile` | Small — deferred post-competition |
| 7 | **"Current Role" label confusing** | Shows employment_status values ("student") as if it's a job title | Small |
| 8 | **Notification settings tab** | Just says "coming soon" — no actual notification preferences UI | Small — deferred post-competition |

### 🟢 Nice to Have (Optimizations)

| # | Issue | Details | Effort |
|---|---|---|---|
| 9 | ~~**Dashboard: consolidate API calls**~~ | ✅ **RESOLVED** — Dashboard uses `GET /dashboard/summary` | Done |
| 10 | ~~**AppLayout: Supabase direct read**~~ | ✅ **RESOLVED** — Sidebar reads user name from `GET /profile` | Done |
| 11 | **Opportunity "Personal matches" tab** | Backend has `GET /opportunities/matches` — verify frontend "Saved" tab doesn't conflate this | Small |

---

## Backend Endpoints the Frontend Doesn't Use Yet

| Endpoint | What It Does | Frontend Status |
|---|---|---|
| `GET /dashboard/summary` | Single-call dashboard aggregation | ✅ Dashboard uses this (single call) |
| `PATCH /resume` | Edit resume content | ✅ Resume editing UI wired (built by teammate) |
| `GET /resume/download` | Download resume as PDF | ⚠️ Button exists — verify it actually triggers download |
| `GET /notifications` | Full notification list | ❌ No notification page |
| `GET /notifications/{id}` | Single notification detail | ❌ No notification page |
| `POST /notifications` | Create notification | ❌ Admin/system use only |
| `PATCH /notifications/{id}/read` | Mark single notification read | ❌ No UI |
| `POST /notifications/read-all` | Mark all notifications read | ❌ No UI |
| `GET /portfolio` | Portfolio with evidence | ❌ No portfolio page |
| `POST /portfolio/tasks/{task_id}/evidence` | Upload evidence | ❌ No upload UI |
| `GET /evidence/{id}/verification` | Verification status | ❌ No display |
| `POST /evidence/{id}/re-verify` | Re-run verification | ❌ No UI |
| `GET /opportunities/matches` | Personalized opportunity scoring | ⚠️ May be unused — check if "Saved" tab conflates |
| `GET /opportunities/scheduler/status` | Scraper scheduler status | ❌ No admin UI |
| `GET /memory` | User memory management | ❌ No UI (internal to mentor) |
| `POST /memory` | Create memory entry | ❌ No UI |
| `PATCH /memory/{id}` | Update memory | ❌ No UI |
| `DELETE /memory/{id}` | Delete memory | ❌ No UI |

---

## PRD Requirements vs Implementation Status

| PRD Requirement | Backend | Frontend | Status |
|---|---|---|---|
| Accept/store user account info | ✅ Users table | ✅ Signup → Supabase | ✅ |
| User authentication | ✅ Supabase Auth | ✅ Supabase SDK | ✅ |
| Profile creation (interests, age, country, education, career path) | ✅ `PATCH /profile` | ✅ Onboarding flow | ✅ |
| Edit profile / switch career paths | ✅ `PATCH /profile` + `PATCH /profile/career-path` | ✅ Settings page | ✅ |
| AI-generated roadmap from profile | ✅ `POST /roadmap/generate` | ✅ Roadmap page | ✅ |
| Present roadmap as steps/tasks | ✅ Nested structure | ✅ Timeline + task list | ✅ |
| Regenerate roadmap | ✅ `POST /roadmap/regenerate` | ✅ Regenerate button | ✅ |
| Mark task complete | ✅ `PATCH /tasks/{id}/complete` | ✅ Checkbox UI | ✅ |
| Upload evidence for task | ✅ `POST /tasks/{id}/evidence` | ⏸️ **POSTPONED** — no upload UI before competition | Post-competition |
| AI-verify certificates | ✅ Portfolio Manager agent | ⏸️ **POSTPONED** — no verification display before competition | Post-competition |
| Store evidence in object storage | ✅ Supabase Storage | ⏸️ **POSTPONED** — no portfolio page before competition | Post-competition |
| Auto-generate resume from tasks | ✅ `POST /resume/generate` | ✅ Generate button | ✅ |
| Review/edit resume | ✅ `PATCH /resume` | ✅ Editing UI (built by teammate, live but unverified) | ✅ |
| Browse opportunities (tabbed) | ✅ Full CRUD | ✅ Discover/Saved tabs | ✅ |
| Filter by location/pay/age/experience | ✅ Query params | ✅ Category chips + search | ✅ |
| Chat with mentor (persistent) | ✅ Full conversation CRUD | ✅ Chat page | ✅ |
| Chat uses conversation history | ✅ History + summarization | ✅ Loads past messages | ✅ |
| Chat tool-calling (roadmap, portfolio, opportunities) | ✅ Mentor orchestrator | ✅ Context passed via URL params | ✅ |
| Notifications (new opportunities, updates) | ✅ 6 endpoints | ❌ **No notification UI** | ❌ |

---

## CORS Configuration

**Previously fixed:** Backend CORS now includes `https://lynks-gen-ai.web.app` alongside localhost origins. No CORS issues observed during this audit.

---

## Recommendations (Priority Order)

1. ~~**🔴 Build Notifications UI**~~ — ⏸️ **POSTPONED** until after the competition. Backend is 100% ready.

2. ~~**🔴 Build Portfolio/Evidence page**~~ — ⏸️ **POSTPONED** until after the competition. Backend endpoints remain ready.

3. ~~**🔴 Add Resume Editing**~~ — ✅ **RESOLVED** — Frontend teammate has built and deployed the resume editing UI.

4. ~~**🟡 Show salary on opportunity cards**~~ — ✅ **RESOLVED** — Green salary badge now shows on cards.

5. ~~**🟡 Add Opportunities to sidebar**~~ — ✅ **RESOLVED** — Opportunities is in the sidebar.

6. **🟡 Fix "Current Role" labeling** — Rename to "Employment Status" or change the dropdown to actual role titles instead of status values.

7. **🟢 Wire onboarding to `PATCH /profile`** — For consistency and future-proofing. Deferred post-competition.

8. ~~**🟢 Use `GET /dashboard/summary`~~** — ✅ **RESOLVED** — Dashboard already uses the summary endpoint.

---

## Model Routing (Implemented Sep 10, 2026)

**Status:** ✅ Complete and merged to main

All LLM calls in the backend now go through a centralized model router (`backend/app/services/model_router.py`) via the `call_llm()` function. This replaces direct `OpenAI()` calls in every agent.

**What changed:**
- `mentor.py` — uses `call_llm(messages, task_type="chat")` for mentor conversations
- `architect.py` — uses `call_llm(messages, task_type="roadmap_generation")` for roadmap generation
- `scout.py` — uses `call_llm(messages, task_type="analysis")` for opportunity matching
- `memory_extractor.py` — uses `call_llm(messages, task_type="memory_extraction")` for fact extraction
- `opportunity_scraper.py` — uses `call_llm(messages, task_type="opportunity_extraction")` for LLM-generated opportunities

**Benefits:**
- Task-based model selection (70B for complex tasks, 8B for simple extraction)
- Automatic fallback chains if primary model is unavailable
- Centralized logging of model usage
- Easy to swap models without touching agent code

**Files:** `backend/app/services/model_router.py`, `backend/app/models/models.json`, `backend/tests/unit/test_model_router.py` (26 tests)

---

*This audit was generated by crawling the live site at https://lynks-gen-ai.web.app on September 6, 2026, updated September 10, 2026, and cross-referencing against the backend at https://lynks-backend-production.up.railway.app.*
