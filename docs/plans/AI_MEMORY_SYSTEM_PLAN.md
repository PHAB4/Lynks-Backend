# AI Memory System — Implementation Plan for Lynks Mentor

> **Status:** Plan ready for implementation
> **Date:** August 25, 2026
> **Author:** Jordan (Backend) + Shogo (AI Agent)

---

## Model Info
- **Currently using:** `openai/gpt-oss-120b` (not Groq Llama 3)
- **Context window:** ~128K tokens (much larger than initially assumed)
- **Note:** Token budget constraints are looser with a larger model, but efficient context management is still best practice for cost and quality.

---

## Problem Statement

The Lynks Mentor chatbot currently has:
- **Short-term memory only** — loads last 3 conversations as raw message excerpts
- **No system prompt file** — personality is hardcoded as a Python string in `mentor.py`
- **No long-term memory** — doesn't remember key facts about users between sessions
- **No conversation summarization** — sends full history until it overflows
- **No user profile building** — doesn't learn preferences or extract insights over time

**Goal:** Make the mentor feel like a knowledgeable, persistent career guide that remembers the user's story, adapts its tone, and uses tokens efficiently — like ChatGPT and Claude do.

---

## How ChatGPT & Claude Handle Conversation History (Research Summary)

### The Key Insight: Storage ≠ Context
Both ChatGPT and Claude store ALL messages in their database permanently. But they only send a SUBSET to the LLM on each API call. There are two separate layers:

| Layer | What happens | Where |
|---|---|---|
| **Storage (DB)** | Every single message is saved permanently | PostgreSQL / NoSQL |
| **Context (LLM)** | Only recent messages + summaries sent to the AI | API request payload |

### ChatGPT's Approach
1. Stores every message ever sent in a database
2. Builds a **user profile** over time via system prompt sections:
   - `Model Set Context` — extracted memories with timestamps
   - `Assistant Response Preferences` — how the user likes to receive responses
   - `Notable Past Conversation Topic Highlights` — summaries of past chats
   - `Helpful User Insights` — key facts (name, interests, career)
   - `Recent Conversation Content` — last ~40 conversations with user messages only
   - `User Interaction Metadata` — usage patterns, avg message length, etc.
3. On each API call, sends system prompt + profile + recent conversation content
4. The user CAN scroll through full history — the frontend loads from DB, not LLM context
5. The model only "sees" what fits in the context window

### Claude's Approach
1. Same architecture — store all, send subset
2. When context window fills, older messages get "compacted" (compressed/summarized)
3. Newer feature: auto-summarizes conversations into key insights across chat history
4. Claude Code removes compacted messages from the UI entirely

### Production Patterns (Industry Standard)
After analyzing ChatGPT, Claude, LangChain, Mem0, and MemGPT, the industry converges on **Hybrid Summarization**:

- **Running summary** of older turns (compressed into a paragraph)
- **Last 5-10 turns verbatim** (exact wording matters for follow-ups like "change that to blue")
- **Pinned facts** that never get summarized (name, constraints, preferences)
- Full transcript always in the database for user scrolling

---

## How Conversation History Actually Loads (Clarification)

There are **three different loading events**, each loading different amounts of data:

### Layer 1: App Opens → Sidebar Loads (Instant, ~50ms)

When the user opens the app, the frontend loads a **list of conversation titles and summaries only** — NOT the actual messages. This is like loading folder names, not folder contents.

```
CONVERSATIONS (sidebar) — loads on open
├── "React course advice"           — Aug 24
├── "Resume help"                   — Aug 23  
├── "Career path for web dev"       — Aug 22
└── "Python learning roadmap"       — Aug 21
```

**SQL query (one call, ~1 KB of data):**
```sql
SELECT id, title, summary, created_at 
FROM conversations 
WHERE user_id = 'xxx' 
ORDER BY created_at DESC 
LIMIT 20;
```

This is instant. Even with 100+ conversations, it's just a list of names.

### Layer 2: User Clicks a Conversation → Messages Load (Fast, ~10-50KB)

**Only when the user clicks a conversation** does it load the actual messages for that conversation:

**SQL query:**
```sql
SELECT * FROM messages 
WHERE conversation_id = 'xxx' 
ORDER BY created_at ASC;
```

This is like opening a folder — you only see the contents of the one you picked. The frontend then renders the full scrollable message history for that conversation.

### Layer 3: User Sends a Message → LLM Context Built (Heavy, ~2-5 sec)

