# Lynks API Contract

> **Last updated:** August 22, 2026
> **Base URL:** `http://localhost:8000`
> **Auth:** Bearer token in Authorization header (Supabase JWT)

---

## Authentication

Every endpoint except GET /health requires:
```
Authorization: Bearer <supabase_jwt_token>
```

Tokens are obtained via Supabase Auth. They expire after ~1 hour.

---

## Endpoints

### GET /health
No auth. Returns `{ "status": "ok" }`.

### GET /profile
Returns authenticated user's profile.
```json
Response 200: {
  "id": "uuid", "email": "string", "username": "string|null",
  "name": "string|null", "age": "int|null", "country": "string|null",
  "education_level": "string|null", "career_path": "string|null",
  "interests": ["string"]|null, "created_at": "datetime"
}
```

### PATCH /profile
Update profile fields (only sends set fields).
```json
Request: { "name": "Jordan", "age": 17, "country": "Jamaica",
  "education_level": "High School", "interests": ["coding"] }
Response 200: (same as GET /profile)
```

### PATCH /profile/career-path
```json
Request: { "career_path": "Software Development" }
Response 200: { "career_path": "Software Development" }
```

### POST /roadmap/generate
Generates roadmap via LLM. ⚠️ 5-15 seconds.
```json
Response 201: {
  "roadmap_id": "uuid",
  "steps": [{
    "step_id": "uuid", "title": "string", "description": "string",
    "order": 1, "status": "pending|complete",
    "tasks": [{ "task_id": "uuid", "title": "string",
      "description": "string", "order": 1, "status": "pending|complete" }]
  }]
}
```
Errors: 400 (profile_incomplete)

### GET /roadmap
Returns active roadmap. Response same as POST /roadmap/generate.

### POST /roadmap/regenerate
Deactivates old roadmap, generates new one. ⚠️ 5-15 seconds.
Response same as POST /roadmap/generate.

### POST /tasks/{task_id}/evidence
Upload evidence. Content-Type: multipart/form-data, body: file=<image>.
```json
Response 201: {
  "id": "uuid", "file_url": "https://...", "file_type": "image/png",
  "verification_status": "pending", "uploaded_at": "datetime"
}
```

### GET /portfolio
Returns tasks with evidence.
```json
Response 200: [{ "task_id": "uuid", "title": "string",
  "evidence": [{ "id": "uuid", "file_url": "https://...",
    "file_type": "string", "verification_status": "pending|verified|rejected",
    "uploaded_at": "datetime" }] }]
```

### GET /opportunities
Returns all Caribbean opportunities.
```json
Response 200: [{ "id": "string", "title": "string", "company": "string",
  "location": "string", "pay": "string", "age_requirement": "string|null",
  "experience_required": "string", "url": "string", "category": "string" }]
```

### GET /opportunities?category={category}
Filter: scholarship, job, competition, event, club, volunteer.

### POST /chat/message
Send message to Mentor. ⚠️ 5-15 seconds.
```json
Request: { "message": "string", "conversation_id": "uuid|null" }
Response 200: { "conversation_id": "uuid", "response": "string",
  "tool_calls": ["dict"]|null }
```

### GET /chat/history?conversation_id={uuid}
```json
Response 200: { "conversation_id": "uuid",
  "messages": [{ "role": "user|assistant|tool", "content": "string",
    "tool_calls": ["dict"]|null, "created_at": "datetime" }] }
```

### DELETE /chat/history
Deletes all user conversations and messages.
Response 200: `{ "success": true }`

---

## Errors

All errors: `{ "detail": { "error": { "code": "string", "message": "string" } } }`

| Status | Meaning |
|--------|----------|
| 400 | Bad request |
| 401 | Unauthorized (bad/expired token) |
| 404 | Not found |
| 500 | Server error |
