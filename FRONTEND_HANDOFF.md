# Lynks Frontend Handoff — Current Build State

**Date:** August 27, 2026 (updated September 10, 2026)
**Branch:** `main`
**Backend URL:** `https://lynks-backend-production.up.railway.app`
**Frontend URL:** `https://lynks-gen-ai.web.app` (Firebase Hosting)

---

## Integration Status (as of Sept 10, 2026)

All frontend pages are now connected to the backend API:

| Page | Status | Notes |
|---|---|---|
| `/dashboard` | ✅ Connected | Uses `dashboard-api.ts`. Has tab navigation (Overview, Skills, Experience, Goals, Resources) |
| `/roadmap` | ✅ Connected | Uses `roadmap-api.ts` |
| `/opportunities` | ✅ Connected | Full backend integration (filtering, save/unsave, refresh) |
| `/resume` | ✅ Connected | Uses backend `GET /resume`, `POST /resume/generate` |
| `/settings` | ✅ Connected | Uses `GET /profile`, `PATCH /profile`. Suggested interests are **dynamic** — fetched from `GET /profile/suggested-interests` based on user's career path |
| `/chat` | ✅ Connected | Full backend integration. No conversations list screen — loads last conversation or starts new. Conversation management (pin/reorder/delete) is in the expanded sidebar with 3-dot menus |
| `/onboarding` | ⚠️ Partial | Writes to Supabase directly — should use `PATCH /profile` |

---

## What Changed

The opportunities system was upgraded from a basic list to a full-featured scraper with filtering, sorting, pagination, bookmarks, and notifications. Here's everything you need to build the opportunities page.

---

## Opportunities Page — Endpoints

### List Opportunities (main endpoint)

```
GET /opportunities?category=job&timeframe=week&sort=recent&page=1&limit=20
Authorization: Bearer <token>
```

**Response:**
```json
{
  "opportunities": [
    {
      "id": "abc123",
      "title": "Frontend Developer",
      "company": "TechBeach",
      "location": "Kingston, Jamaica",
      "category": "job",
      "description": "Build modern web apps...",
      "salary_min": 50000,
      "salary_max": 80000,
      "salary_currency": "JMD (auto-detected — 22+ currencies supported, source-context-aware)",
      "pay": "JMD $50,000-$80,000/month",
      "posted_at": "2026-08-20T10:00:00Z",
      "first_seen_at": "2026-08-27T14:00:00Z",
      "source_name": "curated",
      "url": "https://original-source.com/apply",
      "image_url": "https://... or null",
      "age_requirement": "18-25",
      "experience_required": "Beginner",
      "is_saved": false
    }
  ],
  "metadata": {
    "total_available": 42,
    "has_more": true,
    "available_categories": ["job", "scholarship", "competition", "event", "club", "volunteer"],
    "filters_applied": {
      "category": "job",
      "timeframe": "week",
      "sort": "recent"
    }
  }
}
```

**Query Parameters:**

| Param | Type | Default | Options |
|-------|------|---------|---------|
| category | string | null | `job`, `scholarship`, `competition`, `event`, `club`, `volunteer` |
| timeframe | string | null | `day`, `week`, `month`, `quarter`, `all` |
| sort | string | `relevance` | `relevance`, `recent`, `salary` |
| page | int | 1 | 1, 2, 3... |
| limit | int | 20 | 1-50 |

### Save an Opportunity

```
POST /opportunities/{id}/save
Authorization: Bearer <token>
```
Returns: `200 { "success": true, "saved_at": "..." }` or `409` if already saved.

### Unsave an Opportunity

```
DELETE /opportunities/{id}/save
Authorization: Bearer <token>
```
Returns: `200 { "status": "ok", "message": "..." }`

### List Saved Opportunities

```
GET /opportunities/saved
Authorization: Bearer <token>
```
Returns: `{ "saved": [...], "total": 5 }`

### Check for New Opportunities (polling)

```
GET /opportunities/new-count
Authorization: Bearer <token>
```
Returns: `{ "new_count": 5, "new_since": "2026-08-27T00:00:00Z" }`

