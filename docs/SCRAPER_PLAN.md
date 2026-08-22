# Lynks Opportunity Scraper Plan

> Hybrid RSS + Scraping with curated list fallback

## Architecture

User requests opportunities -> Try RSS feeds -> Try web scrapers -> Return curated list

## Option B: RSS Feeds

| Source | Category | Priority |
|--------|----------|----------|
| Jamaica Gleaner RSS | jobs | High |
| Loop Caribbean News RSS | general | High |
| Devpost Caribbean hackathons | competition | Medium |
| UWI News feed | events/scholarships | Medium |

Dependencies: pip install feedparser

## Option C: Web Scraping

| Site | What to Extract | Difficulty |
|------|-----------------|------------|
| caribbeanjobs.com | Job listings | Medium |
| jef.org.jm | Job listings | Medium |
| scholarshipscanada.com | Scholarships | Hard |
| techbeachretreats.com | Tech events | Easy |

Dependencies: pip install beautifulsoup4 httpx lxml

## Rules for Scrapers

1. Each site needs its own function
2. MUST return [] on failure (never crash the API)
3. Rate limit: max 1 request per site per hour
4. Cache in opportunities table with fetched_at
5. Curated list is always the fallback
6. Check robots.txt and ToS before scraping
