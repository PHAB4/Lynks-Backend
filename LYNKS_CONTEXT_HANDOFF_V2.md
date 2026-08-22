# Lynks Backend — Full Context Handoff (v2)

> **Created:** August 22, 2026
> **Status:** 18/18 tests passing, 4 enhancements built
> **Repo:** https://github.com/PHAB4/Lynks-Backend

---

## What We Built

Lynks is a Caribbean career guidance platform. Backend is FastAPI + SQLAlchemy async + Supabase (PostgreSQL/Auth/Storage) + Groq LLM (Llama 3 8B).

### Working Endpoints (18/18 tests pass)
| Endpoint | Status | Notes |
|----------|--------|-------|
| GET /health | DONE | |
| GET/PATCH /profile | DONE | |
| PATCH /profile/career-path | DONE | |
| POST /roadmap/generate | DONE | LLM generates 4-8 steps |
| GET /roadmap | DONE | |
| POST /roadmap/regenerate | DONE | |
| POST /tasks/{id}/evidence | DONE | Uploads to Supabase Storage |
| GET /portfolio | DONE | |
| GET /opportunities | DONE | 30+ curated Caribbean opportunities |
| POST /chat/message | DONE | Mentor with full context |
| GET /chat/history | DONE | |
| DELETE /chat/history | DONE | |
| POST /resume/generate | NEW | LLM generates structured resume |
| GET /resume | NEW | Returns latest resume |

### Enhanced Features
1. Mentor with full context (roadmap, progress, portfolio, memory, task completion tool)
2. 30+ Caribbean opportunities across 6 categories
3. Resume builder from profile + portfolio + roadmap
4. Conversation memory (last 3 conversations)

### Database (9 tables in Supabase)
users, roadmaps, steps, tasks, evidence, resumes, conversations, messages, opportunities

### SQL Fixes Applied
- Dropped 4 unique constraints (case-sensitive names need double quotes)
- Added cascade delete on messages
- Added career_path to roadmaps, order to tasks
- Created public evidence storage bucket
- Added RLS policies on evidence

### Key Files
backend/app/agents/mentor.py, architect.py, scout.py, portfolio_manager.py
backend/app/api/routes/profile.py, roadmap.py, chat.py, portfolio.py, opportunities.py, resume.py
backend/app/main.py, models/db_models.py, core/security.py, db/postgres.py

### How to Run
git pull origin main && cd backend && pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
python tests/test_endpoints.py

### Documents
FRONTEND_HANDOFF.md, LYNKS_CONTEXT_HANDOFF.md, docs/SCHEMA.md, docs/API_CONTRACT.md, docs/TECH_STACK.md, docs/PRD.md

### Still Needs Work
1. Frontend (FRONTEND_HANDOFF.md has complete guide)
2. Opportunity scraping (upgrade to RSS feeds)
3. Conversation memory (use summarization)
4. Evidence verification (AI-powered)
5. Resume RLS policies
6. Notifications system
