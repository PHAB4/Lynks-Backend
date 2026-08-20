# Understanding the Lynks Tech Stack

See `tech_stack_explained.md` for the full beginner-friendly guide.

## Quick Reference

| Component | Purpose |
|---|---|
| Python | Backend language |
| FastAPI | API framework (the "waiter") |
| LangChain / CrewAI | Agent orchestration library |
| Llama 3 70B | Main LLM (roadmap generation, chat) |
| Llama 3 Vision | Image analysis (evidence verification) |
| HuggingFace BGE | Text-to-vector embeddings |
| Qdrant / Milvus | Vector database (semantic search) |
| PostgreSQL (Supabase) | Relational database (users, tasks, roadmaps) |
| Next.js + Tailwind | Frontend framework |
| BeautifulSoup | Web scraping (Job Scout) |
| H200 GPUs (Highrise/Impala) | GPU compute for LLM inference |
| OpenAI SDK | LLM client (talks to any OpenAI-compatible API) |

## Key Principles

1. Frontend never talks to database or AI directly — always through FastAPI
2. All IDs are UUIDs, all field names are snake_case
3. Supabase handles auth (signup, login, logout) — backend only verifies JWTs
4. Agents use OpenAI SDK tool-calling format — provider-agnostic
5. Evidence files stored in object storage, not on local disk
