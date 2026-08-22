# Lynks Database Schema

> **Last updated:** August 22, 2026
> **Source:** Exported from Supabase SQL Editor (live database)

---

## Overview

All tables use UUID primary keys in the `public` schema. Auth is handled by Supabase's internal `auth.users` — a trigger copies id, email, and created_at into `public.users` on signup.

```
users ──< roadmaps ──< steps ──< tasks ──< evidence
users ──< resumes
users ──< conversations ──< messages
opportunities (standalone)
```

---

## users

| Field | Type | Nullable | Default | Notes |
|-------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK, FK → auth.users.id |
| email | text | NO | null | UNIQUE, from Supabase Auth |
| username | text | YES | null | UNIQUE, set by user |
| name | text | YES | null | |
| age | bigint | YES | null | |
| country | text | YES | null | |
| education_level | text | YES | null | |
| career_path | text | YES | null | |
| interests | ARRAY | YES | null | text[] |
| created_at | timestamptz | NO | now() | |

---

## roadmaps

| Field | Type | Nullable | Default | Notes |
|-------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| user_id | uuid | NO | gen_random_uuid() | FK → users.id |
| career_path | text | YES | null | Snapshot at generation time |
| is_active | boolean | NO | null | |
| created_at | timestamptz | NO | now() | |

---

## steps

| Field | Type | Nullable | Default | Notes |
|-------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| roadmap_id | uuid | NO | gen_random_uuid() | FK → roadmaps.id |
| title | text | NO | null | |
| description | text | NO | null | |
| order | bigint | YES | null | 1-based |
| created_at | timestamptz | NO | now() | |

---

## tasks

| Field | Type | Nullable | Default | Notes |
|-------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| step_id | uuid | NO | gen_random_uuid() | FK → steps.id |
| title | text | NO | null | |
| description | text | NO | null | |
| status | text | NO | null | pending / complete |
| order | integer | YES | 0 | 1-based |
| completed_at | timestamptz | YES | null | |
| created_at | timestamptz | NO | now() | |

---

## evidence

| Field | Type | Nullable | Default | Notes |
|-------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| task_id | uuid | NO | gen_random_uuid() | FK → tasks.id |
| user_id | uuid | NO | gen_random_uuid() | FK → users.id |
| file_url | text | NO | null | Supabase Storage URL |
| file_type | text | NO | null | MIME type |
| uploaded_at | timestamptz | NO | now() | |
| verification_status | text | YES | null | pending / verified / rejected |
| created_at | timestamptz | NO | now() | |

---

## resumes

| Field | Type | Nullable | Default | Notes |
|-------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| user_id | uuid | NO | gen_random_uuid() | FK → users.id |
| content | jsonb | YES | null | |
| created_at | timestamptz | NO | now() | |
| updated_at | timestamptz | NO | null | |

**Not yet implemented** — no endpoint.

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
| role | text | NO | null | user / assistant / tool |
| content | text | NO | null | |
| tool_calls | json | YES | null | |
| created_at | timestamptz | NO | now() | |

---

## opportunities

| Field | Type | Nullable | Default | Notes |
|-------|------|----------|---------|-------|
| id | text | NO | null | Text ID (not UUID) |
| title | text | NO | null | |
| company | text | NO | null | |
| location | text | NO | null | |
| pay | text | YES | null | |
| age_requirement | text | YES | null | |
| expereince_required | text | YES | null | ⚠️ Typo in DB |
| url | text | NO | null | |
| fetched_at | timestamptz | NO | now() | |

**Note:** No `category` column — categories are in the agent's hardcoded data.

---

## Supabase Storage

**Bucket:** `evidence` (public)
- Anyone can upload
- Anyone can read
- URL: `https://...supabase.co/storage/v1/object/public/evidence/{filename}`
