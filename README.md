# 🚀 Lynks — Your Career, Verified

> A Caribbean-focused platform that gives young people a personalized career roadmap, lets them build verifiable proof of progress, and connects them with opportunities — closing the gap between "did the work" and "got the opportunity."

<p align="center">
  <img src="https://img.shields.io/badge/Python-3.11+-blue?style=flat-square&logo=python" alt="Python">
  <img src="https://img.shields.io/badge/FastAPI-0.111+-009688?style=flat-square&logo=fastapi" alt="FastAPI">
  <img src="https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react" alt="React">
  <img src="https://img.shields.io/badge/Supabase-PostgreSQL+Auth+Storage-3FCF8E?style=flat-square&logo=supabase" alt="Supabase">
  <img src="https://img.shields.io/badge/Llama_3_70B-Groq-8B5CF6?style=flat-square" alt="LLM">
  <img src="https://img.shields.io/badge/Gemini_2.5_Flash-Google_AI-4285F4?style=flat-square" alt="Vision">
</p>

---

## The Problem

Young, ambitious individuals struggle to access career opportunities they're genuinely qualified for. Unofficial networks — nepotism, existing connections — determine who gets opportunities rather than merit or effort. There's no reliable way for someone starting from zero to know what steps actually lead to their goal, and prove to an employer that they've done the work.

## The Solution

Lynks is a Caribbean-focused career platform that:

1. **Generates personalized roadmaps** — AI-powered step-by-step career plans tailored to each user's profile, skills, and goals
2. **Verifies your progress** — Upload certificates and evidence; AI verifies their authenticity and career relevance
3. **Builds your resume** — Auto-generates a resume from your completed tasks and verified portfolio
4. **Discovers opportunities** — Curated jobs, events, competitions, and scholarships across 10+ Caribbean countries
5. **Provides mentorship** — An AI chatbot with full context about your roadmap, portfolio, and goals

---

## Features

### 🗺️ AI Career Roadmap
- Career Architect agent generates personalized roadmaps from your profile
- Knows your existing skills, experience, certifications, and projects
- Skips introductory steps you've already mastered
- Adapts to your education level, country, and employment status
- Regenerate your roadmap anytime as your goals change

### ✅ Task Completion & Portfolio
- Mark roadmap tasks as completed
- Upload photos and certificates as evidence
- AI-powered verification checks:
  - Document type and content legitimacy
  - Issuer detection
  - Career relevance (is this cert useful for your path?)
  - Confidence scoring with detailed feedback
- Request re-verification if evidence was incorrectly rejected
- All files stored securely in Supabase Storage (S3-compatible)

### 📄 Resume Builder
- AI-generated resume from your completed tasks and verified portfolio
- Edit and customize the generated content
- Download as PDF (client-side generation via `@react-pdf/renderer`)

### 💼 Opportunity Discovery
- 30+ curated Caribbean opportunities across multiple sources:
  - RSS feeds (Jamaica Gleaner, Loop Caribbean, UWI, Devpost)
  - Devpost API, Eventbrite API
  - LLM-generated supplement for gap coverage
- Filter by country, pay range, age requirement, experience level, category
- Save/bookmark opportunities
- Auto-refreshed every 6 hours via background scheduler
- Priority-based currency detection (JMD, TTD, BSD, etc.)

### 🤖 AI Mentor (Chatbot)
- Persistent conversation history with summarization
- Full context: roadmap, portfolio, memories, cross-conversation summaries
- Tool-calling: can search opportunities, mark tasks complete, regenerate roadmaps
- Caribbean-aware advice tailored to your country and career path

### 🔔 Notifications
- In-app notification system
- Auto-generated alerts for new opportunities, roadmap updates
- Mark read / mark all read
- Unread count badge

### 📊 Dashboard
- Personalized metrics: tasks completed, roadmap progress, portfolio count
- Upcoming opportunities and recent activity