When the user sends a message, the backend builds what the AI sees. This is the **token-heavy** part:

```
System Prompt + User Facts + Roadmap Summary + Conversation Summary + Last 10 Messages
```

This gets sent to the LLM API. The user experiences this as "the AI is typing" (~2-5 seconds).

**The user NEVER waits for "loading all conversations." They see a sidebar of titles, click one to open it, and then chat.**

### The Three Layers, Visualized

```
┌─────────────────────────────────────────────────────┐
│  1. APP OPENS          Sidebar loads                │
│     Cost: ~1KB        (titles + dates only)         │
│     Speed: ⚡ instant                                │
├─────────────────────────────────────────────────────┤
│  2. USER CLICKS CHAT   Messages load                │
│     Cost: ~10-50KB    (full text of one chat)       │
│     Speed: ⚡ fast                                   │
├─────────────────────────────────────────────────────┤
│  3. USER SENDS MSG     LLM context built            │
│     Cost: ~4KB tokens (summarized + recent 10)      │
│     Speed: ~2-5 sec   (LLM processing time)         │
└─────────────────────────────────────────────────────┘
```

**ChatGPT works exactly this way.** You have 1000+ conversations in your sidebar, but the app doesn't load all messages until you click on each one. It's just a list of titles.

---

## How Lynks Currently Works

```
mentor.py _load_user_context():
  → loads: profile, active roadmap (steps + tasks), portfolio, last 3 conversation excerpts

mentor.py send_message():
  → builds: [system_prompt + user_context] + [ALL messages in conversation] + [user message]
  → sends to openai/gpt-oss-120b
  → saves ALL messages to DB (this part is correct)

Frontend:
  → Loads messages from DB for display (get_chat_history endpoint)
  → User can scroll through messages in current conversation
  → ❌ BUT: No conversation list sidebar — can only see current chat
```

### What's Working
- ✅ All messages saved to DB (storage layer is correct)
- ✅ Frontend can load and display message history
- ✅ User context includes profile + roadmap + portfolio

### What Needs Fixing
- ❌ System prompt is hardcoded Python string (not editable without code changes)
- ❌ No long-term memory (AI forgets user between sessions)
- ❌ Full conversation history sent to LLM (no summarization)
- ❌ No cross-conversation context (only shows raw message excerpts)
- ❌ Frontend has no conversation list sidebar (only shows current chat)

---

## Plan Overview — Four Phases

### Phase 1: System Prompt Extraction (No LLM Needed)
**Effort:** ~1 hour | **Risk:** Low | **Dependencies:** None

**What:** Move the personality from `mentor.py` into a separate markdown file.

**Files to create/modify:**
- `app/agents/prompts/mentor_system.md` — NEW: the system prompt as readable markdown
- `app/agents/mentor.py` — MODIFY: load prompt from file instead of hardcoded string

**New file structure:**
```markdown
# mentor_system.md

## Identity
You are the Lynks Mentor — a warm, encouraging career guide for young people 
in the Caribbean...

## Personality & Tone
- Speak like a supportive mentor, not a corporate assistant
- Use Caribbean English casually when it fits naturally
- Be encouraging but honest — never oversell
- Use first principles and analogies, not jargon

## Context Usage Rules
- Reference the user's ACTUAL roadmap steps and progress (not generic advice)
- Celebrate completions enthusiastically
- If you don't know something, say so honestly
- Never fabricate opportunities — only reference real ones

## Tool Usage Rules
[existing tool routing rules from current SYSTEM_PROMPT_BASE]

## Response Format
- Keep responses conversational (2-4 paragraphs max)
- Use bullet points for lists of steps or advice
- End with a question or suggested next step to keep engagement

## Memory Integration
- When user facts are provided in context, reference them naturally
- Don't say "I remember you said..." — just use the knowledge seamlessly
- Update your understanding of the user based on what they tell you
```

---

### Phase 2: Long-Term Memory (User Facts)
**Effort:** ~3-4 hours | **Risk:** Medium | **Dependencies:** Phase 1, LLM availability

**What:** After conversations, extract key facts about the user and store them permanently. Load facts into the system prompt on future conversations.

#### 2a. Database Schema Change

Add to `app/models/db_models.py`:

