# Lynks Opportunities Scraper Upgrade

## Context

The frontend team is building a dedicated Opportunities page with:
- Tabbed categories (jobs, scholarships, clubs, competitions, events, volunteer)
- Save/bookmark functionality
- "Go to source" links with embedded URLs
- Salary display for jobs (structured min/max/currency)
- Location display
- Image thumbnails from source profiles/logos
- Time-based filtering (within week, within month)
- Recency numbering
- Personal relevance sorting
- Offset pagination (cursor pagination deferred to post-competition)
- Notifications when new opportunities appear
- Social media scraping (public pages, graceful fallback on breakage)
- In-memory caching with 1-hour TTL

### Decisions Made

| Decision | Choice |
|---|---|
| Pagination | **Offset-based** (`?page=1&limit=20`). Cursor-based deferred to post-competition. |
| Caching | **In-memory**, 1-hour TTL. Notifications via polling `/opportunities/new-count`. |
| Social media | **Public page scraping** (no API keys). Graceful `[]` on failure. Curated list is permanent safety net. |
| Images | **Profile pictures** from social media pages, logos from Devpost/Eventbrite. `null` → frontend shows placeholder/category icon. |
| Typo | **`experience_required`** — already renamed in Supabase. Python code updated to match. |
| Notifications | **Polling** — frontend calls `GET /opportunities/new-count` every few minutes. Web push deferred to post-competition. |

---

## Phase 1: Schema Changes (Supabase SQL)

### 1.1 Add columns to `opportunities` table

```sql
-- Add new columns
ALTER TABLE opportunities
  ADD COLUMN category TEXT NOT NULL DEFAULT 'event',
  ADD COLUMN description TEXT,
  ADD COLUMN posted_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN first_seen_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN source_name TEXT DEFAULT 'curated',
  ADD COLUMN salary_min NUMERIC,
  ADD COLUMN salary_max NUMERIC,
  ADD COLUMN salary_currency TEXT DEFAULT 'JMD',
  ADD COLUMN image_url TEXT;

-- Indexes for time-based filtering
CREATE INDEX idx_opportunities_posted_at ON opportunities(posted_at DESC);
CREATE INDEX idx_opportunities_first_seen ON opportunities(first_seen_at DESC);

-- Index for category filtering
CREATE INDEX idx_opportunities_category ON opportunities(category);

-- Composite index for common queries (category + time sort)
CREATE INDEX idx_opportunities_cat_time ON opportunities(category, posted_at DESC);
```

**Note:** `expereince_required` → `experience_required` typo is already fixed in Supabase. Python references will be updated in Phase 2.

### 1.2 Create `saved_opportunities` table

```sql
CREATE TABLE saved_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  opportunity_id TEXT NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  saved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, opportunity_id)
);

-- RLS policies
ALTER TABLE saved_opportunities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can save opportunities"
  ON saved_opportunities FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their saved opportunities"
  ON saved_opportunities FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can unsave opportunities"
  ON saved_opportunities FOR DELETE
  USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_saved_opportunities_user ON saved_opportunities(user_id);
CREATE INDEX idx_saved_opportunities_opp ON saved_opportunities(opportunity_id);
```

---

## Phase 2: Scraper Upgrades

### 2.1 Update `opportunity_scraper.py`

**Updated `Opportunity` dataclass:**

```python
@dataclass
class Opportunity:
    id: str
    title: str
    company: str
    location: str
    pay: str
    salary_min: float | None = None
    salary_max: float | None = None
    salary_currency: str | None = None
    age_requirement: str | None = None
    experience_required: str = "None"  # Fixed typo
    url: str = ""
    category: str = "event"
    description: str = ""
    posted_at: str | None = None       # ISO format — when it was originally posted
    first_seen_at: str | None = None   # ISO format — when we first scraped it
    source_name: str = "curated"
    image_url: str | None = None
```

### 2.2 Add RSS feed sources

```python
async def fetch_from_rss(feed_url: str, source_name: str) -> list[dict]:
    """Parse RSS feed and extract opportunities."""
    # Use feedparser or httpx + xml.etree
    # Extract: title, link, published date, description, image
    # Parse into opportunity format
```

**Priority RSS feeds:**

| Feed | URL | Category |
|------|-----|----------|
| Jamaica Gleaner | `https://jamaicagleaner.com/feed` | news → event |
| Loop Caribbean | `https://loopnews.com/caribbean/feed` | news → event |
| Devpost Hackathons | `https://devpost.com/hackathons.atom` | competition |
| UWI News | `https://www.mona.uwi.edu/news/feed` | event |

### 2.3 Add social media scraping (stretch goal)