### 🎓 Onboarding
- Profile setup wizard: career path, interests, education, country, age
- Visual career path selector with images

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Backend** | Python 3.11, FastAPI, SQLAlchemy (async), Alembic |
| **Database** | Supabase (PostgreSQL + Auth + Storage) |
| **Authentication** | Supabase Auth (JWT-based, email/password) |
| **File Storage** | Supabase Storage (S3-compatible, evidence bucket) |
| **LLM (Text)** | Groq Cloud — Llama 3 70B (primary), Llama 3 8B (fallback) |
| **LLM (Vision)** | Google Gemini 2.5 Flash (evidence verification) |
| **LLM (Fallbacks)** | MiniMax M2.7/M3, Gemini 3.1 Flash Lite, Gemini 3.5 Flash Lite, Gemini 3 Flash |
| **Frontend** | React 18, Next.js, Tailwind CSS, shadcn/ui |
| **PDF Generation** | @react-pdf/renderer (client-side) |
| **Deployment** | Railway (backend), Vercel/Firebase (frontend) |
| **CI/CD** | GitHub Actions (lint, tests, security scan) |
| **Testing** | pytest, pytest-asyncio, pytest-cov |

### AI Model Routing

Lynks uses a smart model router that automatically selects the best LLM for each task:

| Priority | Provider | Model | Cost |
|---|---|---|---|
| 1 | Groq | Llama 3 70B | Free |
| 2 | Groq | Llama 3 8B | Free |
| 3 | MiniMax | M2.7 | $0.30 / $1.20 per 1M tokens |
| 4 | MiniMax | M3 | $0.30 / $1.20 per 1M tokens |
| 5 | Gemini | 3.1 Flash Lite | $0.25 / $1.50 per 1M tokens |
| 6 | Gemini | 3.5 Flash Lite | $0.30 / $2.50 per 1M tokens |
| 7 | Gemini | 3 Flash | $0.50 / $3.00 per 1M tokens |

**Vision tasks** (evidence verification) route through Gemini 2.5 Flash Lite.

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Frontend (React)                   │
│  Next.js · Tailwind · shadcn/ui · @react-pdf        │
│                                                       │
│  Pages: Dashboard · Roadmap · Opportunities ·        │
│         Resume · Portfolio · Settings · Chat          │
└───────────────────────┬─────────────────────────────┘
                        │ REST API (HTTPS)
┌───────────────────────┴─────────────────────────────┐
│                  Backend (FastAPI)                    │
│                                                       │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────┐  │
│  │  Auth Layer  │  │  Agent Layer  │  │  Scheduler │  │
│  │  (Supabase)  │  │              │  │  (cronjob)  │  │
│  └─────────────┘  │  • Architect  │  └────────────┘  │
│                   │  • Mentor     │                   │
│  ┌─────────────┐  │  • Verifier  │  ┌────────────┐  │
│  │   Database   │  │  • Router    │  │  Model     │  │
│  │  (Supabase)  │  └──────────────┘  │  Router    │  │
│  │  PostgreSQL   │                    └────────────┘  │
│  └─────────────┘                                     │
└───────────────────────┬─────────────────────────────┘
                        │
        ┌───────────────┼───────────────┐
        │               │               │
   ┌────┴────┐   ┌─────┴─────┐   ┌────┴────┐
   │  Groq   │   │  MiniMax  │   │ Gemini  │
   │ (text)  │   │  (text)   │   │ (vision)│
   └─────────┘   └───────────┘   └─────────┘
```

---

## Getting Started

### Prerequisites

- Python 3.11+
- Node.js 18+
- Supabase account (free tier works)
- Groq API key (free)
- Google AI Studio API key (free)

### Backend Setup

```bash
# Clone the repo
git clone https://github.com/PHAB4/Lynks-Backend.git
cd Lynks-Backend

# Navigate to backend
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Set up environment variables
cp .env.example .env
# Edit .env with your keys:
#   SUPABASE_URL=https://your-project.supabase.co
#   SUPABASE_ANON_KEY=your-anon-key
#   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
#   GROQ_API_KEY=your-groq-key
#   GEMINI_API_KEY=your-google-ai-key

