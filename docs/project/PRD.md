# Lynks — Product Requirement Document

**Last updated:** September 10, 2026

## 1. Problem Statement

Young, ambitious people often can't access career opportunities they're qualified for because informal networks — not merit — decide who gets in. There's no reliable way for someone starting from zero to know what steps actually lead to a goal, or to prove to an employer they've done the work.

## 2. Goal

A platform that gives each user a personalized, step-by-step career roadmap, lets them build verifiable proof of progress (task evidence, certificates), and converts that verified progress into a resume/profile that gets surfaced to employers — closing the gap between "did the work" and "got the opportunity."

## 3. Target Users

- **Primary:** Caribbean high school and young adult job seekers (16–25)
- **Secondary:** Caribbean employers looking for verified, motivated talent
- **Tertiary:** Educators and mentors who want to guide students

## 4. Core Features

### 4.1 User Onboarding & Profile

- Sign up via Supabase Auth (email/password)
- Onboarding flow collects: full name, country, age, education level, career interest, bio
- Profile is stored in `public.users` and synced from `auth.users` via database trigger
- Profile is always editable by the user

### 4.2 AI Career Roadmap (Career Architect Agent)

- User provides career goal during onboarding
- AI generates a personalized, step-by-step roadmap (4–8 steps, 2–4 tasks each)
- Steps and tasks are specific to the user's profile (location, education level, career path)
- Roadmap is stored in the database (roadmaps → steps → tasks hierarchy)
- User can regenerate their roadmap if goals change
- Steps are marked complete when all child tasks are complete (computed, not stored)
- Tasks can be marked complete via the Roadmap page checkbox (`PATCH /roadmap/tasks/{task_id}/complete`) or through the Mentor chatbot

### 4.3 Task Evidence & Verification (Portfolio Manager Agent)

- Users mark tasks as complete and upload evidence (certificates, photos, screenshots, project demos)
- AI verifies uploaded evidence using **Google Gemini 3.5 Flash** (vision model, free tier) via the Google AI Studio API
- **Dual-provider architecture:** Groq handles text tasks (chat, roadmap, resume), Google Gemini handles vision tasks (evidence verification) — each with its own API key and environment variable
- **Verification is career-context-aware:** the AI receives the user's career path and task description alongside the image, so it can judge relevance (e.g., a Python certificate is valid for a software dev task, but a cooking cert is not)
- **Three-tier analysis:** (1) document type — real certificate vs. fake/blank, (2) content legitimacy — realistic elements like issuer, date, recipient, (3) career relevance — does it match the user's career path and the specific task
- **Lenient verification:** only rejects obviously fake, blank, or completely unrelated images. Ambiguous evidence gets `verified` with `medium` confidence.
- Verification result: `verified`, `rejected`, or `pending` (with `reason` and `confidence` level)
- Evidence is stored in Supabase Storage (public `evidence` bucket)
- Portfolio page shows all completed tasks with verified evidence
- Users can request re-verification (`POST /evidence/{id}/re-verify`) if evidence was wrongly rejected
- **Graceful degradation:** if the vision API is down, evidence stays `pending` and can be retried — uploads never fail due to verification errors

### 4.4 Career Opportunities (Job Scout Agent)

- Sources Caribbean-specific opportunities: jobs, competitions, clubs, scholarships, events, volunteer roles
- Opportunities are scraped from multiple sources (Devpost API, Eventbrite API, RSS feeds, curated list, LLM-generated)
- Cached in-memory with 1-hour TTL for fast responses
- Structured salary data for jobs (salary_min, salary_max, salary_currency) with **priority-based currency detection** (22+ currencies, source-context-aware)
- Salary/pay information is displayed on opportunity cards in the frontend (green badge)
- Category-based filtering, time-based filtering, relevance sorting
- **Rule-based matching engine** (`scoring.py`): scores each opportunity 0–100 against the user's profile (career path, education, age, interests, location). Returns matches ≥ 50 via `GET /opportunities/matches`.
- **Background scheduler** (`scheduler.py`): asyncio task runs every 6 hours on FastAPI startup, scrapes all sources, generates batch notifications. Status via `GET /opportunities/scheduler/status`.
- **LLM-generated opportunities**: The scraper uses the model router to generate additional opportunities when API/RSS sources are exhausted
- Curated URLs point to specific pages (program details, scholarship listings) rather than generic homepages
- Users can save/bookmark opportunities for later
- New-opportunity notification polling via `GET /opportunities/new-count`
- Social media scraping (Facebook, Instagram) — deferred post-competition

### 4.5 Career Opportunities Page — UX Pattern

The career opportunities page has two tabs:

| Tab | Description |
|---|---|
| **For You** (default) | Opportunities scored 0–100 against the user's profile using rule-based matching (career path, country, age, education, interests). Only opportunities scoring ≥ 50 are shown, sorted by score descending. Endpoint: `GET /opportunities/matches`. |
| **Browse All** | Full catalog of all opportunities with filters. Endpoint: `GET /opportunities` (includes `relevance_score` for each result). |

