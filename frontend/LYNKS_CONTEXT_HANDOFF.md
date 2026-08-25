# Lynks — Context Handoff Document

## What Is Lynks?

Lynks is an **AI-powered career accelerator for Caribbean youth**. It provides personalized career roadmaps, verifies achievements, discovers opportunities, and guides users through a conversational mentor — all tailored to the Caribbean context.

**Repository:** https://github.com/PHAB4/Lynks-Backend
**Tech Stack:** Python (FastAPI) + SQLAlchemy + Supabase (Auth + Postgres + Storage) + Groq (LLM)

---

## Current Project Status

| Component | Status | Notes |
|---|---|---|
| Backend server | ✅ Boots and runs | `uvicorn app.main:app --reload --port 8000` |
| LLM connection (Groq) | ✅ Working | Uses `openai/gpt-ss-20b` model |
| Auth (Supabase JWT) | ✅ Working | Supabase handles signup/signin |
| Database (Supabase Postgres) | ⚠️ Blocked on dev's local network | Code is correct, needs unrestricted network |
| Career Architect agent | ✅ Built | Generates personalized roadmaps |
| Portfolio Manager agent | ✅ Built | Verifies evidence with LLM Vision |
| Job Scout agent | ✅ Built | Caribbean-specific opportunities + scraper |
| Mentor-Orchestrator agent | ✅ Built | Unified chatbot with tool-calling |
| Test script | ✅ Built | 16 endpoint tests |
| Frontend | ⏳ YOU | Starting now |

---

## Repository Structure

```
Lynks-Backend/
├── frontend/                    ← YOUR WORKSPACE
│   ├── README.md                ← Setup instructions
│   └── components/
├── backend/
│   ├── app/
│   │   ├── main.py             ← FastAPI entry point (registers all routers)
│   │   ├── agents/
│   │   │   ├── architect.py    ← Career roadmap generation (calls LLM)
│   │   │   ├── scout.py        ← Caribbean opportunity discovery
│   │   │   ├── portfolio_manager.py ← Evidence verification
│   │   │   ├── mentor.py       ← Chatbot orchestrator (calls all agents)
│   │   │   └── opportunity_scraper.py ← Scrapes opportunities from internet
│   │   ├── api/routes/
│   │   │   ├── roadmap.py      ← POST /roadmap/generate, GET /roadmap
│   │   │   ├── portfolio.py    ← POST /tasks/{id}/evidence, GET /portfolio
│   │   │   ├── opportunities.py ← GET /opportunities?category=...
│   │   │   └── chat.py         ← POST /chat/message, GET /chat/history
│   │   ├── models/
│   │   │   ├── db_models.py    ← SQLAlchemy ORM (all tables)
│   │   │   └── schemas.py      ← Pydantic request/response shapes
│   │   ├── core/
│   │   │   ├── config.py       ← Environment variable loading
│   │   │   └── security.py     ← JWT verification (Supabase)
│   │   ├── db/
│   │   │   └── postgres.py     ← Async database session
│   │   └── services/
│   │       ├── common.py       ← Shared helpers
│   │       └── storage.py      ← Supabase Storage file uploads
│   ├── tests/
│   │   ├── test_endpoints.py   ← 16 endpoint tests
│   │   ├── check_env.py        ← Connection diagnostics
│   │   └── test_db_conn.py     ← Database connection test
│   ├── .env.example            ← Template for environment variables
│   └── requirements.txt        ← Python dependencies
├── docs/
│   ├── PRD.md                  ← Full product requirements
│   ├── API_CONTRACT.md         ← All endpoint shapes (request/response)
│   ├── SCHEMA.md               ← Database schema
│   ├── ORIGINAL_PRD.md         ← Original PRD (untouched)
│   └── TECH_STACK.md           ← Tech stack summary
└── .gitignore
```

---

## API Endpoints (What You'll Connect To)

All endpoints require a Supabase JWT token in the `Authorization: Bearer <token>` header.

### Roadmap
| Method | Endpoint | What it does |
|--------|----------|-------------|
| POST | `/roadmap/generate` | Generate a new career roadmap |
| GET | `/roadmap` | Get the user's active roadmap |
| POST | `/roadmap/regenerate` | Replace roadmap with a new one |

**GET /roadmap response:**
```json
{
  "roadmap_id": "uuid",
  "steps": [
    {
      "step_id": "uuid",
      "title": "Build Your Foundation",
      "description": "Start with the basics...",
      "order": 1,
      "status": "pending",
      "tasks": [
        {
          "task_id": "uuid",
          "title": "Enroll in freeCodeCamp",
          "description": "Complete the responsive web design curriculum...",
          "order": 1,
          "status": "pending"
        }
      ]
    }
  ]
}
```

### Portfolio
| Method | Endpoint | What it does |
|--------|----------|-------------|
| POST | `/tasks/{task_id}/evidence` | Upload evidence (multipart file) |
| GET | `/portfolio` | Get verified tasks + evidence |

### Opportunities
| Method | Endpoint | What it does |
|--------|----------|-------------|
| GET | `/opportunities` | Get all opportunities (relevance-scored) |
| GET | `/opportunities?category=competition` | Filter by: job, club, competition, scholarship, event, volunteer |

**GET /opportunities response:**
```json
[
  {
    "id": "uuid",
    "title": "Jamaica Science Olympiad",
    "company": "Jamaica Science Teachers' Association",
    "location": "Jamaica",
    "pay": "Free",
    "experience_required": "None",
    "age_range": "Under 18",
    "url": "https://jamaicascienceolympiad.org",
    "category": "competition",
    "relevance_score": 0.8
  }
]
```

