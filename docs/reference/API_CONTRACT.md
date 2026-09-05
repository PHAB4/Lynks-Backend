# Lynks API Contract

> **Last updated:** September 5, 2026 (end of day — added pin, reorder, delete conversation endpoints)
> **Base URL:** `http://localhost:8000` (local) / `https://lynks-backend-production.up.railway.app` (production)
> **Auth:** Bearer token in `Authorization` header (Supabase JWT)
> **Content-Type:** `application/json` (except evidence upload: `multipart/form-data`)

---

## Authentication

Every endpoint except `GET /health` requires:
```
Authorization: Bearer <supabase_jwt_token>
```

Tokens are obtained via Supabase Auth (`/auth/v1/signup` or `/auth/v1/token`). They expire after ~1 hour.

---

## Endpoints

### GET /health
No auth required.
```json
Response 200: { "status": "ok" }
```

---

### GET /profile
Returns the authenticated user's full profile.
```json
Response 200: {
  "id": "uuid",
  "email": "string",
  "username": "string | null",
  "name": "string | null",
  "age": "int | null",
  "country": "string | null",
  "education_level": "string | null",
  "employment_status": "string | null",
  "phone": "string | null",
  "avatar_url": "string | null",
  "career_path": "string | null",
  "interests": ["string"] | null,
  "created_at": "datetime"
}
```

---

### PATCH /profile
Updates profile fields. Only sends fields that are set.
```json
Request: {
  "name": "Jordan",          // optional
  "age": 17,                 // optional
  "country": "Jamaica",      // optional
  "education_level": "High School",  // optional
  "phone": "+1-876-555-1234",    // optional
  "interests": ["coding", "AI"]      // optional
}

Response 200: (same shape as GET /profile)
```

---

### PATCH /profile/career-path
Updates only the career path.
```json
Request: { "career_path": "Software Development" }
Response 200: { "career_path": "Software Development" }
```

---

### POST /profile/avatar
Upload a profile picture. Replaces any existing avatar (old file is deleted).

```http
Content-Type: multipart/form-data

Request (form fields):
  file: <binary image data>    // required — JPEG, PNG, or GIF, max 800KB

Example (curl):
  curl -X POST /profile/avatar \
    -H "Authorization: Bearer <token>" \
    -F "file=@profile.jpg"
```
```json
Response 200: { "avatar_url": "https://..." }
Response 400: { "detail": "Invalid file type: ..." }
Response 400: { "detail": "File too large: ..." }
```

---

### DELETE /profile/avatar
Remove the user's profile picture.
```json
Request: (none)

Response 200: { "message": "Profile picture removed" }
Response 404: { "detail": "No profile picture to remove" }
```

---

### POST /roadmap/generate
Generates a new career roadmap using the LLM. ⚠️ Takes 5-15 seconds.
```json
Response 201: {
  "roadmap_id": "uuid",
  "steps": [
    {
      "step_id": "uuid",
      "title": "string",
      "description": "string",
      "order": 1,
      "status": "pending | complete",
      "tasks": [
        {
          "task_id": "uuid",
          "title": "string",
          "description": "string",
          "order": 1,
          "status": "pending | complete"
        }
      ]
    }
  ]
}
```

Errors:
- 400: `profile_incomplete` — missing career_path, education_level, or country

---

### GET /roadmap
Returns the user's active roadmap with all steps and tasks.
```json
Response 200: (same shape as POST /roadmap/generate)
```

---

### POST /roadmap/regenerate
Deactivates the current roadmap and generates a new one. ⚠️ Takes 5-15 seconds.
```json
Response 201: (same shape as POST /roadmap/generate)
```

---


### PATCH /roadmap/tasks/{task_id}/complete
Marks a task as complete from the Roadmap page (e.g., clicking a checkbox).
Validates that the task belongs to the user's active roadmap. Idempotent — completing an already-complete task returns success.
```
Response 200: {
  "success": true,
  "task_id": "uuid",
  "title": "Complete Python course on Coursera",
  "message": "Task 'Complete Python course on Coursera' marked as complete!"
}

Errors:
  404 — task_not_found: No task with that ID
  403 — not_your_task: Task doesn't belong to user's active roadmap
  403 — roadmap_inactive: Cannot complete tasks on an inactive roadmap
```
> **Note:** Step status is computed dynamically from child tasks — completing a task may change the parent step's status in subsequent GET /roadmap responses.

