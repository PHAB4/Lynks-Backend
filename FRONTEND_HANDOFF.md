# Lynks — Frontend Developer Handoff

> **Last updated:** August 22, 2026
> **Backend status:** ✅ All 18 API endpoints tested and working
> **Backend repo:** https://github.com/PHAB4/Lynks-Backend

---

## What You Need to Know

The backend is a **FastAPI server** that runs at `http://localhost:8000`. Your frontend will make HTTP requests to it. The backend handles all business logic, database access, and AI — your job is to build the user interface that calls these endpoints.

---

## Authentication (Supabase Auth)

**How it works:** Users sign up and sign in through Supabase Auth. The backend never handles passwords — it only verifies JWT tokens.

**What you need to do:**
1. Install `@supabase/supabase-js` in your frontend
2. Initialize Supabase client:
   ```js
   import { createClient } from '@supabase/supabase-js'
   const supabase = createClient(
     'https://qcyxyunngbkupttcwlbk.supabase.co',
     '<anon key>'
   )
   ```
3. Use Supabase Auth for sign up / sign in:
   ```js
   const { data, error } = await supabase.auth.signUp({ email, password })
   const { data, error } = await supabase.auth.signInWithPassword({ email, password })
   ```
4. Get the JWT token:
   ```js
   const { data: { session } } = await supabase.auth.getSession()
   const token = session.access_token
   ```
5. **Pass this token on EVERY request:**
   ```js
   fetch('http://localhost:8000/profile', {
     headers: { 'Authorization': `Bearer ${token}` }
   })
   ```

---

## API Endpoints

### Base URL: `http://localhost:8000`

### Profile
| Method | Endpoint | Body | Returns |
|--------|----------|------|---------|
| GET | `/profile` | — | Full user profile |
| PATCH | `/profile` | `{ name, age, country, education_level, interests }` | Updated profile |
| PATCH | `/profile/career-path` | `{ career_path }` | `{ career_path }` |

### Roadmap
| Method | Endpoint | Notes |
|--------|----------|-------|
| POST | `/roadmap/generate` | ⚠️ Takes 5-15s (LLM call) |
| GET | `/roadmap` | Returns active roadmap with steps + tasks |
| POST | `/roadmap/regenerate` | Deactivates old, generates new |

### Evidence
| Method | Endpoint | Body | Notes |
|--------|----------|------|-------|
| POST | `/tasks/{task_id}/evidence` | multipart/form-data (file) | Uploads to Supabase Storage |

### Portfolio
| Method | Endpoint | Returns |
|--------|----------|---------|
| GET | `/portfolio` | Tasks with their evidence |

### Opportunities
| Method | Endpoint | Notes |
|--------|----------|-------|
| GET | `/opportunities` | All opportunities (12 items) |
| GET | `/opportunities?category=X` | Filter: scholarship, job, competition, event, club, volunteer |

### Chat
| Method | Endpoint | Notes |
|--------|----------|-------|
| POST | `/chat/message` | ⚠️ Takes 5-15s (LLM call). Body: `{ message, conversation_id? }` |
| GET | `/chat/history?conversation_id=X` | Returns messages array |
| DELETE | `/chat/history` | Deletes all user chat history |

### Health
| Method | Endpoint | No auth needed |
|--------|----------|---------------|
| GET | `/health` | `{ "status": "ok" }` |

---

## Pages to Build

| Page | Route | Endpoints Used |
|------|-------|---------------|
| Sign Up / Sign In | `/auth` | Supabase Auth SDK |
| Onboarding (3-step wizard) | `/onboarding` | PATCH /profile, PATCH /profile/career-path |
| Dashboard | `/dashboard` | GET /roadmap, GET /portfolio |
| Roadmap | `/roadmap` | GET /roadmap, POST /roadmap/regenerate |
| Chat (Mentor) | `/chat` | POST /chat/message, GET /chat/history |
| Portfolio | `/portfolio` | GET /portfolio, POST /tasks/{id}/evidence |
| Opportunities | `/opportunities` | GET /opportunities |
| Profile / Settings | `/profile` | GET /profile, PATCH /profile |

---

## Error Handling

All errors: `{ "detail": { "error": { "code": "...", "message": "..." } } }`

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created (roadmap, evidence) |
| 400 | Bad request |
| 401 | Unauthorized (bad/expired token) |
| 404 | Not found |
| 500 | Server error |

---

## Key Considerations

1. **Roadmap and chat are slow** (5-15s) — always show loading states
2. **Mentor is Caribbean-aware** — references local context naturally
3. **"Ask About This" button** — pre-fill chat input with opportunity context, navigate to /chat
4. **Evidence uploads** — multipart/form-data, not JSON
5. **Opportunities are static** — curated list, not live scraping
6. **Backend URL** — update from localhost:8000 when deploying
