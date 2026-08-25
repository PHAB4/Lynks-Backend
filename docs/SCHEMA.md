# Lynks Database Schema

> **Last updated:** August 22, 2026
> **Source:** Exported from Supabase SQL Editor (live database)

---

## Overview

All tables use **UUID primary keys** and live in the `public` schema. Auth is handled by Supabase's internal `auth.users` — a trigger copies `id`, `email`, and `created_at` into `public.users` on signup.

```
users ──< roadmaps ──< steps ──< tasks ──< evidence
users ──< resumes
users ──< conversations ──< messages
opportunities (standalone)
users ──< notifications
```

---

## users

| Field | Type | Nullable | Default | Notes |
|-------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK, FK → auth.users.id |
| email | text | NO | null | UNIQUE, from Supabase Auth |
| username | text | YES | null | UNIQUE, set by user |
| name | text | YES | null | Set by user |
| age | bigint | YES | null | Set by user |
| country | text | YES | null | Set by user |
| education_level | text | YES | null | Set by user |
| employment_status | text | YES | null | Set by user — "student", "employed", "unemployed", "freelancer", "looking for first job" |
| career_path | text | YES | null | Set by user |
| interests | ARRAY | YES | null | text[] — array of strings |
| created_at | timestamptz | NO | now() | Set by signup trigger |

---

## roadmaps

| Field | Type | Nullable | Default | Notes |
|-------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| user_id | uuid | NO | gen_random_uuid() | FK → users.id |
| career_path | text | YES | null | Snapshot of career path at generation time |
| is_active | boolean | NO | null | Only one active per user |
| created_at | timestamptz | NO | now() | |

---

## steps

| Field | Type | Nullable | Default | Notes |
|-------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| roadmap_id | uuid | NO | gen_random_uuid() | FK → roadmaps.id |
| title | text | NO | null | Step name |
| description | text | NO | null | 2-3 sentence description |
| order | bigint | YES | null | 1-based position in roadmap |
| created_at | timestamptz | NO | now() | |

---

## tasks

| Field | Type | Nullable | Default | Notes |
|-------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| step_id | uuid | NO | gen_random_uuid() | FK → steps.id |
| title | text | NO | null | Task name |
| description | text | NO | null | What to do and why |
| status | text | NO | null | "pending" or "complete" |
| order | integer | YES | 0 | 1-based position in step |
| completed_at | timestamptz | YES | null | When marked complete |
| created_at | timestamptz | NO | now() | |

---

## evidence

| Field | Type | Nullable | Default | Notes |
|-------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| task_id | uuid | NO | gen_random_uuid() | FK → tasks.id |
| user_id | uuid | NO | gen_random_uuid() | FK → users.id |
| file_url | text | NO | null | Supabase Storage URL |
| file_type | text | NO | null | MIME type (e.g. "image/png") |
| uploaded_at | timestamptz | NO | now() | When uploaded |
| verification_status | text | YES | null | pending / verified / rejected |
| created_at | timestamptz | NO | now() | |

---

## resumes

| Field | Type | Nullable | Default | Notes |
|-------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| user_id | uuid | NO | gen_random_uuid() | FK → users.id |
| content | jsonb | YES | null | Structured resume data |
| created_at | timestamptz | NO | now() | |
| updated_at | timestamptz | NO | null | Auto-updated |

**Implemented** — see `POST /resume/generate` and `GET /resume` in API contract.

---

## conversations

| Field | Type | Nullable | Default | Notes |
|-------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| user_id | uuid | NO | gen_random_uuid() | FK → users.id |
| created_at | timestamptz | NO | now() | |

---

## messages

| Field | Type | Nullable | Default | Notes |
|-------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| conversation_id | uuid | NO | gen_random_uuid() | FK → conversations.id, ON DELETE CASCADE |
| role | text | NO | null | "user", "assistant", or "tool" |
| content | text | NO | null | Message text |
| tool_calls | json | YES | null | Tool call data (if any) |
| created_at | timestamptz | NO | now() | |

---

## opportunities

| Field | Type | Nullable | Default | Notes |
|-------|------|----------|---------|-------|
| id | text | NO | null | NOT a UUID — text identifier |
| title | text | NO | null | Opportunity name |
| company | text | NO | null | Organization offering it |
| location | text | NO | null | Country/city |
| pay | text | YES | null | Cost or stipend info |
| age_requirement | text | YES | null | Age range (e.g. "13-18") |
| expereince_required | text | YES | null | ⚠️ Typo in DB — should be "experience_required" |
| url | text | NO | null | Link to apply/learn more |
| fetched_at | timestamptz | NO | now() | When scraped/added |

**Note:** This table does NOT have a `category` column in the database — categories are embedded in the agent's hardcoded data, not in a DB column.

---

## Supabase Storage

**Bucket:** `evidence` (public)
- Anyone can upload files
- Anyone can read files
- URL format: `https://qcyxyunngbkupttcwlbk.supabase.co/storage/v1/object/public/evidence/{filename}`

---

## notifications

| Field | Type | Nullable | Default | Notes |
|-------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| user_id | uuid | NO | gen_random_uuid() | FK → users.id |
| title | text | NO | null | Notification title |
| body | text | YES | null | Optional body text |
| type | text | NO | null | "opportunity", "task", "reminder", "badge" |
| link | jsonb | YES | null | Optional link to related content |
| is_read | boolean | NO | false | Whether user has read it |
| created_at | timestamptz | NO | now() | When created |

**Indexes:**
- `idx_notifications_user_id` — on user_id
- `idx_notifications_created_at` — on created_at DESC
- `idx_notifications_is_read` — on (user_id, is_read)

**Note:** This table is new as of August 24, 2026. Created as part of the notifications system feature.
