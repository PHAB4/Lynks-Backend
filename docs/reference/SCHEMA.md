# Lynks Database Schema

> **Last updated:** September 10, 2026
> **Source:** Exported from Supabase SQL Editor (live database)

---

## Overview

All tables use **UUID primary keys** and live in the `public` schema. Auth is handled by Supabase's internal `auth.users` — a trigger copies `id`, `email`, and `created_at` into `public.users` on signup.

```
users ──< roadmaps ──< steps ──< tasks ──< evidence
users ──< resumes
users ──< conversations ──< messages
users ──< user_memories
users ──< saved_opportunities
users ──< notifications
opportunities (standalone)
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
| phone | text | YES | null | User's phone number (e.g. "+1-876-555-1234") |
| avatar_url | text | YES | null | URL to profile picture in Supabase Storage (profile-pictures bucket) |
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
| status | text | NO | null | "pending", "in_progress", or "complete" |
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
| summary | text | YES | null | LLM-generated summary of conversation (set after 15+ messages) |
| is_pinned | boolean | NO | false | User-pinned conversation (appears at top of list) |
| sort_order | integer | NO | 0 | Manual sort position within pin group (lower = higher in list) |
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
| salary_min | numeric | YES | null | Minimum salary (jobs only) |
| salary_max | numeric | YES | null | Maximum salary (jobs only) |
| salary_currency | text | YES | 'JMD' | Currency code — auto-detected from 22+ ISO 4217 currencies (JMD, TTD, BBD, USD, EUR, GBP, CAD, AUD, JPY, CNY, INR, BRL, MXN, etc.). Source-context-aware: bare `$` from a Jamaican source → JMD, from Trinidad → TTD. |
| age_requirement | text | YES | null | Age range (e.g. "13-18") |
| experience_required | text | YES | null | ✅ Typo fixed (was `expereince_required`) |
| url | text | NO | null | Link to apply/learn more ("Go to source" button) |
| category | text | NO | 'event' | One of: job, club, competition, scholarship, event, volunteer |
| description | text | YES | null | 1-2 sentence summary |
| posted_at | timestamptz | YES | now() | When the opportunity was originally posted |
| first_seen_at | timestamptz | YES | now() | When we first scraped it (for new-opportunity notifications) |
| source_name | text | YES | 'curated' | Where it was scraped from (devpost_api, eventbrite_api, rss_*, facebook_*, instagram_*, llm_generated, curated) |
| image_url | text | YES | null | Thumbnail/logo URL (frontend shows placeholder when null) |
| fetched_at | timestamptz | NO | now() | When scraped/added (legacy field) |

**Indexes:**
- `idx_opportunities_posted_at` — for time-based filtering (posted_at DESC)
- `idx_opportunities_first_seen` — for new-opportunity notifications (first_seen_at DESC)
- `idx_opportunities_category` — for category tab filtering
- `idx_opportunities_cat_time` — composite index for category + time sort

**Note:** Run `app/sql/opportunities_upgrade.sql` in Supabase SQL Editor to add new columns and indexes.

### Opportunity Matching / Scoring Engine

Each opportunity is scored against the user's profile (0–100) using `backend/app/services/scoring.py`. No LLM dependency — pure rule-based.

| Factor | Max Points | Logic |
|--------|-----------|-------|
| Career path | 30 | Category alignment (20) + keyword matches in title/description (10) |
| Education | 20 | User's education level meets opportunity's experience requirement |
| Age | 20 | User falls within the opportunity's age range |
| Interests | 15 | User interests appear in the opportunity's title/description |
| Location | 15 | Country match (15), CARICOM-wide (12), Online (10), CARICOM country (8) |

**Threshold:** ≥ 50 = a "match" (returned by `GET /opportunities/matches`).

**Career path → category mapping:** Each career path (e.g. `software_engineering`) maps to a set of relevant opportunity categories (e.g. `competition`, `job`, `club`, `scholarship`). See `CAREER_CATEGORY_MAP` in `scoring.py`.

**Career keywords:** Each career path has associated keywords (e.g. `software_engineering` → `coding`, `programming`, `hackathon`). Hits in title + description earn bonus points. See `CAREER_KEYWORDS` in `scoring.py`.

**Education hierarchy:** `none` (0) → `high_school` (1) → `some_university` (2) → `bachelors` (3) → `masters` (4) → `phd` (5). User must meet or exceed the opportunity's requirement.

**CARICOM awareness:** Users in CARICOM countries get partial credit (8 pts) for opportunities in other CARICOM countries. Opportunities tagged "CARICOM-wide" get 12 pts for all Caribbean users.

**Endpoints:**
- `GET /opportunities/matches` — returns only opportunities scoring ≥ 50, sorted by score descending
- `GET /opportunities` — returns all opportunities with `relevance_score` attached, sorted by score
- `GET /opportunities/saved` — returns saved opportunities with `relevance_score` attached

---

## user_memories

Long-term user facts extracted from conversations. Used to give the AI Mentor persistent memory across sessions.

| Field | Type | Nullable | Default | Notes |
|-------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| user_id | uuid | NO | gen_random_uuid() | FK → users.id, ON DELETE CASCADE |
| fact | text | NO | null | The extracted fact (e.g. "Interested in web development, specifically React") |
| category | text | NO | 'general' | One of: preference, goal, context, milestone, personality, general |
| source | text | NO | 'conversation' | Where the fact came from: conversation, profile, manual |
| created_at | timestamptz | NO | now() | When extracted |

**RLS Policies:**
- Users can read own memories
- Users can delete own memories
- Service role can manage all memories (for extraction)

**Limits:** Max 30 memories per user (oldest auto-pruned when exceeded).

**Extraction trigger:** After every 10 messages in a conversation, the `memory_extractor.py` agent runs an LLM call to extract up to 5 new facts.

---

## Updated Entity Relationship
## saved_opportunities

Junction table for user-saved/bookmarked opportunities.

| Field | Type | Nullable | Default | Notes |
|-------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| user_id | uuid | NO | gen_random_uuid() | FK → users.id, ON DELETE CASCADE |
| opportunity_id | text | NO | gen_random_uuid() | FK → opportunities.id, ON DELETE CASCADE |
| saved_at | timestamptz | NO | now() | When saved |

**Constraints:** UNIQUE(user_id, opportunity_id) — user can't save the same opportunity twice.

**RLS Policies:**
- Users can insert their own saves

---

## notifications

In-app notification center. The system creates notifications for new matching opportunities, task milestones, badges, and general reminders. The frontend polls `GET /notifications/unread/count` for a badge indicator.

| Field | Type | Nullable | Default | Notes |
|-------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| user_id | uuid | NO | gen_random_uuid() | FK → users.id, ON DELETE CASCADE |
| title | text | NO | null | Notification headline (e.g. "New opportunity: JS hackathon") |
| body | text | YES | null | Notification detail text |
| type | text | NO | 'reminder' | One of: opportunity, task, badge, reminder |
| link | jsonb | YES | null | Deep link data: `{"type": "opportunity", "id": "abc123"}` or `{"type": "task", "id": "uuid"}` |
| is_read | boolean | NO | false | Whether the user has seen it |
| created_at | timestamptz | NO | now() | When created |

**RLS Policies:**
- Users can read own notifications
- Users can update own notifications (mark as read)

**Notification Types:**
- `opportunity` — new matching opportunity found by the scraper
- `opportunity_scrape` — batch notification from scheduled scrape (new opportunities found by background scheduler)
- `task` — task milestone or reminder
- `badge` — badge earned
- `reminder` — general system reminder

```
users ──< roadmaps ──< steps ──< tasks ──< evidence
users ──< resumes
users ──< conversations ──< messages
users ──< user_memories
users ──< saved_opportunities
users ──< notifications
opportunities (standalone)
```

---

## Supabase Storage

**Bucket:** `evidence` (public)
- Anyone can upload files
- Anyone can read files
- URL format: `https://qcyxyunngbkupttcwlbk.supabase.co/storage/v1/object/public/evidence/{filename}`