**Filters available:**

| Filter | Options |
|---|---|
| Category | Job, Competition, Club, Scholarship, Event, Volunteer |
| Timeframe | Within Week, Within Month, Within Quarter, All Time |
| Sort | Relevance, Recent, Salary |
| Page | Offset pagination (default 20 per page, max 50) |

**Opportunity Card Fields:**

| Field | Type | Notes |
|---|---|---|
| Title | string | Opportunity name |
| Company/Organization | string | Hosting organization |
| Category | string | Job, scholarship, competition, etc. |
| Location | string | Physical location or "Remote" |
| Salary | object | `{ min, max, currency }` for jobs; `null` for others. Currency auto-detected (22+ ISO 4217 codes), source-context-aware. |
| Description | string | Brief description |
| Image | string (URL) | Thumbnail/preview image |
| Posted At | datetime | When originally posted |
| Source | string | Where it was scraped from (devpost, eventbrite, curated, etc.) |
| Go To Source | link | URL to the original opportunity page |
| Save/Unsave | button | Bookmark for later |

**"Ask About This" Button:**

Each opportunity card has a "💬 Ask the Mentor" button. When clicked:
1. The chatbot page opens
2. The message input is pre-filled with a contextual message including the opportunity name and details
3. The user can edit the message or hit Send
4. The Mentor-Orchestrator responds with detailed information about the specific opportunity

### 4.6 Mentor Chatbot (Mentor-Orchestrator Agent)

The Mentor is a conversational AI assistant that also serves as the system orchestrator. It has access to all other agents and routes requests intelligently.

**Capabilities:**
1. Conversational assistant — answers career questions, explains concepts, provides guidance
2. Agent access — can call Career Architect, Portfolio Manager, and Job Scout agents
3. Intent inference — detects when a user's message requires an agent and calls it automatically

**Long-term Memory:** The Mentor remembers key facts about the user across sessions. After every 10 messages in a conversation, the AI extracts lasting facts (career interests, preferences, milestones, personality traits) and stores them in the `user_memories` table.

**Conversation History:** Users can have multiple conversations with the Mentor. When a conversation exceeds 15 messages, older messages are summarized by the LLM.

### 4.7 Notifications

- In-app notification center with bell icon and unread count badge
- Notifications created for: new matching opportunities, task milestones, badges, reminders
- Frontend polls `GET /notifications/unread/count` for badge indicator
- Users can mark individual or all notifications as read
- Notification types: `opportunity`, `opportunity_scrape`, `task`, `badge`, `reminder`
- Notifications include deep-link data for navigation

### 4.8 Resume Builder

- AI generates a resume from the user's profile, roadmap, and evidence
- Available via `POST /resume/generate` and `GET /resume`
- Resume stored as structured JSON in the database


### 4.9 Dashboard / Home Screen

The dashboard is the first screen users see after login. It provides an at-a-glance summary of their career journey and a launchpad to all major features.

**Data Source:** `GET /dashboard/summary` — a single-call aggregation endpoint that returns all dashboard data. No hardcoded values.

**Dashboard Sections:**

| Section | Description | Data Source |
|---|---|---|
| Welcome / Profile | Greeting + profile card (name, email, role, interests) | `profile` from `/dashboard/summary` |
| Quick Stats | Roadmap progress %, tasks completed, opportunities available | `roadmap` + `opportunities` from `/dashboard/summary` |
| Getting Started | 4-step onboarding checklist (profile, chat, roadmap, opportunities) | `onboarding_checklist` from `/dashboard/summary` |
| Recent Opportunities | Top 3 recent opportunities with title, company, location, salary | `opportunities.recent` from `/dashboard/summary` |
| Notifications | Unread count badge + recent notifications | `notifications` from `/dashboard/summary` |
| Career Tip | Rotating tips and encouragement | Static (phase 1), personalized (phase 2) |
| Quick Links | Navigation cards to Chat, Roadmap, Opportunities, Resume | Static — no API call needed |

**Design Principles:**
- **Single API call** — the dashboard fetches everything from `GET /dashboard/summary` in one round trip
- **Graceful degradation** — if a section fails (e.g. no roadmap yet), all other sections still load
- **No hardcoded data** — all dynamic content (stats, opportunities, notifications) comes from the backend
- **Mobile-first layout** — responsive grid that stacks on mobile, side-by-side on desktop

## 5. AI Agents Summary

