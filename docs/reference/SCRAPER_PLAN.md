# Lynks Opportunity Scraper — Implementation Plan

> **Status:** ✅ Upgraded — new fields, RSS, social media, caching, structured salary
> **Plan:** `.shogo/plans/lynks-opportunities-scraper-upgrade_d73nxfex.plan.md`
> **Goal:** Live, up-to-date Caribbean opportunities for users with filtering, sorting, and notifications

---

## What Was Implemented (Aug 26, 2026)

### New Fields Added to Opportunities
- `category` — job, club, competition, scholarship, event, volunteer
- `description` — 1-2 sentence summary
- `posted_at` — when the opportunity was originally posted (for time filtering)
- `first_seen_at` — when we first scraped it (for new-opportunity notifications)
- `source_name` — where it was scraped from
- `salary_min`, `salary_max`, `salary_currency` — structured salary (jobs only)
- `image_url` — thumbnail/logo (frontend shows placeholder when null)
- `experience_required` — typo fixed (was `expereince_required`)

### Currency Detection (Priority-Based)
- `_CURRENCY_TABLE` — lookup table with 22+ ISO 4217 currencies (Caribbean priority 1, world major priority 2, symbols priority 3)
- `_detect_currency(text, source_name)` — 4-layer detection: explicit codes → unambiguous symbols → source context → bare `$` fallback
- `_SOURCE_CURRENCY_MAP` — exact source-to-currency mapping (e.g. `rss_jamaica_gleaner` → JMD)
- `_SOURCE_CURRENCY_KEYWORDS` — keyword matching (e.g. "trinidad" in source name → TTD)
- `_parse_salary(pay_text, source_name)` — updated signature to accept source context
- **Bug fix:** JMD vs USD ordering — `jmd` now checked before `$` since Jamaica uses the `$` symbol

### Sources Implemented

| Source | Status | `source_name` | Notes |
|--------|--------|---------------|-------|
| Devpost API | ✅ Built | `devpost_api` | Hackathons, no auth needed |
| Eventbrite API | ✅ Built | `eventbrite_api` | Caribbean tech events |
| RSS feeds | ✅ Built | `rss_jamaica_gleaner`, `rss_loop_caribbean`, `rss_uwi_news` | Keyword-filtered for opportunities |
| Facebook (stretch) | ✅ Built | `facebook_{page_name}` | Public page scraping, fragile |
| Instagram (stretch) | ⚠️ Requires `instaloader` | `instagram_{username}` | Public profile scraping |
| Curated list | ✅ Built | `curated` | 28 Caribbean opportunities (permanent fallback) |
| LLM generated | ✅ Built | `llm_generated` | Groq/Llama generates opportunities |

### Caching
- **In-memory cache** with 1-hour TTL
- Each source cached independently
- Cache key = `source_name`
- Falls back to fresh scrape on cache miss or server restart

### Notification System
- **Polling-based** — frontend calls `GET /opportunities/new-count` every 5 minutes
- Server counts opportunities where `first_seen_at` is within last 24 hours
- If `new_count > 0`, show badge: "🆕 5 new opportunities"
- **Post-competition:** Replace with web push notifications

### Graceful Failure
- Each source wrapped in try/except, returns `[]` on any error
- Curated list is always the permanent safety net
- Console logs track which sources succeed/fail per scrape run
- **Post-competition:** Build admin dashboard showing source health

---

## Architecture: Hybrid RSS + Scraping with Fallback

The system tries live sources first, falls back to curated list if they fail.

```
User requests opportunities
         ↓
  Try Devpost API (hackathons)
  Try Eventbrite API (events)
  Try RSS feeds (news → opportunities)
  Try Social media (Facebook, Instagram)
  Try LLM generation
  Curated list (always available)
         ↓
  Deduplicate by title
  Cache results (1-hour TTL)
         ↓
  Return combined list to scout agent
```

---

## Source Name Values

| Source | `source_name` |
|--------|---------------|
| Devpost API | `devpost_api` |
| Eventbrite API | `eventbrite_api` |
| Jamaica Gleaner RSS | `rss_jamaica_gleaner` |
| Loop Caribbean RSS | `rss_loop_caribbean` |
| UWI News RSS | `rss_uwi_news` |
| Facebook pages | `facebook_{page_name}` |
| Instagram profiles | `instagram_{username}` |
| Curated list | `curated` |
| LLM generated | `llm_generated` |

---

## LLM Extraction Prompt (Updated)

The LLM now extracts structured salary data:

```python
EXTRACTION_PROMPT = """Extract opportunity information. Return JSON:
{
  "title": "string",
  "company": "string",
  "location": "string",
  "category": "job|scholarship|competition|event|club|volunteer",
  "description": "1-2 sentence summary",
  "pay": "string (original text)",
  "salary_min": number or null (ONLY for jobs),
  "salary_max": number or null (ONLY for jobs),
  "salary_currency": "USD|JMD|EUR|GBP" or null,
  "url": "string",
  "posted_at": "ISO date or null",
  "image_url": "string or null"
}"""
```

---

## Post-Competition Backlog

| Feature | Notes |
|---|---|
| Cursor-based pagination | Better for real-time data. Currently offset-based. |
| Web push notifications | Replace polling with push. Requires service worker + HTTPS. |
| Admin source health dashboard | Show which scraper sources are healthy/broken. |
| Instagram API integration | Official API requires app review (weeks). |
| User-submitted opportunities | Moderation queue for community contributions. |
| Background job scheduling | Refresh data every 6-12 hours via cron/worker. |

---

## Important Notes

1. **Each source fails independently** — one breaking doesn't affect others
2. **The curated list is always the fallback** — never remove it
3. **Rate limit everything** — be respectful of external sites
4. **Cache aggressively** — don't scrape on every user request
5. **Social media scraping is fragile** — expect breakage, handle gracefully
6. **Run `app/sql/opportunities_upgrade.sql`** in Supabase SQL Editor to add new columns