### Changes

- **2026-09-05:** Added `PATCH /roadmap/tasks/{task_id}/complete` endpoint. No schema changes — uses existing `tasks.status` and `tasks.completed_at` columns.
- **2026-09-05:** Added `GET /dashboard/summary` aggregation endpoint. No schema changes — data is sourced from existing tables (`users`, `roadmaps`, `steps`, `tasks`, `notifications`, `conversations`).
- **2026-09-05:** Added `PATCH /roadmap/tasks/{task_id}` endpoint for general task updates (title, description, status). No schema changes — uses existing `tasks.status` and `tasks.completed_at` columns. Task status now supports three values: `pending`, `in_progress`, `complete`.
- **2026-09-05:** Added `is_pinned` (boolean) and `sort_order` (integer) columns to `conversations` table for manual reordering. New endpoints: `PATCH /chat/conversations/{id}` (toggle pin), `POST /chat/conversations/reorder`, `DELETE /chat/conversations/{id}`.
- **2026-09-05:** Added `phone` (text, nullable) column to `users` table. Updated `GET /profile` and `PATCH /profile` to include phone field.
- **2026-09-05:** Added `avatar_url` (text, nullable) column to `users` table. Created `profile-pictures` Supabase storage bucket. Added `POST /profile/avatar` and `DELETE /profile/avatar` endpoints.
- **2026-09-06:** Added background opportunity scheduler (`services/scheduler.py`) — asyncio task runs every 6 hours on FastAPI startup. Scrapes all sources, generates `opportunity_scrape` notifications. New endpoint: `GET /opportunities/scheduler/status`. Fixed `POST /opportunities/refresh` decorator bug (was stacked on wrong function).

- **2026-09-10:** Added model router (`services/model_router.py`) — centralized LLM routing with `call_llm()` function used by all agents (mentor, architect, scout, memory_extractor, opportunity_scraper). Reads model configs from `models.json`. Supports task-based model selection and automatic fallback chains. No schema changes — pure service layer.
- **2026-09-10:** Updated curated opportunity URLs to point to specific pages (15 URLs updated). Opportunity scraper switched from direct OpenAI calls to `call_llm()` model router.