**Recommendation:** Poll every 5 minutes. Show badge when `new_count > 0`.

### Trigger Refresh (optional)

```
POST /opportunities/refresh
Authorization: Bearer <token>
```
Returns: `{ "status": "ok", "count": 42, "sources": ["curated", "devpost", ...] }`

---

## Notifications — Endpoints

### Get Unread Count (for bell badge)

```
GET /notifications/unread/count
Authorization: Bearer <token>
```
Returns: `{ "unread_count": 5 }`

### List Notifications

```
GET /notifications?type=opportunity&is_read=false&limit=20&offset=0
Authorization: Bearer <token>
```
Returns: `{ "notifications": [...], "unread_count": 5 }`

### Mark One as Read

```
PATCH /notifications/{id}/read
Authorization: Bearer <token>
```

### Mark All as Read

```
POST /notifications/read-all
Authorization: Bearer <token>
```

---

## UI Guidance

### Opportunity Page Layout

The opportunities page uses a two-tab filter system at the top:

- **Filter tabs:** "All Web-scraped" | "Personal matches"
  - "All Web-scraped" shows all opportunities in the current view
  - "Personal matches" shows opportunities tailored to the user's profile
- **Time filter dropdown:** Today | This Week | This Month
- **Save icon:** Toggle saved view (shows only bookmarked opportunities)
- **VIEW Mode dropdown:** Career | General
  - "Career" shows ONLY job opportunities
  - "General" shows ALL scraped opportunities (jobs, internships, youth groups, grants, education, etc.)
  - Filter tabs are scoped to the current VIEW mode

### Opportunity Card

Each card should display:
- **Company initial** — circular avatar with company first letter
- **Title** — bold, prominent
- **Type badge** — (e.g., "Job", "Internship", "Youth Group", "Grant") — shown on General view
- **Company/Organization** — subtitle
- **Location** — with map pin icon
- **Salary** — only for jobs. Format: `"JMD $50,000 - $80,000/month"` using `salary_min`, `salary_max`, `salary_currency`. For non-jobs, show `pay` text field or nothing.
- **Recency number** — top right, shows scrape order (1 = most recent)
- **Save/Unsave icon** — bookmark icon, fills with `#6B26EA` when saved
- **"Go to source" button** — links to `url` (opens in new tab), purple `#6B26EA` background

### Split-Screen System (AppLayout)

The app uses a split-screen layout with a collapsible sidebar and up to 2 simultaneous panels:

**Left Sidebar (always visible):**
- **Collapsed (75px):** LYNKS logo (click to expand), Home icon, Opportunities icon, Profile icon, avatar
- **Expanded (305px):** LYNKS title, Back arrow (collapse), Home link, Opportunities link, Projects list, Profile section with Settings/Logout
- Left sidebar nav icons are **ALWAYS visible** — they are never filtered or hidden regardless of which page you're on
- Clicking any panel icon auto-collapses the sidebar
- Expanding sidebar closes the rightmost open panel
- **Chat conversation management** (pin/reorder/delete) lives in the expanded sidebar with 3-dot menus

**Top Icon Bar (context-aware):**
- 4 icons: Steps, Roadmap, Chat, Resume — right-justified
- Panel icons **hide when you're on that page's route** (e.g., on `/chat`, the Chat icon hides; on `/roadmap`, the Roadmap icon hides)
- Click icon → opens/closes corresponding panel

**Panel Rules:**
- Max 2 panels open at a time
- Chat and Roadmap → left side
- Steps and Resume → right side
- Clicking a same-side icon replaces the existing panel on that side
- When 2 panels are open, center page content is hidden and panels fill full width
- When 0-1 panels, center page content shows with panels at fixed 420px width
- Loading spinner (2s) shown while panel content generates

**Panel Contents:**
- **Chat:** Message input, AI response area. No conversations list screen — loads the last conversation automatically, or starts a new one if none exist. Conversation management (pin/reorder/delete) is in the expanded sidebar with 3-dot menus.
- **Steps:** Steps list (populated from roadmap)
- **Roadmap:** Visual roadmap timeline
- **Resume:** Resume preview with Word/PDF download and "Edit resume" button
  - "Edit resume" opens both Chat + Resume panels simultaneously

