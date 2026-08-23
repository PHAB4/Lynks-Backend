# Lynks API Contract

Living document. Whoever changes an endpoint's request/response shape while coding
updates this file in the **same commit**. If this file and the code disagree, that's a bug.

Sections marked `// TBD` are drafts — confirm with the team before building against them.
Field names below match `SCHEMA.md`, which now has proposed tables for `roadmaps`, `tasks`,
and `resumes` (none of these existed in the original PRD schema).

**Two decisions locked in since the first draft:** auth now runs through Supabase instead of
a custom JWT system, and every ID in every response below is a `uuid` string, not a number
— see `SCHEMA.md` for why.

---

## Global rules

- **Base URL (local dev):** `http://localhost:8000`
- **Base URL (production):** `https://lynks-backend-production.up.railway.app`
- **Auth:** Supabase issues the JWT (via its own Auth SDK on the frontend — not your
  backend). Every protected endpoint below still requires it in the
  `Authorization: Bearer <token>` header; your backend's job is to **verify** that token,
  not issue it. Missing/invalid token → `401`.
- **IDs:** every `id` field in every request/response below is a `uuid` string
  (e.g. `"3fa85f64-5717-4562-b3fc-2c963f66afa6"`), not a number.
- **Naming convention:** `snake_case` for all field names (matches Postgres schema).
- **Error shape** (every failed request, regardless of endpoint):
  ```json
  {
    "error": {
      "code": "string",
      "message": "string"
    }
  }
  ```
  Every `Errors:` entry below is written as `<HTTP status> — <code>`. These are two
  different things:
  - **HTTP status** — a standard number (400, 401, 404...), part of the HTTP protocol
    itself, not something Lynks invents.
  - **`code`** — a string Lynks defines, inside the JSON body, for the frontend to key off
    of. E.g. `400 — email_taken` means: HTTP status is `400`, and the response body is
    `{"error": {"code": "email_taken", "message": "..."}}`.

---

## Account & Profile

**Signup, login, and logout are no longer custom endpoints on your backend.** The frontend
calls Supabase's Auth SDK directly (`supabase.auth.signUp()`,
`supabase.auth.signInWithPassword()`, `supabase.auth.signOut()`), and Supabase issues the
JWT itself. `POST /signup`, `POST /login`, and `POST /logout` are removed from this contract
— your backend never sees these requests at all.

*// TBD — new gap this creates:* when someone signs up through Supabase, a row appears in
`auth.users`, but nothing yet creates the matching row in your own `public.users` table
(`username`, `interests`, etc. — see `SCHEMA.md`). Team needs to decide how that row gets
created: a Supabase database trigger (runs automatically, no endpoint needed), or a
dedicated endpoint the frontend calls right after signup (e.g. `POST /profile/complete`).
Add whichever gets chosen here once decided.

### GET /profile
Auth required: Yes

Request body: none

Success response (200):
```json
{
  "user_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "username": "string",
  "name": "string",
  "email": "string",
  "age": 25,
  "country": "string",
  "education_level": "string",
  "career_path": "string",
  "interests": ["string"],
  "created_at": "datetime"
}
```

Errors:
- 401 — `unauthorized`

---

### PATCH /profile
Auth required: Yes

Request body *(any subset of the fields below)*:
```json
{ "name": "string", "age": 25, "country": "string", "education_level": "string", "interests": ["string"] }
```
**Editable via this endpoint:** `name`, `age`, `country`, `education_level`, `interests`.
**Not editable here:** `email` / `username` (identity fields — decide separately if these
should ever be changeable), `career_path` (has its own endpoint below — don't allow it here
too, or there are two ways to do the same thing).

Success response (200): same shape as `GET /profile`

Errors:
- 400 — `invalid_field`
- 401 — `unauthorized`

---

### PATCH /profile/career-path
Auth required: Yes

Request body:
```json
{ "career_path": "string" }
```

Success response (200):
```json
{ "career_path": "string" }
```

Errors:
- 400 — `invalid_career_path`
- 401 — `unauthorized`

---

## Roadmap

### POST /roadmap/generate
Auth required: Yes

Request body: none (uses stored profile data)

Success response (201):
```json
{
  "roadmap_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "steps": [
    {
      "step_id": "d9a3c2e1-1f4b-4a9e-8c3d-7e2f1b8a9c0d",
      "title": "string",
      "description": "string",
      "order": 1,
      "status": "pending",
      "tasks": [
        { "task_id": "9c858901-8a57-4791-81fe-4c455b099bc9", "title": "string", "description": "string", "order": 1, "status": "pending" }
      ]
    }
  ]
}
```
*(`steps[].status` is computed from its tasks, not stored directly — see `SCHEMA.md`)*

Errors:
- 400 — `profile_incomplete`
- 401 — `unauthorized`

---

### GET /roadmap
Auth required: Yes

Request body: none

Success response (200): same shape as `POST /roadmap/generate` response

Errors:
- 404 — `no_roadmap_found`
- 401 — `unauthorized`

---

### POST /roadmap/regenerate
Auth required: Yes

Request body: none

Success response (201): same shape as `POST /roadmap/generate` response