| Agent | Purpose | Input | Output |
|---|---|---|---|
| Career Architect | Generates personalized career roadmaps | User profile (career path, education, country, age) | Roadmap JSON (steps + tasks) |
| Portfolio Manager | Verifies task evidence using Gemini 3.5 Flash (vision), manages portfolio | Uploaded files (certificates, images) + user career context | Verification result (verified/rejected/pending) with reason and confidence |
| Job Scout | Sources Caribbean-relevant opportunities, scores them against user profiles (0–100) | Internet scraping + curated database | Scored & matched opportunities list |
| Mentor-Orchestrator | Conversational assistant + agent router | User chat messages | Natural language response (possibly agent-assisted) |
| Memory Extractor | Extracts key user facts from conversations | Conversation messages + existing memories | New user memories (up to 5 per extraction) |
| Opportunity Scraper | Scrapes opportunities from multiple sources on a schedule | RSS feeds, APIs, curated list, LLM generation | Structured opportunity data |
| **Model Router** | Routes all LLM calls to the optimal model based on task type, cost, and availability | Task type (chat, roadmap, analysis, memory extraction, embeddings) | Selected model + provider with automatic fallback |

### Model Routing Architecture

All agent LLM calls go through a centralized model router (`backend/app/services/model_router.py`) instead of directly to OpenAI/Groq. The router:

1. **Reads task type** from the calling agent (e.g., `chat`, `roadmap_generation`, `analysis`, `memory_extraction`, `opportunity_extraction`)
2. **Selects the optimal model** from `models.json` based on task requirements, context window, cost tier, and capabilities
3. **Implements fallback chains** — if the primary model is unavailable, tries secondary then tertiary models
4. **Logs model selection** for monitoring and debugging

**Task categories and routing:**

| Task Type | Primary Model | Use Case |
|---|---|---|
| `chat` | Groq Llama 3 70B | Mentor conversations, career guidance |
| `roadmap_generation` | Groq Llama 3 70B | Career roadmap generation |
| `analysis` | Groq Llama 3 70B | Resume generation, opportunity matching |
| `memory_extraction` | Groq Llama 3 8B | Extracting user facts from conversations |
| `opportunity_extraction` | Groq Llama 3 8B | Generating structured opportunities from prompts |
| `embeddings` | Sentence transformers | Semantic search for memory retrieval |

**All agents using the model router:** mentor.py, architect.py, scout.py, memory_extractor.py, opportunity_scraper.py

## 6. Technical Constraints

- **Backend:** Python 3.11+, FastAPI, async/await
- **Database:** PostgreSQL (via Supabase), SQLAlchemy ORM
- **Auth:** Supabase Auth — backend only verifies JWTs, never issues them
- **LLM (text):** Groq (Llama 3 70B + 8B) via OpenAI-compatible API — all calls routed through `model_router.py` for optimal model selection and fallback
- **LLM (vision):** Google Gemini 3.5 Flash via Google AI Studio API (free tier, 1,500 RPD) — evidence verification
- **File Storage:** Supabase Storage (public `evidence` bucket)
- **Note:** Impala/Highrise AI gateway is no longer accessible — all LLM calls go directly to Groq or Google AI Studio
- **All UUIDs, all snake_case**
- **Error shape:** `{"error": {"code": "...", "message": "..."}}`

## 6.1 Security & Rate Limiting

Implemented via FastAPI middleware in `app/middleware.py`:

**Rate Limiting** (sliding window per IP):

| Endpoint Group | Limit | Endpoints |
|---|---|---|
| LLM | 10 requests/min | `/chat/message`, `/roadmap/generate`, `/roadmap/regenerate`, `/opportunities` |
| Auth | 20 requests/min | `/auth/*` |
| Default | 60 requests/min | All other endpoints |

**Security Headers** (on all responses): HSTS, X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, Referrer-Policy, Permissions-Policy

## 7. Open Questions

| # | Question | Status |
|---|---|---|
| 1 | Should the "Ask About This" button use pre-filled messages or context objects? | **Resolved** — pre-filled messages (Phase 1) |
| 2 | How often should the Job Scout scrape for new opportunities? | **Resolved** — background scheduler scrapes every 6 hours automatically on FastAPI startup. Manual refresh available via `POST /opportunities/refresh`. Scheduler status via `GET /opportunities/scheduler/status`. |
| 3 | Should notifications be real-time or check-on-load? | **Resolved** — polling via `/opportunities/new-count` and `/notifications/unread/count` |
| 4 | What LLM model to use for the Mentor chatbot? | **Resolved** — Model router (`call_llm()`) selects optimal model per task type: Llama 3 70B for chat/roadmap/analysis, Llama 3 8B for memory extraction/opportunity generation. Automatic fallback chain if primary model is unavailable. |
| 5 | How should evidence verification handle ambiguous uploads? | **Resolved** — lenient verification with `pending` fallback. Gemini 3.5 Flash (free tier) with career-context-aware analysis. Status stays `pending` if API is down. |
| 6 | Social media scraping feasibility? | **Deferred post-competition** — public page scraping as stretch goal, not required for competition submission |

## 8. Deployment

- **Backend:** Deployed on Railway at `https://lynks-backend-production.up.railway.app`
- **Database, Auth, Storage:** Supabase (hosted)
- **Frontend:** Deployed separately by frontend team
- **Monitoring:** Swagger UI available at `/docs` on the live backend