```python
async def fetch_from_facebook(page_id: str) -> list[dict]:
    """Scrape public Facebook page for opportunity posts."""
    # Use httpx to fetch mobile version (m.facebook.com)
    # Parse with BeautifulSoup
    # Extract: post text, date, links, profile picture as image_url
    # Filter for opportunity-related posts using keyword matching

async def fetch_from_instagram(username: str) -> list[dict]:
    """Scrape public Instagram profile for opportunity posts."""
    # Use instaloader library or httpx + public API
    # Extract: caption text, date, links in bio, profile picture as image_url
    # Filter for opportunity-related posts
```

**Social media targets:**

| Platform | Account/Page | Category |
|----------|--------------|----------|
| Facebook | Jamaica Tech Community | event |
| Facebook | Caribbean Tech Hub | event |
| Instagram | @techjamaica | event |
| Instagram | @caribbeantech | event |

**Graceful failure strategy:**
- Each social media source is wrapped in try/except, returns `[]` on any error
- The curated list + Devpost API + Eventbrite API + RSS are always available as fallbacks
- Console logs track which sources succeed/fail per scrape run
- **Post-competition:** Build admin dashboard showing source health status

### 2.4 Update LLM extraction prompt

```python
EXTRACTION_PROMPT = """Extract opportunity information from this text. Return JSON:

{
  "title": "string",
  "company": "string (organization offering it)",
  "location": "string (city/country or 'Remote')",
  "category": "job|scholarship|competition|event|club|volunteer",
  "description": "1-2 sentence summary",
  "pay": "string (original text)",
  "salary_min": number or null (ONLY for job opportunities),
  "salary_max": number or null (ONLY for job opportunities),
  "salary_currency": "USD|JMD|EUR|GBP" or null,
  "age_requirement": "string or null",
  "experience_required": "string",
  "url": "string (application link)",
  "posted_at": "ISO date string or null",
  "image_url": "string or null (thumbnail/logo URL if available)"
}

Rules:
- Only extract salary_min/max for JOB opportunities
- For other categories, set salary fields to null
- If no salary info available, set salary fields to null and keep pay text
- Return ONLY valid JSON, no commentary"""
```

### 2.5 Add source_name tracking

| Source | `source_name` value |
|--------|---------------------|
| Devpost API | `devpost_api` |
| Eventbrite API | `eventbrite_api` |
| RSS feeds | `rss_{feed_name}` (e.g. `rss_jamaica_gleaner`) |
| Facebook | `facebook_{page_name}` |
| Instagram | `instagram_{username}` |
| Curated list | `curated` |
| LLM generated | `llm_generated` |

### 2.6 Add caching layer

```python
import time

_opportunity_cache: dict[str, tuple[float, list[dict]]] = {}
CACHE_TTL = 3600  # 1 hour

def get_cached_opportunities(source: str) -> list[dict] | None:
    if source in _opportunity_cache:
        cached_time, data = _opportunity_cache[source]
        if time.time() - cached_time < CACHE_TTL:
            return data
    return None

def set_cached_opportunities(source: str, data: list[dict]):
    _opportunity_cache[source] = (time.time(), data)
```

---

## Phase 3: API Contract Updates

### 3.1 Update `GET /opportunities`

**New query parameters:**

```
GET /opportunities?category=job&timeframe=week&sort=relevance&page=1&limit=20

Query params:
- category: string (optional) — filter by category
- timeframe: string (optional) — "day", "week", "month", "quarter", "all"
- sort: string (optional) — "relevance" (default), "recent", "salary"
- page: int (optional, default 1) — OFFSET PAGINATION (cursor deferred to post-competition)
- limit: int (optional, default 20, max 50)
- saved_only: boolean (optional) — only return saved opportunities
```

**Updated response shape:**

```json
{
  "opportunities": [
    {
      "id": "string",
      "title": "string",
      "company": "string",
      "location": "string",
      "description": "string",
      "category": "job|scholarship|competition|event|club|volunteer",
      "pay": "string (original text)",
      "salary_min": 50000,
      "salary_max": 75000,
      "salary_currency": "JMD",
      "age_requirement": "string | null",
      "experience_required": "string",
      "url": "string (source link for 'Go to source' button)",
      "posted_at": "2026-08-20T10:00:00Z",
      "first_seen_at": "2026-08-26T08:00:00Z",
      "source_name": "devpost_api",
      "image_url": "string | null (profile pic/logo or null)",
      "is_saved": true,
      "relevance_score": 0.85
    }
  ],
  "metadata": {
    "total_available": 42,
    "returned": 20,
    "page": 1,
    "limit": 20,
    "has_more": true,
    "available_categories": ["job", "scholarship", "competition", "event", "club", "volunteer"],
    "filters_applied": {
      "category": "job",
      "timeframe": "week",
      "sort": "relevance"
    }
  }
}
```

