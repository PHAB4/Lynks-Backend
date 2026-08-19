# Lynks — Product Requirement Document

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
- Opportunities are scraped periodically and stored in the database
- Two browse modes:
  - **"For You"** (default): opportunities matched to the user's profile, sorted by relevance
  - **"Browse All"**: full catalog, filterable by category, country, age, experience level, price
- Users can be notified when relevant new opportunities appear

### 4.5 Career Opportunities Page — UX Pattern

The career opportunities page has two tabs:

| Tab | Description |
|---|---|
| **For You** (default) | Opportunities matched to the user's profile, sorted by relevance. Uses rule-based matching against career path, country, age, education level. No AI required. |
| **Browse All** | Full catalog of all opportunities with filters. |

**Filters available on Browse All:**

| Filter | Options |
|---|---|
| Category | Job, Competition, Club, Scholarship, Event, Volunteer |
| Experience Level | None, Beginner, Intermediate, Advanced |
| Age Range | Under 16, 16–18, 18–21, 21+ |
| Country | Jamaica, Trinidad, Barbados, Bahamas, etc. + "Remote" / "Caribbean Regional" |
| Price | Free, Paid |
| Status | Open, Closing Soon, Closed |

**"Ask About This" Button:**

Each opportunity card has a "💬 Ask the Mentor" button. When clicked:
1. The chatbot page opens
2. The message input is pre-filled with a contextual message including the opportunity name and details
3. The user can edit the message or hit Send
4. The Mentor-Orchestrator responds with detailed information about the specific opportunity

This is implemented purely on the frontend — no backend changes required. The pre-filled message contains enough context (opportunity name, category, location, requirements) for the LLM to respond accurately. The existing `POST /chat/message` endpoint handles this without modification.

**Optional Enhancement (Phase 2):** Pass an `opportunity_id` as a context object alongside the message in `POST /chat/message`. The backend then fetches the full opportunity details before sending to the LLM, improving reliability for opportunities with long or ambiguous names.

**Connection to the Chatbot:**
- The opportunities page and chatbot share the same database (same `opportunities` table)
- The chatbot can recommend opportunities via the Job Scout agent
- The "Ask About This" button creates a seamless link from the page to the chatbot
- Both views are complementary — one visual, one conversational

### 4.6 Mentor Chatbot (Mentor-Orchestrator Agent)

The Mentor is a conversational AI assistant that also serves as the system orchestrator. It has access to all other agents and routes requests intelligently.

**Capabilities:**
1. Conversational assistant — answers career questions, explains concepts, provides guidance
2. Agent access — can call Career Architect, Portfolio Manager, and Job Scout agents
3. Intent inference — detects when a user's message requires an agent and calls it automatically

**How it works:**
- Uses OpenAI SDK tool-calling format with 3 tools: `generate_roadmap`, `get_portfolio`, `find_opportunities`
- When a user message matches an agent's purpose, the LLM triggers the appropriate tool
- The tool executes and returns structured data to the LLM
- The LLM formats the data into a natural conversational response
- Conversation history is persisted in `conversations` + `messages` tables

**Example flows:**

| User says | What happens |
|---|---|
| "What's a variable?" | Answered directly — no agent needed |
| "Give me a roadmap" | Career Architect agent called |
| "What competitions are coming up?" | Job Scout agent called |
| "I uploaded my certificate" | Portfolio Manager agent called |
| "Tell me about the Jamaica Science Olympiad" | Job Scout agent called (from "Ask About This" button) |

**Personality:** Caribbean-aware, encouraging, uses first-principles explanations with concrete analogies. Avoids jargon. Understands local context (Caribbean institutions, job market, visa requirements).

### 4.7 Notifications (Phase 2)

- When a new opportunity matches a user's profile, a notification is created
- Frontend shows "New opportunity for you!" badge
- Notifications are stored in the `notifications` table
- Users can mark notifications as read

## 5. AI Agents Summary

| Agent | Purpose | Input | Output |
|---|---|---|---|
| Career Architect | Generates personalized career roadmaps | User profile (career path, education, country, age) | Roadmap JSON (steps + tasks) |
| Portfolio Manager | Verifies task evidence, manages portfolio | Uploaded files (certificates, images) | Verification result (verified/rejected/pending) |
| Job Scout | Sources Caribbean-relevant opportunities | Internet scraping + curated database | Matched opportunities list |
| Mentor-Orchestrator | Conversational assistant + agent router | User chat messages | Natural language response (possibly agent-assisted) |

## 6. Technical Constraints

- **Backend:** Python 3.11+, FastAPI, async/await
- **Database:** PostgreSQL (via Supabase), SQLAlchemy ORM
- **Auth:** Supabase Auth — backend only verifies JWTs, never issues them
- **LLM:** OpenAI-compatible API (currently Groq free tier, migrating to Impala/Highrise compute)
- **File Storage:** Supabase Storage (public `evidence` bucket)
- **All UUIDs, all snake_case**
- **Error shape:** `{"error": {"code": "...", "message": "..."}}`

## 7. Open Questions

| # | Question | Status |
|---|---|---|
| 1 | Should the "Ask About This" button use pre-filled messages or context objects? | **Resolved** — pre-filled messages (Phase 1), context objects optional (Phase 2) |
| 2 | How often should the Job Scout scrape for new opportunities? | **Proposed** — every 24 hours via scheduled cron job |
| 3 | Should notifications be real-time or check-on-load? | **Open** — team to decide |
| 4 | What LLM model to use for the Mentor chatbot? | **Resolved** — Groq (Llama 3 70B) for now |
| 5 | How should evidence verification handle ambiguous uploads? | **Proposed** — status stays `pending`, doesn't block the upload |
| 6 | Sync vs async evidence verification? | **Resolved** — synchronous (simpler, better UX for demo) |

## 8. Deployment

- Must be deployable and always-on (no local-only demos)
- Free tier hosting options: Railway, Render, or Fly.io for backend
- Supabase provides hosting for database, auth, and storage
- Frontend hosted separately (teammate's responsibility)