---

### PATCH /roadmap/tasks/{task_id}
General task update — change title, description, or status. Only includes fields you want to change (partial update).
Validates ownership (task must belong to user's active roadmap).
```
Request: {
  "title": "string (optional)",
  "description": "string (optional)",
  "status": "pending | in_progress | complete (optional)"
}

Response 200: {
  "success": true,
  "task_id": "uuid",
  "title": "Updated task title",
  "status": "in_progress",
  "message": "Task 'Updated task title' updated successfully!"
}

Errors:
  400 — invalid_status: Status must be one of: complete, in_progress, pending
  404 — task_not_found: No task with that ID
  403 — not_your_task: Task doesn't belong to user's active roadmap
  403 — roadmap_inactive: Cannot update tasks on an inactive roadmap
```
> **Note:** If status is set to "complete", `completed_at` is set automatically. If reverted from complete to pending/in_progress, `completed_at` is cleared.

---

### POST /tasks/{task_id}/evidence
Uploads an evidence file for a task. Uses `multipart/form-data`.
The file is validated, uploaded to Supabase Storage, and verified by Gemini 3.5 Flash (vision model via Google AI Studio).
```
Content-Type: multipart/form-data
Body: file_type=<mime type>&file=<image file>

Response 201: {
  "id": "uuid",
  "task_id": "uuid",
  "file_url": "https://...",
  "file_type": "image/png",
  "verification_status": "pending | verified | rejected",
  "verification_reason": "Legitimate Coursera certificate for Python course",
  "verification_confidence": "high | medium | low",
  "verified_at": "datetime | null",
  "uploaded_at": "datetime"
}
```

---

### GET /portfolio
Returns all tasks that have evidence attached.
```json
Response 200: [
  {
    "task_id": "uuid",
    "title": "string",
    "evidence": [
      {
        "id": "uuid",
        "file_url": "https://...",
        "file_type": "image/png",
        "verification_status": "pending | verified | rejected",
        "verification_reason": "Legitimate Coursera certificate",
        "verification_confidence": "high",
        "verified_at": "2026-08-28T12:00:00Z",
        "uploaded_at": "datetime"
      }
    ]
  }
]
```

---

### GET /evidence/{evidence_id}/verification
Returns the full verification details for a single piece of evidence.
```json
Response 200: {
  "evidence_id": "uuid",
  "verification_status": "verified",
  "verification_reason": "Legitimate Coursera certificate for Python course",
  "verification_confidence": "high",
  "verified_at": "2026-08-28T12:00:00Z"
}
```

Errors:
- 404: `evidence_not_found` — evidence doesn't exist
- 403: `forbidden` — evidence doesn't belong to the user

---

### POST /evidence/{evidence_id}/re-verify
Re-runs AI verification on existing evidence. Useful when an image was wrongly rejected.
Fetches the file from Supabase Storage and sends it to Gemini 3.5 Flash again.
```json
Response 200: {
  "id": "uuid",
  "verification_status": "verified",
  "verification_reason": "On re-analysis, this is a legitimate AWS certificate",
  "verification_confidence": "medium",
  "verified_at": "2026-08-28T12:05:00Z"
}
```

Errors:
- 404: `evidence_not_found`
- 403: `forbidden`
- 502: `verification_failed` — Gemini API error during re-verification

---

### GET /opportunities
Returns Caribbean opportunities with filtering, sorting, and pagination.

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| category | string | null | Filter by: job, club, competition, scholarship, event, volunteer |
| timeframe | string | null | Filter by: day, week, month, quarter, all |
| sort | string | relevance | Sort by: relevance (LLM), recent (posted_at), salary |
| page | int | 1 | Page number (offset pagination) |
| limit | int | 20 | Results per page (max 50) |
| saved_only | bool | false | Only return saved opportunities |

```json
Response 200: {
  "opportunities": [
    {
      "id": "string (md5 hash of title)",
      "title": "string",
      "company": "string",
      "location": "string",
      "description": "string",
      "category": "job|club|competition|scholarship|event|volunteer",
      "pay": "string",
      "salary_min": "number | null (jobs only)",
      "salary_max": "number | null (jobs only)",
      "salary_currency": "JMD (auto-detected from 22+ ISO 4217 currencies, source-context-aware)",
      "age_requirement": "string | null",
      "experience_required": "string",
      "url": "string (Go to source link)",
      "posted_at": "datetime | null",
      "first_seen_at": "datetime | null",
      "source_name": "devpost_api|eventbrite_api|rss_*|facebook_*|instagram_*|llm_generated|curated",
      "image_url": "string | null (frontend shows placeholder when null)",
      "is_saved": true | false,
      "relevance_score": "number | null"
    }
  ],
  "metadata": {
    "total_available": 42,
    "returned": 20,
    "page": 1,
    "limit": 20,
    "has_more": true,
    "available_categories": ["job", "club", "competition", "scholarship", "event", "volunteer"],
    "filters_applied": {
      "category": "job",
      "timeframe": "week",
      "sort": "relevance"
    }
  }
}
```

**Errors:**
- 400: `invalid_category` — category not in allowed values
- 400: `invalid_timeframe` — timeframe not in allowed values
- 400: `invalid_sort` — sort not in allowed values
- 404: `user_not_found` — user ID doesn't exist

---

### GET /opportunities/matches
Returns personalized opportunity matches for the authenticated user.
Uses rule-based scoring (career path, education, age, interests, location).
Only returns opportunities with `relevance_score >= 50`, sorted by score descending.

```json
Query Parameters: page (int, default 1), limit (int, default 20)
Response 200: {
  "opportunities": [
    {
      "id": "string (md5 hash of title)",
      "title": "string",
      "company": "string",
      "location": "string",
      "description": "string",
      "category": "string",
      "pay": "string",
      "salary_min": "number | null",
      "salary_max": "number | null",
      "salary_currency": "string | null",
      "age_requirement": "string | null",
      "experience_required": "string",
      "url": "string",
      "posted_at": "datetime | null",
      "first_seen_at": "datetime | null",
      "source_name": "string",
      "image_url": "string | null",
      "is_saved": true | false,
      "relevance_score": 85
    }
  ],
  "metadata": {
    "total_available": 12,
    "returned": 12,
    "page": 1,
    "limit": 20,
    "has_more": false,
    "filters_applied": {
      "personal_match": true
    }
  }
}
```

**Errors:**
- 404: `user_not_found` — user ID doesn't exist

---

### GET /opportunities/new-count
Returns count of new opportunities (first seen in last 24 hours).

Frontend polls this endpoint every few minutes to show a notification badge.
```json
Response 200: {
  "new_count": 5,
  "new_since": "2026-08-25T00:00:00Z"
}
```

---

### GET /opportunities/saved
Lists all saved opportunities for the authenticated user.
```json
Response 200: {
  "saved": [
    { "... opportunity object with is_saved: true ..." }
  ],
  "total": 15
}
```

---

### POST /opportunities/{opportunity_id}/save
Saves/bookmarks an opportunity for the authenticated user.
```json
Response 201: {
  "success": true,
  "saved_at": "2026-08-26T10:00:00Z"
}
```

**Errors:**
- 409: `already_saved` — user already saved this opportunity
- 501: `table_not_found` — saved_opportunities table not created yet (run migration SQL)

---

### DELETE /opportunities/{opportunity_id}/save
Removes a saved opportunity.
```json
Response 200: { "success": true }
```

**Errors:**
- 404: `not_found` — this opportunity was not saved
- 501: `table_not_found` — saved_opportunities table not created yet

---

## Notification Endpoints

### GET /notifications
Lists all notifications for the authenticated user.

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| type | string | null | Filter by: opportunity, task, badge, reminder |
| is_read | bool | null | Filter by read status |
| limit | int | 50 | Results per page (max 100) |
| offset | int | 0 | Pagination offset |

```json
Response 200: {
  "notifications": [
    {
      "id": "uuid",
      "title": "New opportunity: JS Hackathon",
      "body": "A new opportunity matching your profile has been found.",
      "type": "opportunity",
      "link": { "type": "opportunity", "id": "abc123" },
      "is_read": false,
      "created_at": "2026-08-26T10:00:00Z"
    }
  ],
  "unread_count": 5
}
```

---

### GET /notifications/unread/count
Returns count of unread notifications. Frontend polls this for the bell badge.

```json
Response 200: {
  "unread_count": 5
}
```

---

### GET /notifications/{notification_id}
Returns a specific notification.

```json
Response 200: {
  "id": "uuid",
  "title": "New opportunity: JS Hackathon",
  "body": "A new opportunity matching your profile has been found.",
  "type": "opportunity",
  "link": { "type": "opportunity", "id": "abc123" },
  "is_read": false,
  "created_at": "2026-08-26T10:00:00Z"
}
```

**Errors:**
- 404: `not_found` — notification doesn't exist or doesn't belong to user

---

### POST /notifications
Creates a new notification. For admin/utility use (triggered by the system).

```json
Request: {
  "title": "string (required)",
  "body": "string (optional)",
  "type": "reminder (default) | opportunity | task | badge",
  "link": { "type": "opportunity", "id": "abc123" }  // optional
}

Response 201: {
  "id": "uuid",
  "title": "string",
  "body": "string | null",
  "type": "string",
  "link": { ... } | null,
  "is_read": false,
  "created_at": "datetime"
}
```

---

### PATCH /notifications/{notification_id}/read
Marks a single notification as read.

```json
Response 200: {
  "status": "ok",
  "message": "Notification marked as read"
}
```

**Errors:**
- 404: `not_found` — notification doesn't exist or doesn't belong to user

---

### POST /notifications/read-all
Marks all of the user's notifications as read.

```json
Response 200: {
  "status": "ok",
  "message": "Marked 12 notifications as read"
}
```

---

### POST /chat/message
Sends a message to the Mentor agent. ⚠️ Takes 5-15 seconds.
```json
Request: {
  "message": "string (required)",
  "conversation_id": "uuid | null"  // null = new conversation
}

Response 200: {
  "conversation_id": "uuid",
  "response": "string",
  "tool_calls": ["dict"] | null,
  "summary_updated": true | false  // true if conversation summary was generated
}
```

---

### GET /chat/history?conversation_id={uuid}
Returns all messages in a conversation.
```json
Response 200: {
  "conversation_id": "uuid",
  "messages": [
    {
      "role": "user | assistant | tool",
      "content": "string",
      "tool_calls": ["dict"] | null,
      "created_at": "datetime"
    }
  ]
}
```

---

### DELETE /chat/history
Deletes all conversations and messages for the authenticated user.
```json
Response 200: { "success": true }
```

---

### GET /chat/conversations
Lists all conversations for the user (for sidebar). Returns titles, summaries, timestamps, message counts, and pin/sort status.
```json
Response 200: {
  "conversations": [
    {
      "conversation_id": "uuid",
      "title": "string | null",
      "summary": "string | null",
      "message_count": 5,
      "is_pinned": false,
      "created_at": "datetime"
    }
  ]
}
```

**Notes:**
- `title` is derived from the first user message (truncated to 60 chars) if no summary exists
- `summary` is the LLM-generated conversation summary (set after 15+ messages)
- Returns up to 50 conversations, sorted by: pinned first, then by sort_order, then by created_at (newest first)
- Messages are NOT loaded — only metadata for the sidebar

---

### GET /chat/conversations/{conversation_id}
Returns all messages for a specific conversation (full scrollable history).
```json
Response 200: {
  "conversation_id": "uuid",
  "summary": "string | null",
  "messages": [
    {
      "role": "user | assistant | tool",
      "content": "string",
      "tool_calls": ["dict"] | null,
      "created_at": "datetime"
    }
  ]
}
```

Errors:
- 404: `not_found` — conversation doesn't exist or doesn't belong to user

---

### PATCH /chat/conversations/{conversation_id}
Toggles pin/unpin status for a conversation. Pinned conversations appear at the top of the list.
```json
Response 200: {
  "conversation_id": "uuid",
  "is_pinned": true
}
```

Errors:
- 404: `not_found` — conversation doesn't exist or doesn't belong to user

---

### POST /chat/conversations/reorder
Reorders a conversation within its group (pinned or unpinned). Supports moving to top, bottom, up one position, or down one position.
```json
Request: {
  "conversation_id": "uuid (required)",
  "action": "top | bottom | up | down (required)"
}

Response 200: {
  "conversations": [
    {
      "conversation_id": "uuid",
      "sort_order": 0,
      "is_pinned": false
    }
  ]
}
```

**Notes:**
- Reorder only affects conversations within the same pin group (pinned or unpinned)
- `top` moves to first position, `bottom` moves to last, `up`/`down` shift by one
- Returns the full updated sort order for all conversations

Errors:
- 404: `not_found` — conversation doesn't exist or doesn't belong to user

---

### DELETE /chat/conversations/{conversation_id}
Deletes a single conversation and all its messages.
```json
Response 200: { "success": true }
```

Errors:
- 404: `not_found` — conversation doesn't exist or doesn't belong to user

---

### POST /resume/generate
Generates a structured resume from profile + portfolio + roadmap. ⚠️ 5-15 seconds.
```json
Response 201: {
  "resume_id": "uuid",
  "content": {
    "name": "Jordan",
    "email": "jordan@example.com",
    "objective": "Aspiring software developer...",
    "education": [{ "institution": "...", "level": "...", "details": "..." }],
    "skills": ["Python", "React", "Git"],
    "experience": [{ "title": "...", "organization": "...", "description": "..." }],
    "projects": [{ "title": "...", "description": "...", "skills_used": ["..."] }],
    "certifications": ["..."],
    "interests": ["..."]
  },
  "created_at": "datetime"
}
```

---

### GET /resume
Returns the user's latest generated resume.
```json
Response 200: {
  "resume_id": "uuid",
  "content": { ... },
  "created_at": "datetime",
  "updated_at": "datetime"
}
```

---

## Memory Endpoints

### GET /memory
Lists all memories (facts the AI remembers about the user).
```json
Response 200: {
  "memories": [
    {
      "id": "uuid",
      "fact": "Interested in web development, specifically React",
      "category": "preference",
      "source": "conversation",
      "created_at": "datetime"
    }
  ]
}
```

---

### POST /memory
Manually add a memory (e.g. from onboarding or user correction).
```json
Request: {
  "fact": "string (required)",
  "category": "string (optional, default: general)",
  "source": "string (optional, default: manual)"
}

Valid categories: preference, goal, context, milestone, personality, general

Response 201: {
  "id": "uuid",
  "fact": "string",
  "category": "string",
  "source": "string",
  "created_at": "datetime"
}
```

---

### PATCH /memory/{memory_id}
Edit a specific memory.
```json
Request: {
  "fact": "string (optional)",
  "category": "string (optional)"
}

Response 200: {
  "id": "uuid",
  "fact": "string",
  "category": "string",
  "source": "string",
  "created_at": "datetime"
}
```

Errors:
- 404: `not_found` — memory doesn't exist or doesn't belong to user

---

### DELETE /memory/{memory_id}
Delete a specific memory (user can correct the AI).
```json
Response 200: { "success": true }
```

Errors:
- 404: `not_found` — memory doesn't exist or doesn't belong to user

---

## Errors

---

## Error Format

All errors follow:
```json
{
  "detail": {
    "error": {
      "code": "string",
      "message": "string"
    }
  }
}
```

| HTTP Status | Meaning |
|-------------|---------|
| 400 | Bad request / validation error |
| 401 | Missing or expired token |
| 403 | Forbidden |
| 404 | Resource not found |
| 500 | Internal server error |


## Dashboard

### `GET /dashboard/summary`

Single-call aggregation endpoint for the home screen. Returns all data the dashboard needs in one request — profile, roadmap progress, opportunities, notifications, and onboarding state.

**Auth:** JWT Bearer token (required)

**Response (200):**

```json
{
  "profile": {
    "name": "Jordan",
    "email": "jordan@test.com",
    "role": "student",
    "interests": ["Technology", "AI/ML", "Data Science"],
    "career_path": "Software Engineer",
    "has_completed_onboarding": true
  },
  "roadmap": {
    "has_roadmap": true,
    "career_path": "Software Engineer",
    "total_tasks": 12,
    "completed_tasks": 5,
    "progress_percent": 42,
    "current_step": "Build Your Portfolio",
    "current_step_index": 2,
    "total_steps": 4
  },
  "opportunities": {
    "new_count": 30,
    "recent": [
      {
        "id": "abc123",
        "title": "Junior Developer",
        "company": "TechCo",
        "location": "Kingston, Jamaica",
        "salary_min": 50000,
        "salary_max": 80000,
        "currency": "JMD",
        "category": "job",
        "posted_at": "2026-09-04T00:00:00Z"
      }
    ]
  },
  "notifications": {
    "unread_count": 3,
    "recent": [
      {
        "id": "notif-uuid",
        "title": "New opportunity matches your profile",
        "body": "A new scholarship was found...",
        "type": "opportunity",
        "is_read": false,
        "created_at": "2026-09-05T10:00:00Z"
      }
    ]
  },
  "onboarding_checklist": {
    "complete_profile": true,
    "start_chat": false,
    "generate_roadmap": true,
    "browse_opportunities": false
  }
}
```

**Field Descriptions:**

| Section | Field | Type | Description |
|---------|-------|------|-------------|
| `profile` | `name` | `string` | User's display name |
| `profile` | `email` | `string` | User's email address |
| `profile` | `role` | `string` | Education level or role |
| `profile` | `interests` | `string[]` | Selected interest areas |
| `profile` | `career_path` | `string` | Chosen career path |
| `profile` | `has_completed_onboarding` | `bool` | True if career_path + interests are set |
| `roadmap` | `has_roadmap` | `bool` | Whether user has generated a roadmap |
| `roadmap` | `total_tasks` | `int` | Total tasks across all steps |
| `roadmap` | `completed_tasks` | `int` | Tasks with status "complete" |
| `roadmap` | `progress_percent` | `int` | completed/total * 100, 0 if no tasks |
| `roadmap` | `current_step` | `string` | First step with incomplete tasks (or last step if all done) |
| `roadmap` | `current_step_index` | `int` | 0-based index of current step |
| `roadmap` | `total_steps` | `int` | Total number of steps |
| `opportunities` | `new_count` | `int` | Total available opportunities |
| `opportunities` | `recent` | `object[]` | Top 3 most recent opportunities |
| `notifications` | `unread_count` | `int` | Number of unread notifications |
| `notifications` | `recent` | `object[]` | Top 3 most recent notifications |
| `onboarding_checklist` | `complete_profile` | `bool` | Profile has career_path + interests |
| `onboarding_checklist` | `start_chat` | `bool` | User has sent at least one message |
| `onboarding_checklist` | `generate_roadmap` | `bool` | User has an active roadmap |
| `onboarding_checklist` | `browse_opportunities` | `bool` | Always false (viewing not tracked yet) |

**Errors:**
- `401` — Missing or invalid JWT token
- `500` — Internal server error (individual sections degrade gracefully)

**Design Notes:**
- Each section is fetched independently — a failure in one section does not crash the endpoint
- No new database tables — aggregates data from existing `users`, `roadmaps`, `steps`, `tasks`, `notifications`, and `conversations` tables
- Opportunities are served from the curated list (in-memory cache)