```python
class UserMemory(Base):
    __tablename__ = "user_memories"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=False)
    fact: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str] = mapped_column(Text, nullable=False, default="general")
    # Categories: preference, goal, context, milestone, personality
    source: Mapped[str] = mapped_column(Text, nullable=False, default="conversation")
    # Sources: conversation, profile, manual
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    
    user: Mapped["User"] = relationship(back_populates="memories")
```

Add relationship to User model:
```python
memories: Mapped[list["UserMemory"]] = relationship(back_populates="user")
```

**SQL migration for Supabase:**
```sql
CREATE TABLE user_memories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    fact TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'general',
    source TEXT NOT NULL DEFAULT 'conversation',
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE user_memories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own memories" ON user_memories
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own memories" ON user_memories
  FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Service role can manage memories" ON user_memories
  FOR ALL USING (true);
```

#### 2b. Memory Extraction Logic

Create `app/agents/memory_extractor.py`:

```python
EXTRACTION_PROMPT = """Analyze this conversation and extract key facts about the user 
that would be useful to remember in future career mentoring sessions.

Return a JSON array of facts. Each fact should have:
- "fact": a clear, concise statement (e.g. "Interested in web development, specifically React")
- "category": one of "preference", "goal", "context", "milestone", "personality"

Rules:
- Only extract facts the user explicitly stated or strongly implied
- Don't duplicate facts already in the existing_memories list
- Maximum 5 new facts per conversation
- Don't extract temporary things (mood, "I'm tired today")
- DO extract lasting things (career interests, learning style, completed milestones)

Existing memories (don't duplicate):
{existing_memories}

Conversation:
{conversation}

Return ONLY a JSON array, no other text."""
```

**Trigger:** After every 10 messages in a conversation, run extraction as a background task.

#### 2c. Memory Loading in Context

Modify `_load_user_context()` in `mentor.py`:

```python
# Load long-term memories (~300 tokens)
mem_result = await db.execute(
    select(UserMemory)
    .where(UserMemory.user_id == user_id)
    .order_by(UserMemory.created_at.desc())
    .limit(20)
)
memories = mem_result.scalars().all()

if memories:
    memory_lines = ["\n## Things I Remember About This User"]
    for mem in memories:
        memory_lines.append(f"- [{mem.category}] {mem.fact}")
    sections.append("\n".join(memory_lines))
```

This goes INTO the system prompt, so the AI always knows these facts.

#### 2d. Memory API Endpoints

Add `app/api/routes/memory.py`:
- `GET /memory` — list user's memories
- `DELETE /memory/{id}` — delete a specific memory (user can correct AI)

---

### Phase 3: Conversation History Management (The Core Change)
**Effort:** ~4-5 hours | **Risk:** Medium | **Dependencies:** Phase 1

**This is the definitive approach — how ChatGPT and Claude do it:**

#### 3a. The Two-Layer Architecture

```
DATABASE (permanent storage)          LLM CONTEXT (per-request view)
┌──────────────────────────┐          ┌──────────────────────────────┐
│ All messages ever sent   │          │ System Prompt (~600 tokens)  │
│ All conversations        │   ──▶    │ User Memories (~300 tokens)  │
│ Never deleted            │          │ Conversation Summary (~500)  │
│ User scrolls through this│          │ Recent 10 Messages (~2000)   │
│                          │          │ Current User Message (~200)  │
└──────────────────────────┘          └──────────────────────────────┘
         ▲                                       ▲
         │                                       │
    Frontend loads                         Backend sends to LLM
    from this (all msgs)                  (subset only)
```

**The frontend ALWAYS shows the full history from the database.** The AI only sees the compressed version. Users never lose the ability to scroll back.

#### 3b. Conversation Summarization

When a conversation reaches 15+ messages, summarize the older messages:

```python
async def summarize_conversation(messages: list[dict]) -> str:
    """Summarize older messages into a compact paragraph."""
    SUMMARY_PROMPT = f"""Summarize this conversation segment in 2-3 sentences.
Focus on: what the user asked, what advice was given, what decisions were made.
Be concise but capture key facts, preferences, and constraints.

Conversation:
{_format_messages(messages)}

Summary:"""
    
    response = client.chat.completions.create(
        model=settings.LLM_MODEL,
        messages=[{"role": "user", "content": SUMMARY_PROMPT}],
        temperature=0.3,
        max_tokens=200,
    )
    return response.choices[0].message.content
```

**Storage:** Save the summary in the Conversation model (new `summary` field).

#### 3c. Optimized Context Assembly

