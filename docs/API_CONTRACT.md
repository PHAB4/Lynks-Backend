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
Returns all Caribbean opportunities.
```json
Response 200: [
  {
    "id": "string",
    "title": "string",
    "company": "string",
    "location": "string",
    "pay": "string",
    "age_requirement": "string | null",
    "experience_required": "string",
    "url": "string",
    "category": "string"
  }
]
```

### GET /opportunities?category={category}
Filter by category. Valid values: `scholarship`, `job`, `competition`, `event`, `club`, `volunteer`.

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
  "tool_calls": ["dict"] | null
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