Errors:
- 401 — `unauthorized`

---

## Task Completion & Portfolio

### GET /tasks
Auth required: Yes

Request body: none

Success response (200):
```json
[
  { "task_id": "9c858901-8a57-4791-81fe-4c455b099bc9", "step_id": "d9a3c2e1-1f4b-4a9e-8c3d-7e2f1b8a9c0d", "title": "string", "description": "string", "order": 1, "status": "pending" }
]
```
*(flat list across all steps, with `step_id` added for context — `GET /roadmap` returns the
same tasks already nested under their steps; this endpoint is the flat "everything left to
do" view, useful e.g. for the chatbot answering "what's left" without walking the nested
structure)*

Errors:
- 401 — `unauthorized`

---

### PATCH /tasks/{task_id}/complete
Auth required: Yes

Request body: none

Success response (200):
```json
{ "task_id": "9c858901-8a57-4791-81fe-4c455b099bc9", "status": "complete" }
```

Errors:
- 404 — `task_not_found`
- 401 — `unauthorized`

---

### POST /tasks/{task_id}/evidence
Auth required: Yes

Request body: `multipart/form-data` — file upload + `file_type`

Success response (201):
```json
{
  "id": "6f9619ff-8b86-d011-b42d-00c04fc964ff",
  "task_id": "9c858901-8a57-4791-81fe-4c455b099bc9",
  "file_url": "string",
  "file_type": "string",
  "verification_status": "pending",
  "uploaded_at": "datetime"
}
```
*(`verification_status` starts as `pending`; updates to `verified`/`rejected` once the
Llama 3 Vision check runs — confirm whether that check is synchronous here or happens async
after upload)*

Errors:
- 400 — `invalid_file_type`
- 404 — `task_not_found`
- 401 — `unauthorized`

---

### GET /portfolio
Auth required: Yes

Request body: none

Success response (200):
```json
[
  {
    "task_id": "9c858901-8a57-4791-81fe-4c455b099bc9",
    "title": "string",
    "evidence": [
      { "id": "6f9619ff-8b86-d011-b42d-00c04fc964ff", "file_url": "string", "file_type": "string", "verification_status": "verified", "uploaded_at": "datetime" }
    ]
  }
]
```

Errors:
- 401 — `unauthorized`

---

## Resume Building

### POST /resume/generate
Auth required: Yes

Request body: none

Success response (201):
```json
{
  "resume_id": "uuid",
  "content": {
    "name": "string",
    "email": "string",
    "objective": "string",
    "education": [{ "institution": "string", "level": "string", "details": "string" }],
    "skills": ["string"],
    "experience": [{ "title": "string", "organization": "string", "description": "string" }],
    "projects": [{ "title": "string", "description": "string", "skills_used": ["string"] }],
    "certifications": ["string"],
    "interests": ["string"]
  }
}
```

Errors:
- 400 — `no_completed_tasks`
- 401 — `unauthorized`

---

### GET /resume
Auth required: Yes

Request body: none

Success response (200): same shape as `POST /resume/generate` response

Errors:
- 404 — `no_resume_found`
- 401 — `unauthorized`

---

### PATCH /resume
Auth required: Yes

Request body: edited resume fields (shape TBD, matches `content` above)

Success response (200): updated resume object

Errors:
- 400 — `invalid_field`
- 401 — `unauthorized`

---

### GET /resume/download
Auth required: Yes

Request body: none

Success response (200): file download — format TBD, PDF suggested

Errors:
- 404 — `no_resume_found`
- 401 — `unauthorized`

---

## Opportunity Discovery

### GET /opportunities
Auth required: Yes

Query params (optional): `location`, `pay`, `age`, `experience`, `category`

Success response (200):
```json
[
  {
    "id": "string",
    "title": "string",
    "company": "string",
    "location": "string",
    "pay": "string",
    "age_requirement": "string",
    "experience_required": "string",
    "url": "string",
    "category": "competition | club | scholarship | event | volunteer | job"
  }
]
```

Errors:
- 401 — `unauthorized`

---

## Chat Bot

### POST /chat/message
Auth required: Yes

Request body:
```json
{ "conversation_id": "58e0a7d7-eebc-11d8-9669-0800200c9a66", "message": "string" }
```
*(`conversation_id` optional — omit to start a new conversation)*

Success response (200):
```json
{
  "conversation_id": "58e0a7d7-eebc-11d8-9669-0800200c9a66",
  "response": "string",
  "tool_calls": null
}
```

Errors:
- 401 — `unauthorized`

---

### GET /chat/history
Auth required: Yes

Query params (optional): `conversation_id`

Success response (200):
```json
{
  "conversation_id": "58e0a7d7-eebc-11d8-9669-0800200c9a66",
  "messages": [
    { "role": "user", "content": "string", "tool_calls": null, "created_at": "datetime" }
  ]
}
```

Errors:
- 404 — `conversation_not_found`
- 401 — `unauthorized`

---

### DELETE /chat/history
Auth required: Yes

Request body: none

Success response (200):
```json
{ "success": true }
```

Errors:
- 401 — `unauthorized`