```python
async def _load_user_context(db, user_id, conversation_id):
    sections = []
    
    # 1. Profile (~200 tokens) — always included
    sections.append(await _load_profile(db, user_id))
    
    # 2. Long-term memories (~300 tokens) — always included
    sections.append(await _load_memories(db, user_id))
    
    # 3. Active roadmap (~400 tokens) — compressed format
    sections.append(await _load_roadmap_summary(db, user_id))
    
    # 4. Cross-conversation summaries (~300 tokens)
    sections.append(await _load_previous_conversations(db, user_id, limit=3))
    
    # 5. Current conversation summary (if exists, ~500 tokens)
    sections.append(await _load_conversation_summary(db, conversation_id))
    
    return "\n".join(sections)


def _build_messages(system_prompt, user_context, conversation_history, user_message):
    """
    Build the messages array for the LLM.
    
    conversation_history is already the OPTIMIZED version:
    - Summary of older messages
    - Last 10 messages verbatim
    """
    return [
        {"role": "system", "content": system_prompt + f"\n\n---\n\n# Current User Context\n\n{user_context}"},
        *conversation_history,  # summary + recent 10 messages
        {"role": "user", "content": user_message},
    ]
```

#### 3d. Cross-Conversation History

For previous conversations, load a 1-2 sentence summary (not full messages):

```python
async def _load_previous_conversations(db, user_id, limit=3):
    """Load summaries of previous conversations for context."""
    conv_result = await db.execute(
        select(Conversation)
        .where(Conversation.user_id == user_id)
        .order_by(Conversation.created_at.desc())
        .limit(limit)
    )
    conversations = conv_result.scalars().all()
    
    if not conversations:
        return ""
    
    lines = ["\n## Previous Conversations"]
    for conv in conversations:
        if conv.summary:
            lines.append(f"- {conv.summary}")
        else:
            # Fallback: extract first few user messages
            msg_result = await db.execute(
                select(Message)
                .where(Message.conversation_id == conv.id, Message.role == "user")
                .order_by(Message.created_at)
                .limit(3)
            )
            user_msgs = msg_result.scalars().all()
            if user_msgs:
                topics = [m.content[:60] for m in user_msgs]
                lines.append(f"- User discussed: {'; '.join(topics)}")
    
    return "\n".join(lines)
```

#### 3e. Frontend: Conversation List + Full Scrollable History

The frontend needs a conversation list sidebar and the ability to load any past conversation. Here's the flow:

**App opens → Sidebar loads instantly (~50ms):**
```
┌─────────────────────────────────────────┐
│ 💬 Chat with Lynks Mentor              │
├─────────────────────────────────────────┤
│ CONVERSATIONS (sidebar)                 │
│ ├── Today: "React course advice"        │
│ ├── Yesterday: "Discussed career path"  │
│ └── Aug 23: "Resume help"              │
├─────────────────────────────────────────┤
│ MESSAGES (main area)                    │
│ [select a conversation from sidebar]    │
│                                         │
│ [Type a message...]                    │
└─────────────────────────────────────────┘
```

**User clicks a conversation → Messages load (~100ms):**
```
┌─────────────────────────────────────────┐
│ 💬 Chat with Lynks Mentor              │
├─────────────────────────────────────────┤
│ CONVERSATIONS (sidebar)                 │
│ ├── Today: "React course advice" ◄──── active
│ ├── Yesterday: "Discussed career path"  │
│ └── Aug 23: "Resume help"              │
├─────────────────────────────────────────┤
│ MESSAGES (main area)                    │
│ 🤖 Welcome back! Last time we talked   │
│    about React...                       │
│ 👤 Yeah I finished that course!        │
│ 🤖 That's great! Here's what to...     │
│                                         │
│ [Type a message...]                    │
└─────────────────────────────────────────┘
```

**IMPORTANT: This does NOT load all messages for all conversations.**
- The sidebar only loads ~1 KB of titles/dates/summaries
- Messages are only loaded when the user clicks a specific conversation
- Each conversation's messages are a separate, lightweight DB query
- The frontend does lazy-loading: only the active conversation has messages in memory

**The backend already has `get_chat_history()` — we need:**
1. `GET /conversations` — list all conversations with titles/summaries (sidebar)
2. `GET /conversations/{id}` — get messages for a specific conversation
3. Frontend loads conversation list on mount, shows messages when selected
4. When user sends a new message, the current conversation updates in real-time

---

