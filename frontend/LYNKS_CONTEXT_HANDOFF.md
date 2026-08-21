# Lynks — Context Handoff Document

## What Is Lynks?

Lynks is an **AI-powered career accelerator for Caribbean youth**. It provides personalized career roadmaps, verifies achievements, discovers opportunities, and guides users through a conversational mentor — all tailored to the Caribbean context.

**Repository:** https://github.com/PHAB4/Lynks-Backend
**Tech Stack:** Python (FastAPI) + SQLAlchemy + Supabase (Auth + Postgres + Storage) + Groq (LLM)

---

## Current Project Status

| Component | Status | Notes |
|-----------|--------|-------|
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
│   │   ├── main.py             ← FastAPI entry point
│   │   ├── agents/
│   │   │   ├── architect.py    ← Career roadmap generation
│   │   │   ├── scout.py        ← Caribbean opportunity discovery
│   │   │   ├── portfolio_manager.py ← Evidence verification
│   │   │   ├── mentor.py       ← Chatbot orchestrator
│   │   │   └── opportunity_scraper.py ← Scrapes opportunities
│   │   ├── api/routes/
│   │   │   ├── roadmap.py      ← POST /roadmap/generate, GET /roadmap
│   │   │   ├── portfolio.py    ← POST /tasks/{id}/evidence, GET /portfolio
│   │   │   ├── opportunities.py ← GET /opportunities
│   │   │   └── chat.py         ← POST /chat/message, GET /chat/history
│   │   ├── models/
│   │   │   ├── db_models.py    ← SQLAlchemy ORM
│   │   │   └── schemas.py      ← Pydantic shapes
│   │   ├── core/
│   │   │   ├── config.py       ← Env vars
│   │   │   └── security.py     ← JWT verification
│   │   ├── db/
│   │   │   └── postgres.py     ← Async DB session
│   │   └── services/
│   │       ├── common.py       ← Shared helpers
│   │       └── storage.py      ← Supabase Storage uploads
│   └── tests/
│       ├── test_endpoints.py   ← 16 endpoint tests
│       └── check_env.py        ← Connection diagnostics
├── docs/
│   ├── PRD.md                  ← Full product requirements
│   ├── API_CONTRACT.md         ← All endpoint shapes
│   ├── SCHEMA.md               ← Database schema
│   ├── ORIGINAL_PRD.md         ← Original PRD
│   └── TECH_STACK.md           ← Tech stack summary
└── .gitignore
```

---

## API Endpoints

All endpoints require: `Authorization: Bearer <supabase_jwt_token>`

### Roadmap
- `POST /roadmap/generate` → Generate roadmap
- `GET /roadmap` → Get active roadmap with steps + tasks
- `POST /roadmap/regenerate` → Replace with new roadmap

### Portfolio
- `POST /tasks/{task_id}/evidence` → Upload evidence (multipart: file + file_type)
- `GET /portfolio` → Get verified tasks + evidence

### Opportunities
- `GET /opportunities` → All opportunities (relevance-scored)
- `GET /opportunities?category=competition` → Filter by: job, club, competition, scholarship, event, volunteer

### Chat
- `POST /chat/message` → Send message to Mentor
- `GET /chat/history` → Get conversation history
- `DELETE /chat/history` → Clear history

---

## Response Shapes

### GET /roadmap
```json
{
  "roadmap_id": "uuid",
  "steps": [
    {
      "step_id": "uuid",
      "title": "Build Your Foundation",
      "description": "...",
      "order": 1,
      "status": "pending",
      "tasks": [
        {
          "task_id": "uuid",
          "title": "Enroll in freeCodeCamp",
          "description": "...",
          "order": 1,
          "status": "pending"
        }
      ]
    }
  ]
}
```

### GET /opportunities
```json
[
  {
    "id": "uuid",
    "title": "Jamaica Science Olympiad",
    "company": "...",
    "location": "Jamaica",
    "pay": "Free",
    "experience_required": "None",
    "age_range": "Under 18",
    "url": "https://...",
    "category": "competition",
    "relevance_score": 0.8
  }
]
```

### POST /chat/message
```json
Request: { "message": "Find me competitions", "conversation_id": "uuid (optional)" }
Response: { "conversation_id": "uuid", "response": "Here are...", "tool_calls": [...] }
```

---

## Pages to Build

| Page | Route | What it shows |
|------|-------|--------------|
| Landing | `/` | Hero + CTA |
| Login | `/login` | Supabase Auth login |
| Onboarding | `/onboarding` | 3-step profile setup |
| Dashboard | `/dashboard` | Overview |
| Roadmap | `/roadmap` | Visual timeline |
| Opportunities | `/opportunities` | Two tabs: For You + Browse All |
| Portfolio | `/portfolio` | Verified achievements |
| Chat | `/chat` | Mentor chatbot |

---

## Key Design Decisions

1. **Opportunities page**: Shows all, defaults to "For You" (relevance-scored), toggle to "Browse All" with filters
2. **"Ask About This" button**: Opens chatbot with pre-filled message (just passes string to POST /chat/message)
3. **Mentor = Orchestrator**: One agent with access to all others — decides when to call an agent vs answer directly
4. **Step status is computed**: "complete" only when ALL tasks are complete
5. **Caribbean-specific**: All data tailored to Caribbean youth
6. **Evidence verification**: Synchronous — immediate verified/rejected response

---

## Environment Variables

```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

## What You Should Do

1. Connect Shogo to repo: `https://github.com/PHAB4/Lynks-Backend.git`
2. Work only in `frontend/` folder
3. Initialize Next.js: `npx create-next-app@latest . --typescript --tailwind --eslint`
4. Read `docs/API_CONTRACT.md` for endpoint details
5. Read `docs/PRD.md` for full product requirements
6. Build pages, commit, push regularly
7. Contact backend dev (PHAB4) for API questions
