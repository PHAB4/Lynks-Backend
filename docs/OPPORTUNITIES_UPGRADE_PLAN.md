# Opportunities Discovery — Upgrade Plan

**Created:** August 23, 2026
**Status:** Draft — ON HOLD until current tests pass cleanly
**Related files:** `app/agents/scout.py`, `LYNKS_HANDOFF.md`, `API_CONTRACT.md`, `PRD.md`

---

## Problem

1. **Timeouts:** `GET /opportunities` times out (30s+) because the LLM prompt includes all 30+ opportunities
2. **No smart filtering:** All opportunities are sent to the LLM regardless of the user's profile
3. **Category filter is hidden:** The backend supports `?category=` but users and frontend don't know about it
4. **API contract is out of date:** Response doesn't include `category` field; query params don't list `category`

---

## Current Fix (temporary)

- LLM prompt capped to first 15 opportunities (`opportunities[:15]`)
- OpenAI client timeout = 15s
- Fallback to first 8 curated opportunities on any LLM failure
- `category` field added to response objects

---

## Planned Upgrade (pending team approval)

### 1. Smart Pre-Filtering

Score each opportunity by relevance to the user's `career_path`, `country`, `age`, and `interests`. Send top 15 to LLM. Always include at least 1 from each category.

### 2. Category as User-Facing Filter

- Add `?category=` to API contract query params
- Return `available_categories` in response metadata
- Frontend shows category tabs/buttons

### 3. Response Metadata

```json
{
  "opportunities": [...],
  "available_categories": ["competition", "club", "scholarship", "event", "volunteer", "job"],
  "total_available": 30,
  "returned": 8
}
```

### 4. Mentor Prompt Update

Tell the mentor about available categories so it can proactively mention them when natural.

---

## Files to Change

| File | Change |
|------|--------|
| `app/agents/scout.py` | Smart pre-filtering, increased timeout, metadata response |
| `app/agents/mentor.py` | System prompt mentions categories |
| `docs/API_CONTRACT.md` | `category` added to params + response |
| `LYNKS_HANDOFF.md` | Document filtering behavior |

---

## What NOT to Change

- **Frontend/** — No frontend changes
- **Database schema** — No new tables
- **Other agents** — Only scout.py and mentor.py