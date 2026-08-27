# Lynks API Contract

> **Last updated:** August 22, 2026
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

### POST /tasks/{task_id}/evidence
Uploads an evidence file for a task. Uses `multipart/form-data`.
```
Content-Type: multipart/form-data
Body: file=<image file>

Response 201: {
  "id": "uuid",
  "file_url": "https://...",
  "file_type": "image/png",
  "verification_status": "pending",
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
        "uploaded_at": "datetime"
      }
    ]
  }
]
```

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
      "salary_currency": "USD|JMD|EUR|GBP | null",
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
Lists all conversations for the user (for sidebar). Returns titles, summaries, timestamps, and message counts.
```json
Response 200: {
  "conversations": [
    {
      "conversation_id": "uuid",
      "title": "string | null",
      "summary": "string | null",
      "message_count": 5,
      "created_at": "datetime"
    }
  ]
}
```

**Notes:**
- `title` is derived from the first user message (truncated to 60 chars) if no summary exists
- `summary` is the LLM-generated conversation summary (set after 15+ messages)
- Returns up to 50 conversations, newest first
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