# Run database migrations
alembic upgrade head

# Start the server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Set up environment variables
cp .env.local.example .env.local
# Edit .env.local with your Supabase keys and backend URL

# Start the dev server
npm run dev
```

The app will be available at `http://localhost:3000`.

---

## API Endpoints

### Authentication & Profile

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/signup` | Create account |
| POST | `/api/auth/login` | Sign in |
| POST | `/api/auth/logout` | Sign out |
| GET | `/api/profile` | Get user profile |
| PATCH | `/api/profile` | Update profile |
| PATCH | `/api/profile/career-path` | Change career path |

### Roadmap & Tasks

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/roadmap/generate` | Generate new roadmap |
| GET | `/api/roadmap` | Get current roadmap |
| POST | `/api/roadmap/regenerate` | Regenerate roadmap |
| PATCH | `/api/roadmap/tasks/{task_id}/complete` | Mark task done |
| PATCH | `/api/roadmap/tasks/{task_id}` | Update task |
| GET | `/api/roadmap/steps/{step_id}/tasks` | Get tasks for a step |

### Evidence & Portfolio

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/evidence/upload` | Upload evidence file |
| GET | `/api/evidence/task/{task_id}` | Get evidence for a task |
| DELETE | `/api/evidence/{evidence_id}` | Delete evidence |
| POST | `/api/evidence/{evidence_id}/re-verify` | Re-request AI verification |
| GET | `/api/portfolio` | Get full portfolio |

### Resume

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/resume/generate` | AI-generate resume |
| GET | `/api/resume` | Get resume |
| PATCH | `/api/resume` | Edit resume |

### Opportunities

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/opportunities` | List opportunities (filterable) |
| GET | `/api/opportunities/new-count` | Count of new since last view |
| POST | `/api/opportunities/refresh` | Trigger manual scrape |
| GET | `/api/opportunities/saved` | Get saved bookmarks |
| POST | `/api/opportunities/saved` | Bookmark an opportunity |
| DELETE | `/api/opportunities/saved/{id}` | Remove bookmark |

### Chat & Notifications

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/chat/message` | Send message to AI mentor |
| GET | `/api/chat/history` | Get conversation history |
| DELETE | `/api/chat/history` | Clear conversation |
| GET | `/api/notifications` | List notifications |
| GET | `/api/notifications/unread/count` | Unread count |
| PATCH | `/api/notifications/{id}/read` | Mark one as read |
| POST | `/api/notifications/read-all` | Mark all as read |

