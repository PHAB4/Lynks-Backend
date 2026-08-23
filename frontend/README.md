# Lynks Frontend

## Setup

```bash
cd frontend
npx create-next-app@latest . --typescript --tailwind --eslint
npm install
npm run dev
```

## Environment Variables

Create `.env.local` in this directory:

```env
NEXT_PUBLIC_API_URL=https://lynks-backend-production.up.railway.app
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_KEY
```

## Backend API

The backend runs at `https://lynks-backend-production.up.railway.app` (production) or `http://localhost:8000` (local). Key endpoints:

| Method | Endpoint | What it does |
|--------|----------|-------------|
| POST | `/auth/v1/signup` | Create account |
| POST | `/auth/v1/token?grant_type=password` | Log in |
| GET | `/profile` | Get user profile |
| POST | `/roadmap/generate` | Generate career roadmap |
| GET | `/roadmap` | Get active roadmap |
| POST | `/roadmap/regenerate` | Generate new roadmap |
| POST | `/tasks/{task_id}/evidence` | Upload evidence |
| GET | `/portfolio` | Get verified portfolio |
| GET | `/opportunities` | Browse opportunities |
| GET | `/opportunities?mode=relevant` | Get relevant opportunities |
| POST | `/chat/message` | Send message to Mentor |
| GET | `/chat/history` | Get chat history |
| DELETE | `/chat/history` | Clear chat history |

Full request/response shapes are in `docs/API_CONTRACT.md`.

## Folder Structure

```
frontend/
├── app/
│   ├── page.tsx                    ← landing page
│   ├── login/page.tsx              ← login
│   ├── onboarding/page.tsx         ← onboarding (3 steps)
│   ├── dashboard/page.tsx          ← main dashboard
│   ├── roadmap/page.tsx            ← career roadmap
│   ├── opportunities/page.tsx      ← career opportunities
│   ├── portfolio/page.tsx          ← verified portfolio
│   └── chat/page.tsx               ← mentor chatbot
├── components/
│   ├── ChatWidget.tsx              ← chatbot UI
│   ├── OpportunityCard.tsx         ← opportunity card with "Ask About This"
│   ├── RoadmapTimeline.tsx         ← roadmap visualization
│   └── ...
└── ...
```

## Rules

- Work **only** in this `frontend/` folder
- Do **not** edit anything in `backend/` or `docs/`
- Call the API via `fetch()` using `NEXT_PUBLIC_API_URL`
- Use shadcn/ui components and Tailwind CSS
- Use `lucide-react` for icons
