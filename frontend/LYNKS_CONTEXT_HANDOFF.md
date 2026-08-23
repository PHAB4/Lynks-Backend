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
| Login | `/login` | Email/password login (Supabase Auth) |
| Onboarding | `/onboarding` | 3-step profile setup |
| Dashboard | `/dashboard` | Overview — active roadmap, recent activity |
| Roadmap | `/roadmap` | Visual timeline of steps + tasks |
| Opportunities | `/opportunities` | Two tabs: "For You" + "Browse All" with filters |
| Portfolio | `/portfolio` | Verified achievements + evidence |
| Chat | `/chat` | Mentor chatbot interface |

---

## Key Design Decisions

1. **Opportunities page** shows ALL opportunities, defaults to "For You" (relevance-scored), with a toggle to "Browse All" with filters (category, country, age, experience, price)
2. **"Ask About This" button** on each opportunity card — opens the chatbot with a pre-filled message asking about that specific opportunity (no backend changes needed — just passes a string to POST /chat/message)
3. **Mentor-Orchestrator** is ONE agent — it's a conversational assistant with access to all other agents (roadmap, portfolio, opportunities). It decides when to call an agent vs answer directly
4. **Step status is computed**, not stored — a step is "complete" only when ALL its tasks are complete
5. **Caribbean-specific** — all data, opportunities, and context are tailored to Caribbean youth (Jamaica, Trinidad, Barbados, etc.)
6. **Evidence verification** is synchronous — user uploads a file, LLM checks it, returns verified/rejected immediately

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
