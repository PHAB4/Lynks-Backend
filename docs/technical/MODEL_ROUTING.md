# Auto Model Switching & Context Transfer — Technical Plan

**Date:** 2026-09-06
**Author:** QA/Backend Analysis
**Status:** Proposal — Pending Review

---

## 1. Problem Statement

The Lynks chat currently uses a **single LLM** (`openai/gpt-oss-120b` via Groq) for all interactions. This creates several problems:

| Problem | Impact |
|---------|--------|
| **Rate limiting** | Groq free tier limits requests per minute. When hit, users see raw `RateLimitError` — chat is completely broken |
| **No fallback** | If Groq is down or rate-limited, there's no alternative — the user gets a 502 error |
| **Cost inefficiency** | Simple greetings and routing decisions use the same expensive model as complex career advice |
| **No capability routing** | Vision tasks (evidence verification) already use Gemini, but text tasks don't benefit from model diversity |
| **Context loss on switch** | If we do switch models mid-conversation, there's no mechanism to transfer conversation context |

### Current Architecture

```
Frontend (chat/page.tsx)
  └─ POST /api/chat/message
       └─ mentor.py send_message()
            └─ OpenAI(api_key=..., base_url=Groq)
                 └─ client.chat.completions.create(model="openai/gpt-oss-120b")
```

**Key observations from the codebase:**
- `mentor.py` creates a new `OpenAI` client on every request (line ~580)
- The client is configured with `settings.LLM_API_KEY` and `settings.LLM_API_BASE_URL` (Groq)
- `settings.LLM_MODEL` is a single string — no list, no fallback
- Context is rebuilt from scratch each request (profile, memories, roadmap, conversation history)
- The `_load_user_context()` function already has token budget management (8K limit)

---

## 2. Proposed Solution: Model Router

### 2.1 Architecture Overview

```
                        ┌─────────────────────────┐
                        │      Model Router        │
                        │   (new: model_router.py) │
                        └─────────┬───────────────┘
                                  │
              ┌───────────────────┼───────────────────┐
              │                   │                   │
        ┌─────▼─────┐      ┌─────▼─────┐      ┌─────▼─────┐
        │   Groq     │      │  OpenAI   │      │  Gemini   │
        │  (primary) │      │ (fallback)│      │  (vision) │
        └───────────┘      └───────────┘      └───────────┘
```

### 2.2 Model Registry

Define available models in config with capabilities, rate limits, and priorities:

```python
# app/core/config.py — add to Settings

# Model routing
MODEL_ROUTER_ENABLED: bool = True

# Primary models (text) — tried in priority order
LLM_MODELS: str = '[
    {
        "name": "groq-120b",
        "provider": "groq",
        "model": "openai/gpt-oss-120b",
        "base_url": "https://api.groq.com/openai/v1",
        "api_key_env": "GROQ_API_KEY",
        "priority": 1,
        "max_rpm": 30,
        "max_rpd": 14400,
        "supports_tools": true,
        "supports_vision": false,
        "cost_per_1k_tokens": 0.00009
    },
    {
        "name": "groq-70b",
        "provider": "groq",
        "model": "llama-3.3-70b-versatile",
        "base_url": "https://api.groq.com/openai/v1",
        "api_key_env": "GROQ_API_KEY",
        "priority": 2,
        "max_rpm": 30,
        "max_rpd": 14400,
        "supports_tools": true,
        "supports_vision": false,
        "cost_per_1k_tokens": 0.000059
    },
    {
        "name": "openai-gpt4o-mini",
        "provider": "openai",
        "model": "gpt-4o-mini",
        "base_url": "https://api.openai.com/v1",
        "api_key_env": "OPENAI_API_KEY",
        "priority": 3,
        "max_rpm": 500,
        "max_rpd": 50000,
        "supports_tools": true,
        "supports_vision": true,
        "cost_per_1k_tokens": 0.00015
    }
]'
```

### 2.3 Rate Limit Tracker

Track usage per model per minute/day using an in-memory counter (resets on restart, which is fine for rate limits):

