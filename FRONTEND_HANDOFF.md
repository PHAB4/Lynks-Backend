# Lynks Frontend Handoff — Opportunities Upgrade

**Date:** August 27, 2026
**Branch:** `feature/opportunities-scraper-upgrade`
**Backend URL:** `https://lynks-backend-production.up.railway.app`

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

### Opportunity Card

Each card should display:
- **Title** — bold, prominent
- **Company/Organization** — subtitle
- **Category** — colored badge (job=green, scholarship=blue, competition=purple, etc.)
- **Location** — with map pin icon
- **Salary** — only for jobs. Format: `"JMD $50,000 - $80,000/month"` using `salary_min`, `salary_max`, `salary_currency`. For non-jobs, show `pay` text field or nothing.
- **Description** — truncated to 2 lines
- **Image** — top of card if `image_url` is not null, otherwise show category icon placeholder
- **"Go to Source" button** — links to `url` (opens in new tab)
- **Save/Unsave button** — heart/bookmark icon, toggles based on `is_saved`

### Filtering UI

- **Category tabs/pills:** All | Jobs | Scholarships | Competitions | Events | Clubs | Volunteer
- **Timeframe dropdown:** This Week | This Month | This Quarter | All Time
- **Sort dropdown:** Relevance | Most Recent | Highest Salary
- **Load More / pagination:** Show "Load More" button when `has_more` is true

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