### Chat (Mentor-Orchestrator)
| Method | Endpoint | What it does |
|--------|----------|-------------|
| POST | `/chat/message` | Send message to the Mentor |
| GET | `/chat/history` | Get conversation history |
| DELETE | `/chat/history` | Clear conversation history |

**POST /chat/message request:**
```json
{
  "conversation_id": "uuid (optional — omit for new conversation)",
  "message": "Find me competitions in Jamaica"
}
```

**POST /chat/message response:**
```json
{
  "conversation_id": "uuid",
  "response": "Great question! Here are some competitions...",
  "tool_calls": [{"tool": "find_opportunities", "args": {}, "result": {...}}]
}
```

---

## Pages to Build

| Page | Route | What it shows |
|------|-------|--------------|
| Landing | `/` | Hero section, CTA to sign up |
| Login | `/login` | Email/password login (Supabase Auth) with password validation (uppercase, lowercase, number, special char, 8+ chars) |
| Signup | `/signup` | Email/password signup with real-time password validation indicators |
| Onboarding | `/onboarding` | 7-step profile setup (full name, country, age, education, career interest, employment, bio) |
| Dashboard | `/dashboard` | Overview — welcome message, recent activity, quick actions |
| Roadmap | `/roadmap` | Visual timeline of steps + tasks |
| Opportunities | `/opportunities` | Two VIEW modes (Career/General), filter tabs (Personal/All), time filter, save, cards |
| Portfolio | `/portfolio` | Verified achievements + evidence |
| Chat | `/chat` | Mentor chatbot interface |
| Resume | `/resume` | Resume preview with PDF/Word download, edit button |
| Settings | `/settings` | Profile editor — name, email, phone, career interests |

### Split-Screen System

The app uses a split-screen layout with a collapsible sidebar and up to 2 simultaneous panels:

**Sidebar:**
- **Collapsed (75px):** LYNKS logo (expands), Home, Opportunities, Profile, avatar
- **Expanded (305px):** Full nav with LYNKS title, back arrow, Home, Opportunities, Projects list, Profile/Settings/Logout
- Clicking any panel icon auto-collapses the sidebar

**Top Icon Bar (hidden on `/dashboard`):**
- 4 icons: Steps, Roadmap, Chat, Resume — right-justified on all non-dashboard pages
- Click icon → opens/closes corresponding panel

**Panel Rules:**
- Max 2 panels at a time
- Chat/Roadmap → left side | Steps/Resume → right side
- Clicking a same-side icon replaces that panel; clicking opposite side adds it
- When 2 panels open → center page content hidden, panels fill full width
- Loading spinner while panel content generates

---

## Key Design Decisions

1. **Opportunities page** uses VIEW Mode (Career/General) with filter tabs (All Web-scraped / Personal matches), time filter (Today/Week/Month), save/bookmark, and Go to Source button
2. **"Ask About This" button** on each opportunity card — opens the chatbot with a pre-filled message (no backend changes needed)
3. **Mentor-Orchestrator** is ONE agent — conversational assistant with access to all other agents
4. **Step status is computed**, not stored — a step is "complete" only when ALL its tasks are complete
5. **Caribbean-specific** — all data, opportunities, and context are tailored to Caribbean youth
6. **Evidence verification** is synchronous — user uploads, LLM checks, returns verified/rejected immediately
7. **Split-screen system** — max 2 panels open at once; sidebar collapses when panels are active; center content hides when 2 panels fill the width
8. **Password validation** — both login and signup require uppercase, lowercase, number, special character, and 8+ characters
9. **Auth flow** — signup routes to `/onboarding` (7 steps), login routes to `/dashboard`

---

## Tech Stack Details

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js + TypeScript + Tailwind CSS + shadcn/ui |
| Backend | Python FastAPI + SQLAlchemy (async) |
| Database | Supabase Postgres (free tier) |
| Auth | Supabase Auth (JWT tokens) |
| File Storage | Supabase Storage (free tier) |
| LLM | Groq API (free tier) — model: `openai/gpt-ss-20b` |
| SDK | `@shogo-ai/sdk` for frontend-backend communication |

---

## Environment Variables (.env)

```
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
DATABASE_URL=postgresql+asyncpg://postgres:password@db.xxxxx.supabase.co:5432/postgres
LLM_API_BASE_URL=https://api.groq.com/openai/v1
LLM_API_KEY=your-groq-api-key
LLM_MODEL=openai/gpt-ss-20b
```

---

## Open Items / Known Issues

1. **Database connection** works in code but is blocked on the backend dev's current network (public WiFi). Will work on unrestricted network.
2. **Opportunity scraper** has a curated list + LLM-based generation. Needs scheduled execution (cron job) for production.
3. **Notification system** — when new opportunities match a user's profile, notify them. Not built yet (Phase 2).
4. **Resume builder** — not yet built. Schema exists (`resumes` table) but no agent or routes.
5. **S3/Supabase Storage** — evidence uploads use Supabase Storage. The `evidence` bucket needs to be created as public in the Supabase dashboard.

---

## What You Should Do

1. Connect your Shogo to the repo: `https://github.com/PHAB4/Lynks-Backend.git`
2. Work only inside the `frontend/` folder
3. Initialize a Next.js app: `npx create-next-app@latest . --typescript --tailwind --eslint`
4. Read `docs/API_CONTRACT.md` for exact endpoint shapes
5. Read `docs/PRD.md` for full product requirements
6. Build pages following the structure in the README inside `frontend/`
7. Use environment variables for the API URL: `NEXT_PUBLIC_API_URL=https://lynks-backend-production.up.railway.app`
8. Commit and push regularly

---

## Questions?

Contact the backend developer (PHAB4) for:
- Backend endpoint changes
- Database schema questions
- Agent behavior clarifications
- API response shape changes