### Dashboard

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/dashboard/summary` | Personalized metrics |

---

## Database Schema

Key tables (managed via Supabase/PostgreSQL):

| Table | Purpose |
|---|---|
| `users` | Profile data, career path, education, country |
| `roadmaps` | Generated career roadmaps |
| `steps` | Phases within a roadmap |
| `tasks` | Individual tasks within steps |
| `evidence` | Uploaded proof files + AI verification results |
| `conversations` | Chat session headers |
| `messages` | Chat message history |
| `memories` | Extracted facts about the user |
| `conversation_summaries` | Summarized old messages |
| `opportunities` | Scraped jobs, events, competitions |
| `saved_opportunities` | User bookmarks |
| `notifications` | System-generated alerts |

---

## Project Structure

```
lynks-backend/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app entry point
│   │   ├── database.py          # Supabase client + SQLAlchemy setup
│   │   ├── auth.py              # JWT auth middleware
│   │   ├── models/              # SQLAlchemy models
│   │   │   ├── user.py
│   │   │   ├── roadmap.py
│   │   │   ├── evidence.py
│   │   │   ├── opportunity.py
│   │   │   ├── notification.py
│   │   │   └── ...
│   │   ├── schemas/             # Pydantic request/response schemas
│   │   ├── routes/              # API route handlers
│   │   │   ├── auth.py
│   │   │   ├── roadmap.py
│   │   │   ├── tasks.py
│   │   │   ├── evidence.py
│   │   │   ├── resume.py
│   │   │   ├── opportunities.py
│   │   │   ├── chat.py
│   │   │   ├── notifications.py
│   │   │   └── dashboard.py
│   │   ├── services/            # Business logic
│   │   │   ├── roadmap/
│   │   │   │   ├── architect.py     # Roadmap generation
│   │   │   │   ├── task_manager.py  # Task completion
│   │   │   │   └── memory.py        # Cross-conversation context
│   │   │   ├── evidence/
│   │   │   │   └── verifier.py      # AI evidence verification
│   │   │   ├── resume/
│   │   │   │   └── builder.py       # Resume generation
│   │   │   ├── opportunities/
│   │   │   │   ├── scraper.py       # Multi-source scraper
│   │   │   │   ├── model_router.py  # Smart LLM model selection
│   │   │   │   └── scheduler.py     # Background refresh cron
│   │   │   └── chat/
│   │   │       ├── mentor.py        # AI chatbot with tools
│   │   │       └── memory_extractor.py
│   │   └── utils/
│   │       ├── llm.py               # LLM client wrapper
│   │       └── currency.py          # Currency detection
│   ├── tests/                   # 288+ unit tests
│   ├── alembic/                 # Database migrations
│   └── requirements.txt
├── frontend/
│   ├── app/                     # Next.js pages
│   │   ├── page.tsx             # Landing page
│   │   ├── onboarding/
│   │   ├── dashboard/
│   │   ├── roadmap/
│   │   ├── opportunities/
│   │   ├── resume/
│   │   ├── portfolio/
│   │   ├── chat/
│   │   └── settings/
│   ├── components/
│   │   ├── ui/                  # shadcn/ui components
│   │   ├── ResumePDF.tsx        # PDF download component
│   │   └── ...
│   └── lib/
│       ├── api.ts               # API client functions
│       ├── supabase.ts          # Supabase client
│       └── auth.ts              # Auth helpers
├── docs/
│   ├── reference/
│   │   ├── API_CONTRACT.md
│   │   ├── TECH_STACK.md
│   │   └── SCHEMA.md
│   └── project/
│       └── PRD.md
├── .github/
│   └── workflows/
│       ├── ci.yml               # Lint + test + security
│       ├── security.yml         # Weekly security audit
│       └── dependabot.yml       # Auto dependency updates
├── BACKEND_VS_FRONTEND_AUDIT.md
├── MISSING_ENDPOINTS.md
└── README.md
```

---

## Testing

```bash
cd backend

# Run all tests
pytest

# Run with coverage
pytest --cov=app --cov-report=term-missing

# Run specific test file
pytest tests/test_roadmap.py -v
```

**288+ tests** covering:
- Unit tests for all models, schemas, and services
- Agent tests (architect, mentor, verifier, router, scraper)
- Integration tests for API endpoints
- Edge case and security tests

---

## CI/CD

Automated via GitHub Actions on every push:

| Workflow | What it does |
|---|---|
| **ci.yml** | Ruff lint → 288+ tests → security scan |
| **security.yml** | Weekly pip-audit + Bandit + Gitleaks |
| **dependabot.yml** | Auto-creates PRs for vulnerable dependencies |

---

## Environment Variables

```env
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# LLM APIs
GROQ_API_KEY=gsk_...
GEMINI_API_KEY=...
MINIMAX_API_KEY=...        # Optional — enables MiniMax fallbacks

# Vision
GEMINI_VISION_MODEL=gemini-2.5-flash-lite

# App
ENVIRONMENT=development
SECRET_KEY=your-secret-key
```

---

## The Team

Built with ❤️ for the Caribbean.

**Lynks** — because everyone deserves to know what steps lead to their goal, and everyone deserves to prove they've done the work.

---

## License

This project is proprietary and confidential. Unauthorized copying, modification, distribution, or use of this software is strictly prohibited.