### 3.2 New endpoint: `GET /opportunities/new-count`

For new-opportunity notifications via polling. Frontend calls this every few minutes.

```
GET /opportunities/new-count

Response: {
  "new_count": 5,
  "new_since": "2026-08-25T00:00:00Z"
}
```

**How it works:**
1. Server counts opportunities where `first_seen_at` is within the last 24 hours
2. Frontend polls this every 5 minutes
3. If `new_count > 0`, show a badge: "🆕 5 new opportunities"
4. User clicks badge → navigates to opportunities page filtered to new ones
5. After user views, frontend stores a "last viewed" timestamp and can show only truly unseen ones

**Post-competition upgrade:** Replace polling with web push notifications (requires service worker + push API).

### 3.3 New save/unsave endpoints

```
# POST /opportunities/{opportunity_id}/save
# Saves an opportunity for the authenticated user
Response 201: { "success": true, "saved_at": "datetime" }
Response 409: { "detail": { "error": { "code": "already_saved", "message": "..." } } }

# DELETE /opportunities/{opportunity_id}/save
# Removes a saved opportunity
Response 200: { "success": true }
Response 404: { "detail": { "error": { "code": "not_found", "message": "..." } } }

# GET /opportunities/saved
# Lists all saved opportunities for the authenticated user
Response 200: {
  "saved": [
    { "... full opportunity object with is_saved: true ..." }
  ],
  "total": 15
}
```

### 3.4 Image URL convention for frontend

- `image_url` is a string field, nullable
- When present: frontend displays it as a thumbnail/card image
- When `null`: frontend shows a category-based icon or placeholder
- Sources that provide images: Devpost (hackathon logos), Eventbrite (event images), social media (profile pictures)
- Sources that don't: curated list, RSS (may have images in feed, may not), LLM-generated

---

## Phase 4: Scout Agent Updates

### 4.1 Update `discover_opportunities()` function

```python
async def discover_opportunities(
    db: AsyncSession,
    user_id: str,
    category: str | None = None,
    timeframe: str | None = None,
    sort: str = "relevance",
    page: int = 1,
    limit: int = 20,
) -> dict:  # Returns dict with metadata, not flat list
```

Key changes:
- **Offset pagination:** `query.offset((page - 1) * limit).limit(limit)`
- **Time filtering:** uses `posted_at` field + `get_timeframe_cutoff()` helper
- **Sort modes:** `relevance` (LLM ranking), `recent` (posted_at DESC), `salary` (salary_max DESC nulls last)
- **`is_saved` flag:** queries `saved_opportunities` table for user's saved IDs, attaches to each result
- **Metadata return:** includes `total_available`, `returned`, `page`, `has_more`, `available_categories`, `filters_applied`

### 4.2 Add `get_new_count()` function

```python
async def get_new_count(db: AsyncSession) -> dict:
    """Count opportunities first seen in the last 24 hours."""
    cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
    result = await db.execute(
        select(func.count(Opportunity.id))
        .where(Opportunity.first_seen_at >= cutoff)
    )
    count = result.scalar()
    return {
        "new_count": count,
        "new_since": cutoff.isoformat()
    }
```

### 4.3 Add time filtering helper

```python
def get_timeframe_cutoff(timeframe: str) -> datetime:
    now = datetime.now(timezone.utc)
    match timeframe:
        case "day":       return now - timedelta(days=1)
        case "week":      return now - timedelta(weeks=1)
        case "month":     return now - timedelta(days=30)
        case "quarter":   return now - timedelta(days=90)
        case "all" | _:   return datetime.min.replace(tzinfo=timezone.utc)
```

---

## Phase 5: Custom Routes (custom-routes.py)

```python
# GET /opportunities — enhanced with filtering, sorting, pagination
@app.get("/opportunities")
async def list_opportunities(
    category: str = None,
    timeframe: str = None,
    sort: str = "relevance",
    page: int = 1,
    limit: int = 20,
    saved_only: bool = False,
):
    user_id = get_user_id_from_token(c.request)
    result = await discover_opportunities(
        db, user_id, category, timeframe, sort, page, limit
    )
    return result

# GET /opportunities/new-count — new opportunity notifications (polling)
@app.get("/opportunities/new-count")
async def new_opportunity_count():
    result = await get_new_count(db)
    return result

# POST /opportunities/{opportunity_id}/save
@app.post("/opportunities/{opportunity_id}/save")
async def save_opportunity(opportunity_id: str):
    user_id = get_user_id_from_token(c.request)
    # Insert into saved_opportunities (handle unique constraint → 409)
    # Return 201 with saved_at timestamp

# DELETE /opportunities/{opportunity_id}/save
@app.delete("/opportunities/{opportunity_id}/save")
async def unsave_opportunity(opportunity_id: str):
    user_id = get_user_id_from_token(c.request)
    # Delete from saved_opportunities (handle not found → 404)
    # Return 200 success

# GET /opportunities/saved
@app.get("/opportunities/saved")
async def list_saved_opportunities():
    user_id = get_user_id_from_token(c.request)
    # Query saved_opportunities JOIN opportunities
    # Return list with is_saved: true
```