### Phase 4: Context Token Management
**Effort:** ~2 hours | **Risk:** Low | **Dependencies:** Phase 3

With `openai/gpt-oss-120b` (likely 128K context window), token pressure is lower, but efficient management is still important for cost and quality.

#### 4a. Token Estimation
```python
def estimate_tokens(text: str) -> int:
    """Rough token estimate: ~4 chars per token for English."""
    return len(text) // 4
```

#### 4b. Budget Management
```python
# With gpt-oss-120b, we have more room, but still cap for quality
MAX_CONTEXT_TOKENS = 8000  # Leave room for model to think

PRIORITY_ORDER = [
    "system_prompt",         # Highest priority — never drop
    "user_memories",         # High — cross-session context
    "roadmap_summary",       # High — career context
    "recent_messages",       # Medium — current conversation verbatim
    "conversation_summary",  # Medium — older messages
    "cross_conv_summaries",  # Lowest — can be trimmed if needed
]
```

---

## Token Budget Breakdown (with gpt-oss-120b)

```
┌─────────────────────────────────────────────────────┐
│        CONTEXT WINDOW (gpt-oss-120b)                │
│                                                     │
│  System Prompt (mentor_system.md)    ~600 tokens    │
│  User Memories (20 facts)           ~300 tokens    │
│  Roadmap Summary (compressed)       ~400 tokens    │
│  Previous Conv Summaries (3)        ~300 tokens    │
│  Current Conv Summary               ~500 tokens    │
│  Recent Messages (10, verbatim)    ~2,000 tokens    │
│  User Message                       ~200 tokens    │
│                                                     │
│  TOTAL:                           ~4,300 tokens    │
│  Remaining for AI thinking:     ~123,700 tokens    │
│                                                     │
│  Cost savings: ~60% fewer tokens per request        │
│  vs. current approach (sending all messages)        │
└─────────────────────────────────────────────────────┘
```

---

## Implementation Order & Dependencies

```
Phase 1 (no deps)           Phase 2 (needs LLM)          Phase 3 (needs Phase 1)
┌──────────────┐           ┌──────────────────┐         ┌──────────────────────┐
│ Extract       │           │ Create            │         │ Conversation         │
│ system prompt │──────────▶│ user_memories     │         │ summarization        │
│ to .md file   │           │ table             │         │                      │
│               │           │                   │         │ Token budget         │
│ Add tone/     │           │ Build extraction  │         │ management           │
│ rules section │           │ logic + prompt    │         │                      │
│               │           │                   │         │ Cross-conversation   │
│               │           │ Load memories     │         │ context              │
│               │           │ into context      │         │                      │
└──────────────┘           └──────────────────┘         └──────────────────────┘
     ~1 hour                    ~3-4 hours                  ~4-5 hours
```

**Phase 3 can start in parallel with Phase 2** — they're independent. Phase 3 only needs the system prompt file (Phase 1) to exist.

---

## Document Change Tracker

### Changes to PRD (docs/PRD.md)

| Section | Change | Reason |
|---------|--------|--------|
| Feature: AI Mentor | Add "Long-term Memory" subsection | New capability — AI remembers user facts across sessions |
| Feature: AI Mentor | Add "Conversation History" subsection | Users can view all past conversations, not just current |
| Feature: AI Mentor | Update "Chat Interface" description | Now shows conversation list sidebar + full scrollable history |
| Feature: AI Mentor | Add "Memory Management" feature | Users can view/delete what the AI remembers about them |
| Technical Requirements | Add `user_memories` table to schema | New table for persistent user facts |
| Technical Requirements | Update context management description | Summarization-based instead of raw history |
| API Endpoints | Add `GET /memory`, `DELETE /memory/{id}` | New endpoints for memory management |
| API Endpoints | Add `GET /conversations` (list), update `GET /chat/history` | Conversation list + individual conversation loading |
| Non-Functional Requirements | Add token efficiency metrics | Target: <5,000 tokens per request for context |

### Changes to Schema (docs/SCHEMA.md + Supabase)

| Table/Field | Change | SQL |
|-------------|--------|-----|
| `conversations` | ADD `summary` column | `ALTER TABLE conversations ADD COLUMN summary TEXT;` |
| `user_memories` | CREATE new table | See SQL in Phase 2a |
| `user_memories` | ADD RLS policies | See SQL in Phase 2a |
| `users` | ADD relationship to `user_memories` | Handled by ORM migration |
| `conversations` | ADD relationship (via existing FK) | Already exists |

