# Lynks — Product Requirement Document

**Last updated:** August 27, 2026

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

### 4.3 Task Evidence & Verification (Portfolio Manager Agent)

- Users mark tasks as complete and upload evidence (certificates, photos, links)
- AI verifies uploaded evidence using Llama 3 Vision (synchronous on upload)
- Verification result: `verified`, `rejected`, or `pending`
- Evidence is stored in Supabase Storage (public `evidence` bucket)
- Portfolio page shows all completed tasks with verified evidence

### 4.4 Career Opportunities (Job Scout Agent)

- Sources Caribbean-specific opportunities: jobs, competitions, clubs, scholarships, events, volunteer roles
- Opportunities are scraped from multiple sources (Devpost API, Eventbrite API, RSS feeds, curated list)
- Cached in-memory with 1-hour TTL for fast responses
- Structured salary data for jobs (salary_min, salary_max, salary_currency) with **priority-based currency detection** (22+ currencies, source-context-aware)
- Category-based filtering, time-based filtering, relevance sorting
- Users can save/bookmark opportunities for later
- New-opportunity notification polling via `GET /opportunities/new-count`
- Social media scraping (Facebook, Instagram) — stretch goal

### 4.5 Career Opportunities Page — UX Pattern

The career opportunities page uses a two-tab filter system with a VIEW mode selector:

**VIEW Mode (top right dropdown):**

| Mode | Description |
|---|---|
| **Career** | Shows ONLY job opportunities |
| **General** | Shows ALL scraped opportunities — jobs, internships, youth groups, grants, education, etc. |

**Filter Tabs (below search bar):**

| Tab | Description |
|---|---|
| **All Web-scraped** | All opportunities in the current VIEW mode |
| **Personal matches** | Opportunities tailored to the user's profile (scoped to current VIEW mode) |

**Additional Controls:**

| Control | Options | Notes |
|---|---|---|
| Search bar | Text input | Filters by title and company name |
| Time filter | Today, This Week, This Month | Dropdown to the right of search bar |
| Save icon | Toggle | When clicked, shows only bookmarked opportunities |

**Opportunity Card Fields:**

| Field | Type | Notes |
|---|---|---|
| Company initial | Avatar | Circular avatar with company first letter |
| Title | string | Opportunity name |
| Type badge | string | Category label (Job, Internship, Youth Group, Grant) — shown on General view |
| Company/Organization | string | Hosting organization |
| Location | string | Physical location or "Remote" |
| Salary | object | `{ min, max, currency }` for jobs; `null` for others. Currency auto-detected (22+ ISO 4217 codes), source-context-aware. |
| Recency number | int | Top right — scrape order (1 = most recent) |
| Save/Unsave | icon | Bookmark icon — fills with `#6B26EA` when saved |
| Go to source | link | Purple `#6B26EA` button linking to the original opportunity page |

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
- Notification types: `opportunity`, `task`, `badge`, `reminder`
- Notifications include deep-link data for navigation

### 4.8 Resume Builder

- AI generates a resume from the user's profile, roadmap, and evidence
- Available via `POST /resume/generate` and `GET /resume`
- Resume stored as structured JSON in the database

## 5. AI Agents Summary

| Agent | Purpose | Input | Output |
|---|---|---|---|
| Career Architect | Generates personalized career roadmaps | User profile (career path, education, country, age) | Roadmap JSON (steps + tasks) |
| Portfolio Manager | Verifies task evidence, manages portfolio | Uploaded files (certificates, images) | Verification result (verified/rejected/pending) |
| Job Scout | Sources Caribbean-relevant opportunities | Internet scraping + curated database | Matched opportunities list |
| Mentor-Orchestrator | Conversational assistant + agent router | User chat messages | Natural language response (possibly agent-assisted) |
| Memory Extractor | Extracts key user facts from conversations | Conversation messages + existing memories | New user memories (up to 5 per extraction) |
| Opportunity Scraper | Scrapes opportunities from multiple sources | RSS feeds, APIs, social media, LLM generation | Structured opportunity data |

## 6. Technical Constraints

- **Backend:** Python 3.11+, FastAPI, async/await
- **Database:** PostgreSQL (via Supabase), SQLAlchemy ORM
- **Auth:** Supabase Auth — backend only verifies JWTs, never issues them
- **LLM:** OpenAI-compatible API (currently Groq free tier)
- **File Storage:** Supabase Storage (public `evidence` bucket)
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
| 2 | How often should the Job Scout scrape for new opportunities? | **Resolved** — in-memory cache with 1-hour TTL, on-demand refresh |
| 3 | Should notifications be real-time or check-on-load? | **Resolved** — polling via `/opportunities/new-count` and `/notifications/unread/count` |
| 4 | What LLM model to use for the Mentor chatbot? | **Resolved** — Groq (Llama 3 70B) for now |
| 5 | How should evidence verification handle ambiguous uploads? | **Proposed** — status stays `pending`, doesn't block the upload |
| 6 | Social media scraping feasibility? | **Open** — deferred post-competition, public page scraping as stretch goal |

## 8. Deployment

- **Backend:** Deployed on Railway at `https://lynks-backend-production.up.railway.app`
- **Database, Auth, Storage:** Supabase (hosted)
- **Frontend:** Deployed separately by frontend team
- **Monitoring:** Swagger UI available at `/docs` on the live backend