---

## Phase 6: Documentation Updates

### 6.1 Update `docs/SCHEMA.md`
- Add new columns to opportunities table (category, description, posted_at, first_seen_at, source_name, salary_min, salary_max, salary_currency, image_url)
- Add saved_opportunities table
- Update entity relationship diagram
- Note: `experience_required` typo is fixed (previously `expereince_required`)

### 6.2 Update `docs/API_CONTRACT.md`
- Document new query params for GET /opportunities (category, timeframe, sort, page, limit, saved_only)
- Document offset pagination (note: cursor-based deferred to post-competition)
- Document new response metadata block
- Document image_url field (nullable, frontend shows placeholder when null)
- Document GET /opportunities/new-count endpoint
- Document POST/DELETE save endpoints and GET /opportunities/saved
- Document error codes (409 already_saved, 404 not_found)

### 6.3 Update `docs/SCRAPER_PLAN.md`
- Add RSS feed sources and implementation details
- Add social media scraping targets and graceful failure strategy
- Document caching strategy (in-memory, 1-hour TTL)
- Document source_name values
- Document notification system (polling new-count endpoint)
- Note: cursor pagination and web push notifications deferred to post-competition

### 6.4 Update PRD
- Add Opportunities page feature requirements
- Add new-opportunity notifications requirement
- Add image thumbnails requirement
- Note cursor pagination as post-competition upgrade
- Note web push notifications as post-competition upgrade

---

## Post-Competition Backlog

These are explicitly deferred:

| Feature | Notes |
|---|---|
| Cursor-based pagination | Better for real-time data. Implement when opportunities update frequently. |
| Web push notifications | Replace polling with push. Requires service worker + HTTPS + user permission. |
| Admin source health dashboard | Show which scraper sources are healthy/broken. Currently console logs only. |
| Instagram API integration | Official API requires app review (weeks). Public scraping is fragile. |

---

## Implementation Order

1. **Run Supabase migration SQL** (Phase 1) — manually in SQL Editor
2. **Update `opportunity_scraper.py`** (Phase 2) — new fields, RSS, social media, caching
3. **Update `scout.py`** (Phase 4) — filtering, sorting, pagination, new_count, is_saved
4. **Update `custom-routes.py`** (Phase 5) — all new endpoints
5. **Update docs** (Phase 6) — SCHEMA.md, API_CONTRACT.md, SCRAPER_PLAN.md, PRD
6. **Test all endpoints** — verify filtering, sorting, pagination, save/unsave, new-count

---

## Summary of All New/Updated Endpoints

| Method | Endpoint | Status | Purpose |
|---|---|---|---|
| GET | `/opportunities` | **Updated** | List with filtering, sorting, offset pagination, image_url |
| GET | `/opportunities/new-count` | **New** | Polling endpoint for new-opportunity notifications |
| POST | `/opportunities/{id}/save` | **New** | Save/bookmark an opportunity |
| DELETE | `/opportunities/{id}/save` | **New** | Unsave an opportunity |
| GET | `/opportunities/saved` | **New** | List user's saved opportunities |

## Summary of Schema Changes

| Table | Change |
|---|---|
| `opportunities` | Add: category, description, posted_at, first_seen_at, source_name, salary_min, salary_max, salary_currency, image_url |
| `saved_opportunities` | **New table** — id, user_id, opportunity_id, saved_at |

## Frontend Team Handoff

The frontend team needs to know:
1. **New fields** in GET /opportunities response: `description`, `category`, `image_url`, `salary_min`, `salary_max`, `salary_currency`, `first_seen_at`, `is_saved`, `relevance_score`
2. **`image_url`**: string | null — show category icon/placeholder when null
3. **`salary_min`/`salary_max`**: numbers | null — display as salary range for jobs, hide for other categories
4. **`category`**: used for tab filtering — values: job, scholarship, competition, event, club, volunteer
5. **`url`**: the "Go to source" link
6. **Pagination**: use `?page=N&limit=20` — offset-based, `has_more` tells you if there are more pages
7. **New notifications**: poll `GET /opportunities/new-count` every few minutes
8. **Save/unsave**: POST/DELETE to `/opportunities/{id}/save`
9. **Post-competition**: cursor pagination and web push notifications will replace current approaches