### Changes to API Contract (docs/API_CONTRACT.md)

| Endpoint | Change | Details |
|----------|--------|---------|
| `POST /chat/message` | MODIFY response | Add `summary_updated: true/false` field |
| `GET /chat/history` | MODIFY response | Support `?conversation_id=` param for specific conversation |
| `GET /conversations` | **NEW** | List all user conversations with title, summary, timestamp, message count |
| `GET /conversations/{id}` | **NEW** | Get all messages for a specific conversation |
| `GET /memory` | **NEW** | List all user memories (facts the AI remembers) |
| `POST /memory` | **NEW** | Manually add a memory (e.g. from onboarding) |
| `DELETE /memory/{id}` | **NEW** | Delete a specific memory |
| `PATCH /memory/{id}` | **NEW** | Edit a specific memory |

### Changes to Tech Stack Doc (docs/TECH_STACK.md)

| Section | Change |
|---------|--------|
| LLM Configuration | Update model name: `openai/gpt-oss-120b` |
| Context Management | Add section on summarization strategy |
| Memory Architecture | Add section on long-term memory system |
| API Endpoints | Update endpoint count and descriptions |

---

## Files to Create/Modify

| File | Action | Phase |
|------|--------|-------|
| `app/agents/prompts/mentor_system.md` | **CREATE** | 1 |
| `app/agents/mentor.py` | **MODIFY** — load prompt from file, add memory loading, add summarization | 1, 2, 3 |
| `app/agents/memory_extractor.py` | **CREATE** | 2 |
| `app/models/db_models.py` | **MODIFY** — add UserMemory model, add summary to Conversation | 2, 3 |
| `app/models/schemas.py` | **MODIFY** — add MemoryResponse, ConversationListResponse | 2, 3 |
| `app/api/routes/memory.py` | **CREATE** — GET/POST/DELETE/PATCH user memories | 2 |
| `app/api/routes/chat.py` | **MODIFY** — add conversation listing, update history loading | 3 |
| `docs/PRD.md` | **MODIFY** — add memory and conversation features | All |
| `docs/SCHEMA.md` | **MODIFY** — add user_memories table, conversations.summary | All |
| `docs/API_CONTRACT.md` | **MODIFY** — add new endpoints, update existing ones | All |
| `docs/TECH_STACK.md` | **MODIFY** — update model info, add memory/context sections | All |
| SQL migration file | **CREATE** — for Supabase dashboard | 2, 3 |

---

## Testing Strategy

| Test | What it validates |
|------|-------------------|
| `test_system_prompt_loading` | Prompt loads from .md file correctly |
| `test_memory_extraction` | LLM returns valid JSON array of facts |
| `test_memory_loading_in_context` | Memories appear in user context string |
| `test_conversation_summarization` | Long conversation gets summarized |
| `test_token_budget_stays_under_limit` | Context never exceeds target token count |
| `test_memory_deduplication` | Same fact isn't saved twice |
| `test_mentor_with_memories` | Full chat flow with memories loaded |
| `test_conversation_list_endpoint` | GET /conversations returns all conversations |
| `test_conversation_messages_endpoint` | GET /conversations/{id} returns correct messages |
| `test_conversation_history_scrolling` | Frontend can load messages for any conversation |
| `test_summary_stored_in_db` | Conversation summary persists after generation |
| `test_cross_conversation_context` | AI references previous conversation topics |

---

## Open Questions

1. **When to trigger extraction?** Every 10 messages (recommended) — balances quality vs. cost
2. **Memory limit per user?** 30 facts max, oldest auto-pruned when exceeded
3. **Should the user see their memories?** Yes — add `/memory` endpoint for transparency
4. **Should memories be editable?** Yes — users can delete incorrect facts
5. **Conversation auto-title?** Use first user message or LLM-generated title for conversation list
6. **Summary storage location?** New `summary` column on `conversations` table

---

## Notes

- Phase 1 can be built immediately (no LLM needed)
- Phase 2 and 3 can be built in parallel (independent work)
- All new Supabase tables need RLS policies (see SQL above)
- The system prompt file (Phase 1) is the foundation for all other phases
- With `gpt-oss-120b`, the context window is generous — but efficient management is still best practice for cost and response quality
- Full message history is NEVER deleted from the database — only the LLM's per-request view is compressed
- The frontend lazy-loads: sidebar titles on open, messages only when clicked
