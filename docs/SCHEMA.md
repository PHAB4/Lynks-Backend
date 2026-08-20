# Lynks Database Schema

Draft, built from the PRD's existing tables plus the tables its own endpoints require but
never defined. Tables/fields marked `// NEW` didn't exist in the PRD and are proposed here
to fill a gap. Confirm these with the team before building against them.

**Two decisions locked in since the first draft:**
- **Auth:** using Supabase's built-in auth (`auth.users`) instead of a custom JWT system.
  `public.users` below no longer stores a password — Supabase's `auth.users` handles that,
  and `public.users.id` is a foreign key into it.
- **IDs:** every table's primary key is `uuid`, not an auto-incrementing number — chosen for
  consistency now that `users.id` is forced to be `uuid` (Supabase's format) anyway, and it
  avoids sequential IDs being guessable in URLs.
- **Steps vs. tasks:** these are two different levels, not the same table. A roadmap has
  several **steps** (milestones); each step has several **tasks** (the actual actionable
  items — the things that get marked complete and get evidence attached). `tasks.roadmap_id`
  is gone — tasks now point at a step instead.

---

## users
`id` is a foreign key into Supabase's `auth.users.id` — one row here for every row there,
holding everything Lynks-specific that Supabase's own table doesn't. Supabase handles the
`auth.users` side entirely (email, password hash, sessions); you never read or write it
directly.

| Field | Type | Notes |
|---|---|---|
| id | uuid | PK, FK → `auth.users.id` |
| username | text | unique |
| name | text | |
| email | text | unique |
| age | number | |
| country | text | |
| education_level | text | |
| employment_status | text | `// NEW` — added after onboarding/schema cross-check; onboarding mockups collect this, needed on the profile for the Architect agent to reason about roadmap relevance |
| career_path | text | current path; snapshot copies live on `roadmaps` below |
| interests | text[] | |
| created_at | datetime | |

---

## roadmaps `// NEW`
Needed because `POST /roadmap/generate`, `GET /roadmap`, and `POST /roadmap/regenerate` all
reference "the roadmap," but no table for one existed yet.

| Field | Type | Notes |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK → users |
| career_path | text | the path this roadmap was generated for (kept even if user later switches paths) |
| is_active | boolean | true for the user's current roadmap; regenerating creates a new row rather than overwriting, so old roadmaps stay as history |
| created_at | datetime | |

---

## steps `// NEW`
The milestones on a roadmap. Each one groups a set of related tasks.

| Field | Type | Notes |
|---|---|---|
| id | uuid | PK |
| roadmap_id | uuid | FK → roadmaps |
| title | text | |
| description | text | |
| order | number | position within the roadmap sequence |
| status | text | `pending` \| `complete` — **proposal: don't store this, compute it** by checking whether every task under this step is complete. Storing it separately risks the step and its tasks disagreeing. |

---

## tasks
The actionable items under a step — these are what actually get marked complete and get
evidence attached.

| Field | Type | Notes |
|---|---|---|
| id | uuid | PK |
| step_id | uuid | FK → steps (was `roadmap_id` in the first draft — tasks now nest under a step, not directly under the roadmap) |
| title | text | |
| description | text | |
| order | number | position within the step's sequence |
| status | text | `pending` \| `complete` |
| completed_at | datetime | nullable |

---

## evidence
Already in the PRD — one field added.

| Field | Type | Notes |
|---|---|---|
| id | uuid | PK |
| task_id | uuid | FK → tasks |
| user_id | uuid | FK → users |
| file_url | text | |
| file_type | text | |
| verification_status | text | **// NEW** — `pending` \| `verified` \| `rejected`. |
| uploaded_at | datetime | |

---

## resumes `// NEW`
Needed for `POST /resume/generate`, `GET /resume`, `PATCH /resume`.

| Field | Type | Notes |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK → users |
| content | jsonb | structured resume content |
| created_at | datetime | |
| updated_at | datetime | |

---

## conversations
Already in the PRD, unchanged.

| Field | Type | Notes |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK → users |
| created_at | datetime | |

---

## messages
Already in the PRD, unchanged.

| Field | Type | Notes |
|---|---|---|
| id | uuid | PK |
| conversation_id | uuid | FK → conversations |
| role | text | `user` \| `assistant` \| `tool` |
| content | text | |
| tool_calls | json | nullable |
| created_at | datetime | |

---

## opportunities `// NEW`

| Field | Type | Notes |
|---|---|---|
| id | text | External listing ID — intentionally **not** uuid |
| title | text | |
| company | text | |
| location | text | |
| pay | text | |
| age_requirement | text | nullable |
| experience_required | text | |
| url | text | |
| fetched_at | datetime | supports a freshness check |

---

## Relationships at a glance

```
users ──< roadmaps ──< steps ──< tasks ──< evidence
users ──< resumes
users ──< conversations ──< messages
```
`──<` reads as "one user has many roadmaps," etc.