```python
# app/services/model_router.py

import time
import logging
from dataclasses import dataclass, field
from typing import Optional

logger = logging.getLogger(__name__)


@dataclass
class RateLimitTracker:
    """In-memory sliding window rate limit tracker."""
    minute_timestamps: list[float] = field(default_factory=list)
    day_count: int = 0
    day_start: float = field(default_factory=time.time)

    def can_use(self, max_rpm: int, max_rpd: int) -> bool:
        now = time.time()

        # Clean minute window (sliding 60s)
        self.minute_timestamps = [t for t in self.minute_timestamps if now - t < 60]

        # Reset day counter if it's a new day
        if now - self.day_start > 86400:
            self.day_count = 0
            self.day_start = now

        return len(self.minute_timestamps) < max_rpm and self.day_count < max_rpd

    def record_usage(self):
        now = time.time()
        self.minute_timestamps.append(now)
        self.day_count += 1


# Global tracker — one per model name
_trackers: dict[str, RateLimitTracker] = {}


def get_tracker(model_name: str) -> RateLimitTracker:
    if model_name not in _trackers:
        _trackers[model_name] = RateLimitTracker()
    return _trackers[model_name]
```

### 2.4 Model Router Core

```python
# app/services/model_router.py

import json
import os
from dataclasses import dataclass
from typing import Optional

from openai import OpenAI

from app.core.config import settings


@dataclass
class ModelConfig:
    name: str
    provider: str
    model: str
    base_url: str
    api_key: str
    priority: int
    max_rpm: int
    max_rpd: int
    supports_tools: bool
    supports_vision: bool
    cost_per_1k_tokens: float


def _load_models() -> list[ModelConfig]:
    """Parse LLM_MODELS JSON from settings into ModelConfig objects."""
    raw = json.loads(settings.LLM_MODELS)
    models = []
    for entry in raw:
        api_key = os.environ.get(entry["api_key_env"], "")
        if not api_key:
            logger.warning("Skipping model %s — no API key for %s", entry["name"], entry["api_key_env"])
            continue
        models.append(ModelConfig(
            name=entry["name"],
            provider=entry["provider"],
            model=entry["model"],
            base_url=entry["base_url"],
            api_key=api_key,
            priority=entry["priority"],
            max_rpm=entry["max_rpm"],
            max_rpd=entry["max_rpd"],
            supports_tools=entry.get("supports_tools", False),
            supports_vision=entry.get("supports_vision", False),
            cost_per_1k_tokens=entry.get("cost_per_1k_tokens", 0.0),
        ))
    return sorted(models, key=lambda m: m.priority)


_models: list[ModelConfig] | None = None


def get_models() -> list[ModelConfig]:
    global _models
    if _models is None:
        _models = _load_models()
    return _models


def select_model(require_tools: bool = True) -> Optional[ModelConfig]:
    """
    Select the best available model based on:
    1. Rate limits (skip models that are throttled)
    2. Capability requirements (tools, vision)
    3. Priority (prefer primary, fall back to cheaper alternatives)
    """
    for model in get_models():
        if require_tools and not model.supports_tools:
            continue

        tracker = get_tracker(model.name)
        if tracker.can_use(model.max_rpm, model.max_rpd):
            return model

    return None  # All models exhausted


def get_client(require_tools: bool = True) -> tuple[OpenAI, ModelConfig]:
    """
    Get an OpenAI-compatible client for the best available model.
    Raises RuntimeError if no model is available.
    """
    model = select_model(require_tools=require_tools)
    if model is None:
        raise RuntimeError(
            "All LLM models are currently rate-limited or unavailable. "
            "Please try again in a minute."
        )

    tracker = get_tracker(model.name)
    tracker.record_usage()

    client = OpenAI(api_key=model.api_key, base_url=model.base_url)
    return client, model
```

---

## 3. Context Transfer Strategy

### 3.1 The Challenge

When switching between models mid-conversation:
- Different models may have different **context windows** (8K vs 128K)
- Different models may interpret **system prompts** differently
- **Tool call formats** may differ slightly between providers
- **Token counts** differ per model

### 3.2 Solution: Model-Agnostic Context Format

The key insight: **context transfer is already mostly handled** because:
1. User context is rebuilt from the database every request (profile, memories, roadmap)
2. Conversation history is stored as plain text in the DB (not model-specific)
3. The system prompt is a markdown template, not model-specific

What we need to add:

```python
# Context adaptation per model

@dataclass
class ContextAdapter:
    """Adapts context to fit a specific model's constraints."""

    @staticmethod
    def adapt_messages(
        messages: list[dict],
        model: ModelConfig,
        max_context_tokens: int = 8000,
    ) -> list[dict]:
        """
        Adapt message list to fit within model's context window.
        Different models have different token limits.
        """
        # Estimate total tokens
        total = sum(estimate_tokens(m.get("content", "")) for m in messages)

        if total <= max_context_tokens:
            return messages

        # Strategy: keep system prompt + last N messages
        # Drop middle messages, keeping a summary marker
        system_msg = messages[0] if messages[0]["role"] == "system" else None
        user_msgs = [m for m in messages if m["role"] != "system"]

        # Keep system + last 10 messages
        keep_count = min(10, len(user_msgs))
        kept = user_msgs[-keep_count:]
        dropped = len(user_msgs) - keep_count

        adapted = []
        if system_msg:
            adapted.append(system_msg)

        if dropped > 0:
            adapted.append({
                "role": "system",
                "content": f"[{dropped} earlier messages omitted to fit context window]"
            })

        adapted.extend(kept)
        return adapted

    @staticmethod
    def adapt_tools(tools: list[dict], model: ModelConfig) -> list[dict]:
        """
        Adapt tool definitions for model capabilities.
        Some models don't support function calling — convert to text instructions.
        """
        if model.supports_tools:
            return tools

        # Convert tools to text instructions for non-tool models
        tool_descriptions = []
        for tool in tools:
            func = tool.get("function", {})
            tool_descriptions.append(
                f"- {func['name']}: {func.get('description', '')}"
            )

        return [{
            "type": "text",
            "content": (
                "You have access to these tools (respond with JSON to call them):\n"
                + "\n".join(tool_descriptions)
            )
        }]
```

### 3.3 Seamless Model Switching

The router should be **transparent** — the caller doesn't know which model is used:

```python
async def call_llm(
    messages: list[dict],
    tools: list[dict] | None = None,
    require_tools: bool = True,
    temperature: float = 0.7,
    max_tokens: int = 2048,
) -> tuple[str, str, dict | None]:
    """
    Call the LLM with automatic model selection and fallback.

    Returns:
        (response_text, model_name_used, tool_calls_or_none)
    """
    last_error = None

    for attempt in range(3):  # Try up to 3 different models
        try:
            client, model = get_client(require_tools=require_tools)

            # Adapt context for this model
            adapter = ContextAdapter()
            adapted_messages = adapter.adapt_messages(messages, model)

            kwargs = {
                "model": model.model,
                "messages": _sanitize_messages(adapted_messages),
                "temperature": temperature,
                "max_tokens": max_tokens,
            }

            if tools and model.supports_tools:
                kwargs["tools"] = tools
                kwargs["tool_choice"] = "auto"

            response = client.chat.completions.create(**kwargs)

            choice = response.choices[0]
            tool_calls = None

            if choice.finish_reason == "tool_calls" and choice.message.tool_calls:
                tool_calls = choice.message.tool_calls

            return choice.message.content or "", model.name, tool_calls

        except OpenAIError as e:
            last_error = e
            error_str = str(e).lower()

            # If rate limited, mark this model as temporarily unavailable
            if "rate" in error_str or "429" in error_str:
                logger.warning(
                    "Rate limited on %s, trying next model (attempt %d/3)",
                    model.name if 'model' in dir() else "unknown",
                    attempt + 1,
                )
                continue

            # Other API errors — don't retry with different model
            raise

    raise RuntimeError(f"All models failed. Last error: {last_error}")
```

---

## 4. Backend Changes Required

### 4.1 New Files

| File | Purpose |
|------|---------|
| `app/services/model_router.py` | Model selection, rate limiting, client factory |
| `app/services/context_adapter.py` | Context adaptation per model |
| `app/services/model_metrics.py` | Track which model was used per request (for monitoring) |

### 4.2 Modified Files

| File | Change |
|------|--------|
| `app/core/config.py` | Add `LLM_MODELS` JSON config, `MODEL_ROUTER_ENABLED` flag |
| `app/agents/mentor.py` | Replace direct `OpenAI()` calls with `call_llm()` |
| `app/agents/memory_extractor.py` | Same — use `call_llm()` |
| `app/agents/architect.py` | Same — use `call_llm()` |
| `app/models/db_models.py` | Add `model_used` field to `Message` table (optional, for monitoring) |
| `app/api/routes/chat.py` | Return `model_used` in response (optional, for frontend display) |

### 4.3 Database Schema Addition (Optional)

```sql
-- Migration: add model tracking to messages
ALTER TABLE messages ADD COLUMN IF NOT EXISTS model_used VARCHAR(50);
ALTER TABLE messages ADD COLUMN IF NOT EXISTS tokens_used INTEGER;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS response_time_ms INTEGER;
```

This enables:
- Monitoring which models are actually being used
- Cost tracking per user
- Performance comparison between models

---

## 5. Frontend Changes

### 5.1 Show Model Indicator (Optional)