### Notification Badge

- Poll `GET /opportunities/new-count` every 5 minutes
- Show red badge on "Opportunities" tab when `new_count > 0`
- Poll `GET /notifications/unread/count` every 5 minutes
- Show red badge on bell icon when `unread_count > 0`

### "Ask About This" Button

No backend changes needed. Pre-fill the chat input with:
```
Tell me more about the [opportunity title] at [company]. It's a [category] opportunity located in [location].
```
Then navigate to `/chat`.

### Password Validation

Login and Signup require passwords with:
- At least 8 characters
- 1 uppercase letter
- 1 lowercase letter
- 1 number
- 1 special character

**Signup form** includes: email, password, and confirm password fields only (no name field). Both password fields have an **eye toggle (peek button)** to show/hide the entered text. **Real-time password validation indicators** (✓/✗) are shown on the signup page as the user types.

After signup → redirect to `/onboarding` (7 steps, first step is name) → after onboarding → redirect to `/dashboard`.

---

## Error Handling

All errors follow this shape:
```json
{ "detail": { "error": { "code": "...", "message": "..." } } }
```

| Status | Code | Meaning |
|--------|------|---------|
| 400 | bad_request | Invalid query params |
| 401 | unauthorized | Missing or expired token |
| 404 | not_found | Resource doesn't exist |
| 409 | conflict | Already saved |
| 429 | rate_limited | Too many requests (Retry-After header) |
| 500 | server_error | Something broke on our end |

---

## Key Things to Know

1. **`image_url` can be null** — always have a placeholder ready
2. **`salary_min/max/currency` are only for jobs** — other categories will have these as null. Currency is auto-detected (22+ currencies) and source-context-aware (bare `$` from a Jamaican source → JMD, Trinidad → TTD, etc.)
3. **`is_saved` is included in every opportunity** — no separate call needed to check
4. **`url` is always present** — this is where "Go to Source" links to
5. **Pagination is offset-based** — `page=1&limit=20`, increment page to load more
6. **Opportunities refresh every hour** — data might not change immediately
7. **`pay` is a fallback** — if salary_min/max are null, use the `pay` text field for display

---

## Auth Flow

- **"Get started"** and **"Sign up"** both go to `/signup`
- **Signup form:** email + password + confirm password only (no name field)
- Both password fields have **eye toggle (peek button)** to show/hide text
- Real-time password validation indicators on signup
- After signup → redirect to `/onboarding` (7 steps: name, country, age, employment, education, career path, interests)
- After onboarding → redirect to `/dashboard`

### Auth Guard (`useAuthGate()`)

Protected pages use the `useAuthGate()` hook which returns `{ checked, loading, user }`:
- While `!checked` → show loading spinner (do NOT redirect)
- When `checked && !user` → redirect to `/login`
- When `checked && user` → render the page

This prevents premature redirects before auth state is determined.

---

## Profile Routes

| Method | Endpoint | Notes |
|--------|----------|-------|
| `GET` | `/profile` | Returns full user profile |
| `PATCH` | `/profile` | Updates name, age, country, education, interests |
| `PATCH` | `/profile/career-path` | Updates career_path field |
| `POST` | `/profile/avatar` | Upload profile avatar |
| `GET` | `/profile/suggested-interests` | Returns career-path-aware interest suggestions (14 career domains with matched interests). **Used by Settings page — no more hardcoded `CAREER_INTERESTS` array** |

---

## Dashboard

The dashboard has **tab navigation** with the following tabs:
- **Overview** — welcome message, recent activity, quick actions
- **Skills** — user's skills and competencies
- **Experience** — portfolio items and evidence
- **Goals** — career goals and progress
- **Resources** — recommended resources and opportunities

---

## Deployment

- **Backend:** Railway — `https://lynks-backend-production.up.railway.app`
- **Frontend:** Firebase Hosting — `https://lynks-gen-ai.web.app`
