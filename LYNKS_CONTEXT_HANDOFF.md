# Lynks Backend — Context Handoff Document

> **Last updated:** August 22, 2026
> **Status:** ✅ ALL 18 TESTS PASSING
> **Repo:** https://github.com/PHAB4/Lynks-Backend

---

## What Is Lynks?

Lynks is a Caribbean-focused career guidance platform for young people. It pairs users with a supportive AI Mentor and generates personalized career roadmaps, discovers opportunities (scholarships, jobs, competitions), and builds portfolios.

---

## Tech Stack

| Component | Technology |
|-----------|------------|
| Backend framework | FastAPI (Python) |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth (JWT tokens) |
| File storage | Supabase Storage (evidence uploads) |
| AI/LLM | Groq (via OpenAI SDK, OpenAI-compatible endpoint) |
| ORM | SQLAlchemy (async) |
| Database driver | asyncpg |

---

## What's Built and Working (18/18 Tests Passing)

### Agents (4)
| Agent | File | What it does |
|-------|------|-------------|
| Career Architect | `app/agents/architect.py` | Generates personalized roadmaps from user profiles using LLM |
| Mentor (Orchestrator) | `app/agents/mentor.py` | Chat interface — has access to all other agents, routes requests |
| Opportunity Scout | `app/agents/opportunity_scraper.py` | Curated list of Caribbean opportunities |
| Portfolio Manager | `app/agents/portfolio_manager.py` | Handles evidence uploads to Supabase Storage |

### API Endpoints (All Working)
| Method | Endpoint | What it does |
|--------|----------|-------------|
| GET | `/health` | Server health check |
| GET | `/profile` | Get current user's profile |
| PATCH | `/profile` | Update profile fields |
| PATCH | `/profile/career-path` | Update career path only |
| POST | `/roadmap/generate` | Generate a new career roadmap via LLM |
| GET | `/roadmap` | Get the user's active roadmap |
| POST | `/roadmap/regenerate` | Deactivate old roadmap, generate new one |
| POST | `/tasks/{task_id}/evidence` | Upload evidence file |
| GET | `/portfolio` | Get all tasks with evidence |
| GET | `/opportunities` | Get all Caribbean opportunities |
| GET | `/opportunities?category=X` | Filter by category |
| POST | `/chat/message` | Send message to Mentor agent |
| GET | `/chat/history` | Get conversation history |
| DELETE | `/chat/history` | Delete all chat history |

### Database Tables
| Table | Purpose |
|-------|---------|
| `users` | User profiles |
| `roadmaps` | Career roadmaps |
| `steps` | Roadmap steps/milestones |
| `tasks` | Tasks within steps |
| `evidence` | Uploaded evidence files |
| `resumes` | Generated resumes |
| `conversations` | Chat conversations |
| `messages` | Chat messages |

---

## What Went Wrong — Full Debugging Timeline

### Phase 1: Connection Issues
| # | Error | Root Cause | Fix |
|---|-------|-----------|-----|
| 1 | `getaddrinfo failed` | Wrong DATABASE_URL | Changed to pooler URL |
| 2 | `WinError 121` | Restaurant WiFi blocking port 5432 | Moved to home network |
| 3 | Supabase project paused | Free tier inactivity | Restored project |

### Phase 2: Schema Mismatches
| # | Error | Root Cause | Fix |
|---|-------|-----------|-----|
| 4 | `column id is of type uuid` | ORM used Text for UUID columns | Changed to UUID(as_uuid=False) |
| 5 | RLS blocking queries | No RLS policies | Created RLS policies |
| 6 | `Invalid or expired token` | JWT expires after 1 hour | Auto-create fresh user per test |
| 7 | Duplicate username | Same user created twice | Unique timestamped emails |
| 8 | `record new has no field email` | Trigger schema mismatch | Fixed handle_new_user function |

### Phase 3: Unique Constraints (BIGGEST ISSUE)

⚠️ Constraint names with mixed case need **double quotes** in SQL!

| # | Table | Constraint | Fix |
|---|-------|-----------|-----|
| 9 | messages | `"Messages_conversation_id_key"` | DROP CONSTRAINT with double quotes |
| 10 | roadmaps | `"Roadmaps_user_id_key"` | DROP CONSTRAINT with double quotes |
| 11 | steps | `"Steps_roadmap_id_key"` | DROP CONSTRAINT with double quotes |
| 12 | tasks | `"Tasks_step_id_key"` | DROP CONSTRAINT with double quotes |

### Phase 4: Missing Columns
| # | Table | Column | Fix |
|---|-------|--------|-----|
| 13 | roadmaps | `career_path` | ADD COLUMN |
| 14 | tasks | `order` | ADD COLUMN |

### Phase 5: ORM/Code Issues
| # | Error | Fix |
|---|-------|-----|
| 15 | `employment_status` reference | Removed from architect.py |
| 16 | Lazy loading after COMMIT | Added db.refresh() calls |
| 17 | DELETE /chat/history crashes | Added passive_deletes=True |
| 18 | Profile route not registered | Uncommented in main.py |
| 19 | Profile route wrong imports | Fixed imports, added prefix |

### Phase 6: Storage & Evidence
| # | Error | Fix |
|---|-------|-----|
| 20 | Storage RLS blocking uploads | Created public bucket with policies |
| 21 | `uploaded_at` NULL | Added DEFAULT now() |

### Phase 7: CASCADE Delete
| # | Error | Fix |
|---|-------|-----|
| 22 | DELETE fails on messages | ON DELETE CASCADE + passive_deletes |

---

## Environment Variables (.env)

```
SUPABASE_URL=https://qcyxyunngbkupttcwlbk.supabase.co
SUPABASE_ANON_KEY=<your anon key>
SUPABASE_SERVICE_ROLE_KEY=<your service role key>
DATABASE_URL=postgresql+asyncpg://postgres.<ref>:<password>@aws-0-us-west-2.pooler.supabase.com:5432/postgres
LLM_API_KEY=<your Groq API key>
LLM_API_BASE_URL=https://api.groq.com/openai/v1
LLM_MODEL=llama3-8b-8192
BACKEND_URL=http://localhost:8000
```

⚠️ DATABASE_URL must use pooler connection (port 5432), NOT direct connection.

---

## How to Run

```bash
git clone https://github.com/PHAB4/Lynks-Backend.git
cd Lynks-Backend/backend
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
# Set up .env
uvicorn app.main:app --reload --port 8000
# In second terminal:
python tests/test_endpoints.py
```

---

## What Needs To Be Built Next

### Immediate
1. Frontend — backend is ready, API contract in docs/API_CONTRACT.md
2. Resume Builder — table exists, no endpoint/agent yet
3. Evidence verification — currently always "pending"

### Feature Enhancements
4. Mentor improvements — roadmap context, task completion from chat, conversation memory
5. Real opportunity scraping — replace hardcoded list with live data
6. Roadmap improvements — dynamic adjustment, timeframes, custom tasks
7. Portfolio improvements — AI verification, resume generation, PDF export
8. Notification system

---

## Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| Expired token | Run create_test_user.py |
| Server won't start | Check .env variables |
| DB connection timeout | Use pooler URL, check firewall |
| Roadmap 500 | Check server terminal for missing column |
| Evidence 403 | Check storage bucket exists and is public |
| Constraint error | Check: SELECT conname FROM pg_constraint WHERE conrelid = 'public.X'::regclass AND contype = 'u'; |