Add a subtle indicator showing which model responded:

```tsx
// In chat message bubble
{message.model_used && (
  <span className="text-[10px] text-gray-400 mt-1">
    via {message.model_used}
  </span>
)}
```

### 5.2 Better Error Handling

Update `chat/page.tsx` to handle the new error responses:

```typescript
// Current: raw error message shown to user
// Proposed: structured error with retry logic

if (error.code === 'rate_limited') {
  // Show "Try again" button instead of raw error
  setError('The AI is temporarily busy. Please try again in a moment.')
} else if (error.code === 'all_models_unavailable') {
  // Show maintenance message
  setError('Our AI services are temporarily unavailable. Please try again later.')
}
```

### 5.3 API Response Shape Change

```typescript
// POST /chat/message response — add optional fields
{
  message_id: string;
  response: string;
  conversation_id: string;
  tool_calls?: { name: string }[];
  summary_updated?: boolean;
  // NEW:
  model_used?: string;        // "groq-120b"
  response_time_ms?: number;  // 1234
}
```

---

## 6. Implementation Phases

### Phase 1: Model Router (Backend Only) — ~2 hours
1. Create `app/services/model_router.py` with `ModelConfig`, `RateLimitTracker`, `get_client()`
2. Add `LLM_MODELS` JSON to `app/core/config.py`
3. Update `mentor.py` to use `get_client()` instead of direct `OpenAI()` calls
4. Test: verify fallback works by temporarily breaking primary model key

### Phase 2: Context Adapter — ~1 hour
1. Create `app/services/context_adapter.py`
2. Integrate into `call_llm()` wrapper
3. Test: verify context trimming works with smaller-context models

### Phase 3: Error Handling & Monitoring — ~1 hour
1. Add `model_used` tracking to messages
2. Update chat route to return model info
3. Add structured error codes for rate limiting
4. Update frontend error handling

### Phase 4: Smart Routing (Optional) — ~2 hours
1. Route simple messages (greetings, one-word) to cheaper/faster models
2. Route complex messages (career advice, roadmap generation) to capable models
3. Add a simple intent classifier (can be rule-based, not LLM-based)

---

## 7. Fallback Behavior

```
User sends message
  │
  ├─ Try Model 1 (Groq 120B)
  │   ├─ Success → return response
  │   └─ Rate limited → try Model 2
  │
  ├─ Try Model 2 (Groq 70B)
  │   ├─ Success → return response
  │   └─ Rate limited → try Model 3
  │
  ├─ Try Model 3 (OpenAI GPT-4o-mini)
  │   ├─ Success → return response
  │   └─ Rate limited → try Model 4
  │
  └─ All models exhausted → return user-friendly error
       "The AI is temporarily busy. Please try again in a moment."
```

---

## 8. Environment Variables Needed

```bash
# .env — add these
GROQ_API_KEY=gsk_xxxxx           # Primary (existing LLM_API_KEY)
OPENAI_API_KEY=sk-xxxxx          # Fallback (optional, costs money)
GEMINI_API_KEY=xxxxx             # Vision (existing)
```

---

## 9. Cost Considerations

| Model | Cost per 1K tokens | Speed | Quality |
|-------|-------------------|-------|---------|
| Groq 120B | ~$0.00009 | Fast (200ms) | Good |
| Groq 70B | ~$0.000059 | Fast (150ms) | Good |
| OpenAI GPT-4o-mini | ~$0.00015 | Medium (500ms) | Excellent |
| OpenAI GPT-4o | ~$0.005 | Slow (1s) | Best |

**Recommendation:** Start with Groq models only (free tier). Add OpenAI as a paid fallback only if needed.

---

## 10. Testing Plan

1. **Unit tests:** Model selection logic, rate limit tracking, context adaptation
2. **Integration tests:** Full chat flow with mocked LLM responses
3. **Manual tests:**
   - Hit rate limit on primary → verify fallback to secondary
   - Send 50 rapid messages → verify graceful degradation
   - Switch models mid-conversation → verify context is preserved
4. **Load test:** 100 concurrent users → verify rate limiting works

---

## Appendix: Current Error from QA

The QA test showed this error in chat:

```
LLM service error... RateLimitError... rate_limit_exceeded
```

This is the exact problem this document solves. With the model router:
1. Primary model (Groq 120B) hits rate limit
2. Router automatically tries Groq 70B
3. If that's also limited, tries OpenAI GPT-4o-mini
4. User sees a normal response, not an error

**The user never needs to know which model answered.**
