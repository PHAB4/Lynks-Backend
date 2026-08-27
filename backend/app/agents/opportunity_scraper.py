"""
Opportunity Scraper — pulls Caribbean-relevant opportunities from the internet.

This script can be run manually or scheduled (e.g., via cron or a deployment platform).

Sources:
  1. Devpost API (hackathons)
  2. Eventbrite (Caribbean events)
  3. RSS feeds (Jamaica Gleaner, Loop Caribbean, UWI News)
  4. Social media scraping (Facebook public pages — stretch goal)
  5. Curated Caribbean opportunities database (permanent fallback)
  6. LLM-powered opportunity generation from current news

Usage:
  python -m backend.app.agents.opportunity_scraper

Or call scrape_opportunities() from a scheduled task.
"""

from __future__ import annotations

import json
import logging
import re
import time
import uuid
from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from xml.etree import ElementTree as ET

import httpx
from openai import OpenAI

from app.core.config import settings

logger = logging.getLogger(__name__)


# ── Opportunity dataclass ──────────────────────────────────────────────────


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
    experience_required: str = "None"
    url: str = ""
    category: str = "event"
    description: str = ""
    posted_at: str | None = None       # ISO format — when it was originally posted
    first_seen_at: str | None = None   # ISO format — when we first scraped it
    source_name: str = "curated"
    image_url: str | None = None

    def to_dict(self) -> dict:
        return asdict(self)


# ── Caching layer ──────────────────────────────────────────────────────────

_opportunity_cache: dict[str, tuple[float, list[dict]]] = {}
CACHE_TTL = 3600  # 1 hour


def get_cached_opportunities(source: str) -> list[dict] | None:
    if source in _opportunity_cache:
        cached_time, data = _opportunity_cache[source]
        if time.time() - cached_time < CACHE_TTL:
            logger.debug("Cache hit for source: %s", source)
            return data
    return None


def set_cached_opportunities(source: str, data: list[dict]):
    _opportunity_cache[source] = (time.time(), data)


# ── Helpers ────────────────────────────────────────────────────────────────


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# Currency detection — ISO 4217 codes and symbols.
# Order matters: specific 3-letter codes are checked FIRST because
# multiple currencies share the same symbol (e.g. $ is used by USD,
# JMD, TTD, BBD, BSD, AUD, CAD, NZD, etc.).
# Pattern: (priority, code, triggers)
# Lower priority number = checked first. Bare $ falls through to USD.
_CURRENCY_TABLE: list[tuple[int, str, list[str]]] = [
    # ── Caribbean currencies (highest priority for our users) ──────────
    (1, "JMD", ["jmd", "jm "]),
    (1, "TTD", ["ttd", "tt "]),
    (1, "BBD", ["bbd", "bb "]),
    (1, "BSD", ["bsd", "bahamas"]),
    (1, "KYD", ["kyd", "cayman"]),
    (1, "XCD", ["xcd", "east caribbean"]),
    (1, "GYD", ["gyd", "gy "]),
    (1, "SRD", ["srd", "surinamese"]),
    (1, "HTG", ["htg", "gourde"]),
    (1, "DOP", ["dop", "dominican"]),
    # ── Major world currencies ─────────────────────────────────────────
    (2, "USD", ["usd"]),
    (2, "EUR", ["eur"]),
    (2, "GBP", ["gbp"]),
    (2, "CAD", ["cad", "canadian"]),
    (2, "AUD", ["aud", "australian"]),
    (2, "NZD", ["nzd", "new zealand"]),
    (2, "CHF", ["chf", "swiss"]),
    (2, "JPY", ["jpy", "yen"]),
    (2, "CNY", ["cny", "rmb", "yuan", "chinese"]),
    (2, "INR", ["inr", "rupee"]),
    (2, "BRL", ["brl", "real"]),
    (2, "MXN", ["mxn", "peso"]),
    # ── Symbol-only fallbacks (checked last — ambiguous) ───────────────
    (3, "EUR", ["€"]),
    (3, "GBP", ["£"]),
    (3, "JPY", ["¥"]),
    (3, "INR", ["₹"]),
    (3, "KRW", ["₩"]),
    (3, "THB", ["฿"]),
]

# All unique symbols we know about — used to strip them from numeric parsing
_ALL_SYMBOLS = r"\$€£¥₹₩฿"


# Source-to-currency mapping. When a source only has a bare "$", we use
# this to infer the correct local currency instead of defaulting to USD.
# Keys match source_name values from RSS_FEEDS, social media configs, etc.
_SOURCE_CURRENCY_MAP: dict[str, str] = {
    # RSS feeds
    "rss_jamaica_gleaner": "JMD",
    "rss_loop_caribbean": "USD",       # Loop covers multiple countries — USD is safest
    "rss_uwi_news": "JMD",            # UWI Mona campus is in Jamaica
    # Facebook pages
    "facebook_JamaicaTechCommunity": "JMD",
    "facebook_CaribbeanTechHub": "USD",
    # Instagram accounts
    "instagram_techjamaica": "JMD",
    "instagram_caribbeantech": "USD",
    # Social media pages that might get added later — pattern matching below
}

# If the source name contains these keywords, infer the currency
_SOURCE_CURRENCY_KEYWORDS: list[tuple[str, str]] = [
    ("jamaica", "JMD"),
    ("jamaican", "JMD"),
    ("trinidad", "TTD"),
    ("trini", "TTD"),
    ("barbados", "BBD"),
    ("barbadian", "BBD"),
    ("bahamas", "BSD"),
    ("cayman", "KYD"),
    ("guyana", "GYD"),
    ("suriname", "SRD"),
    ("dominican", "DOP"),
    ("haiti", "HTG"),
]


def _detect_currency(text: str, source_name: str | None = None) -> str | None:
    """Detect currency from text using a priority-based lookup.

    Detection priority:
    1. Explicit 3-letter ISO codes in the text (JMD, TTD, EUR, etc.)
    2. Unambiguous symbols in the text (€, £, ¥, etc.)
    3. Source context — if the source is Jamaican and text has "$", assume JMD
    4. Bare "$" with no other context → USD

    Returns ISO 4217 code or None.
    """
    lower = text.lower()

    # Step 1: Check explicit currency codes and unambiguous symbols
    for priority, code, triggers in sorted(_CURRENCY_TABLE):
        for trigger in triggers:
            if trigger in lower:
                return code

    # Step 2: Bare $ — use source context if available
    if "$" in text:
        if source_name:
            # Exact match first (e.g. "rss_jamaica_gleaner" → "JMD")
            if source_name in _SOURCE_CURRENCY_MAP:
                return _SOURCE_CURRENCY_MAP[source_name]

            # Keyword match (e.g. "facebook_JamaicaJobs" → "JMD")
            source_lower = source_name.lower()
            for keyword, currency in _SOURCE_CURRENCY_KEYWORDS:
                if keyword in source_lower:
                    return currency

        # No source context or no match → default to USD
        return "USD"

    return None


def _parse_salary(pay_text: str, source_name: str | None = None) -> tuple[float | None, float | None, str | None]:
    """Attempt to extract structured salary from pay text.

    Handles any ISO 4217 currency — Caribbean, major world, and symbol-based.
    If source_name is provided, bare "$" defaults to the source's local currency
    instead of always defaulting to USD.
    Returns (salary_min, salary_max, currency) or (None, None, None).
    """
    if not pay_text:
        return None, None, None

    currency = _detect_currency(pay_text, source_name=source_name)

    # Try to find numeric ranges like "$50,000 - $75,000" or "50000-75000"
    range_match = re.search(
        rf'[{_ALL_SYMBOLS}]?\s*([\d,]+(?:\.\d+)?)\s*[-–to]+\s*[{_ALL_SYMBOLS}]?\s*([\d,]+(?:\.\d+)?)',
        pay_text.lower(),
    )
    if range_match:
        try:
            low = float(range_match.group(1).replace(",", ""))
            high = float(range_match.group(2).replace(",", ""))
            return low, high, currency
        except ValueError:
            pass

    # Try to find a single number like "$50,000/year" or "USD 60,000"
    single_match = re.search(rf'[{_ALL_SYMBOLS}]?\s*([\d,]+(?:\.\d+)?)', pay_text.lower())
    if single_match:
        try:
            val = float(single_match.group(1).replace(",", ""))
            if val > 0:
                return val, val, currency
        except ValueError:
            pass

    return None, None, None


# ── Scraping sources ───────────────────────────────────────────────────────


def scrape_devpost_hackathons() -> list[Opportunity]:
    """Pull hackathons from Devpost's API. Free, no API key needed."""
    cached = get_cached_opportunities("devpost_api")
    if cached is not None:
        return [Opportunity(**o) for o in cached]

    try:
        response = httpx.get(
            "https://devpost.com/api/hackathons",
            params={"status": "upcoming", "per_page": 20},
            timeout=15,
        )
        response.raise_for_status()
        data = response.json()

        opportunities = []
        now = _now_iso()

        for h in data.get("hackathons", []):
            location = h.get("location", "") or "Online"
            title = h.get("name", "")
            pay_text = "Free to enter" if h.get("free") else "Check event details"
            url = h.get("url", "https://devpost.com")
            image = h.get("logo_url") or h.get("thumbnail_url")

            opp = Opportunity(
                id=str(uuid.uuid4()),
                title=title,
                company="Devpost",
                location=location,
                pay=pay_text,
                age_requirement="Ages 16+",
                experience_required="Basic coding skills",
                url=url,
                category="competition",
                description=h.get("description", "")[:200],
                posted_at=h.get("deadline"),
                first_seen_at=now,
                source_name="devpost_api",
                image_url=image,
            )
            opportunities.append(opp)

        logger.info("Scraped %d hackathons from Devpost", len(opportunities))
        set_cached_opportunities("devpost_api", [o.to_dict() for o in opportunities])
        return opportunities
    except Exception as e:
        logger.warning("Failed to scrape Devpost: %s", e)
        return []


def scrape_eventbrite_caribbean() -> list[Opportunity]:
    """Pull tech events from Eventbrite's public search. Free, no API key needed."""
    cached = get_cached_opportunities("eventbrite_api")
    if cached is not None:
        return [Opportunity(**o) for o in cached]

    try:
        caribbean_queries = [
            "technology event Jamaica",
            "tech event Barbados",
            "hackathon Trinidad",
            "coding workshop Caribbean",
            "STEM event Caribbean",
        ]

        opportunities = []
        now = _now_iso()

        for query in caribbean_queries:
            response = httpx.get(
                "https://www.eventbrite.com/api/v3/destination/search/",
                params={"q": query, "page_size": 5},
                headers={"User-Agent": "Lynks-Opportunity-Scraper/1.0"},
                timeout=15,
            )
            if response.status_code == 200:
                data = response.json()
                for event in data.get("events", []):
                    pay_text = "Free" if event.get("is_free") else "Check event"
                    image = event.get("image")

                    opp = Opportunity(
                        id=str(uuid.uuid4()),
                        title=event.get("name", ""),
                        company="Eventbrite",
                        location=event.get("location", {}).get("address", "Caribbean"),
                        pay=pay_text,
                        age_requirement="Ages 16+",
                        experience_required="Interest in topic",
                        url=event.get("url", "https://eventbrite.com"),
                        category="event",
                        posted_at=event.get("start_date"),
                        first_seen_at=now,
                        source_name="eventbrite_api",
                        image_url=image,
                    )
                    opportunities.append(opp)

        logger.info("Scraped %d events from Eventbrite", len(opportunities))
        set_cached_opportunities("eventbrite_api", [o.to_dict() for o in opportunities])
        return opportunities
    except Exception as e:
        logger.warning("Failed to scrape Eventbrite: %s", e)
        return []


# ── RSS feed sources ──────────────────────────────────────────────────────


RSS_FEEDS = [
    {
        "url": "https://jamaicagleaner.com/feed",
        "source_name": "rss_jamaica_gleaner",
        "default_category": "event",
    },
    {
        "url": "https://loopnews.com/caribbean/feed",
        "source_name": "rss_loop_caribbean",
        "default_category": "event",
    },
    {
        "url": "https://www.mona.uwi.edu/news/feed",
        "source_name": "rss_uwi_news",
        "default_category": "event",
    },
]

# Keywords to filter for opportunity-relevant posts
OPPORTUNITY_KEYWORDS = [
    "hiring", "job", "vacancy", "position", "apply", "application",
    "scholarship", "grant", "funding", "fellowship",
    "hackathon", "competition", "contest", "challenge",
    "workshop", "training", "bootcamp", "programme", "program",
    "volunteer", "internship", "apprenticeship",
    "opportunity", "open call", "recruitment",
    "deadline", "registration", "enrol",
]


def _matches_opportunity_keywords(text: str) -> bool:
    """Check if text contains opportunity-related keywords."""
    text_lower = text.lower()
    return any(kw in text_lower for kw in OPPORTUNITY_KEYWORDS)


def _parse_rss_date(date_str: str | None) -> str | None:
    """Parse RSS date string to ISO format."""
    if not date_str:
        return None
    try:
        # Try common RSS date formats
        for fmt in [
            "%a, %d %b %Y %H:%M:%S %z",
            "%a, %d %b %Y %H:%M:%S %Z",
            "%Y-%m-%dT%H:%M:%S%z",
            "%Y-%m-%dT%H:%M:%SZ",
            "%Y-%m-%d %H:%M:%S",
        ]:
            try:
                dt = datetime.strptime(date_str.strip(), fmt)
                return dt.isoformat()
            except ValueError:
                continue
        return date_str
    except Exception:
        return None


def _extract_rss_image(entry_element) -> str | None:
    """Try to extract an image URL from an RSS/Atom entry."""
    # Check for media:thumbnail or media:content
    ns = {
        "media": "http://search.yahoo.com/mrss/",
        "atom": "http://www.w3.org/2005/Atom",
    }
    for tag in [
        ".//media:thumbnail",
        ".//media:content",
        ".//media:thumbnail[@url]",
    ]:
        el = entry_element.find(tag, ns)
        if el is not None:
            url = el.get("url") or el.get("medium")
            if url:
                return url

    # Check for enclosure with image type
    enclosure = entry_element.find(".//enclosure")
    if enclosure is not None and "image" in (enclosure.get("type", "")):
        return enclosure.get("url")

    return None


async def fetch_from_rss(feed_config: dict) -> list[Opportunity]:
    """Parse an RSS feed and extract opportunity-relevant entries."""
    feed_url = feed_config["url"]
    source_name = feed_config["source_name"]
    default_category = feed_config["default_category"]

    cache_key = source_name
    cached = get_cached_opportunities(cache_key)
    if cached is not None:
        return [Opportunity(**o) for o in cached]

    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                feed_url,
                timeout=15,
                headers={"User-Agent": "Lynks-Opportunity-Scraper/1.0"},
            )
            response.raise_for_status()

        root = ET.fromstring(response.text)
        opportunities = []
        now = _now_iso()

        # Handle both RSS 2.0 and Atom feeds
        # RSS 2.0: /rss/channel/item
        # Atom: /feed/entry
        items = root.findall(".//item") or root.findall(
            ".//{http://www.w3.org/2005/Atom}entry"
        )

        for item in items:
            title = (
                item.findtext("title")
                or item.findtext("{http://www.w3.org/2005/Atom}title")
                or ""
            ).strip()

            description = (
                item.findtext("description")
                or item.findtext("{http://www.w3.org/2005/Atom}summary")
                or item.findtext("{http://www.w3.org/2005/Atom}content")
                or ""
            ).strip()

            link = (
                item.findtext("link")
                or item.findtext("{http://www.w3.org/2005/Atom}link")
                or ""
            ).strip()

            pub_date = (
                item.findtext("pubDate")
                or item.findtext("{http://www.w3.org/2005/Atom}published")
                or item.findtext("{http://www.w3.org/2005/Atom}updated")
            )

            image_url = _extract_rss_image(item)

            # Filter for opportunity-relevant entries
            combined_text = f"{title} {description}"
            if not _matches_opportunity_keywords(combined_text):
                continue

            opp = Opportunity(
                id=str(uuid.uuid4()),
                title=title[:150],
                company=source_name.replace("rss_", "").replace("_", " ").title(),
                location="Caribbean",
                pay="See details",
                url=link,
                category=default_category,
                description=description[:200] if description else "",
                posted_at=_parse_rss_date(pub_date),
                first_seen_at=now,
                source_name=source_name,
                image_url=image_url,
            )
            opportunities.append(opp)

        logger.info("Scraped %d opportunities from RSS: %s", len(opportunities), feed_url)
        set_cached_opportunities(cache_key, [o.to_dict() for o in opportunities])
        return opportunities

    except Exception as e:
        logger.warning("Failed to scrape RSS feed %s: %s", feed_url, e)
        return []


async def scrape_all_rss_feeds() -> list[Opportunity]:
    """Scrape all configured RSS feeds."""
    all_opps = []
    for feed_config in RSS_FEEDS:
        opps = await fetch_from_rss(feed_config)
        all_opps.extend(opps)
    return all_opps


# ── Social media scraping (stretch goal) ───────────────────────────────────


async def fetch_from_facebook(page_id: str) -> list[Opportunity]:
    """Scrape a public Facebook page for opportunity posts.

    Uses the mobile version (m.facebook.com) which is simpler to parse.
    Falls back gracefully on any error.
    """
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"https://m.facebook.com/{page_id}/posts/",
                timeout=20,
                headers={
                    "User-Agent": (
                        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) "
                        "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 "
                        "Mobile/15E148 Safari/604.1"
                    ),
                },
                follow_redirects=True,
            )

            if response.status_code != 200:
                logger.warning("Facebook page %s returned status %d", page_id, response.status_code)
                return []

        # Parse HTML with basic regex (BeautifulSoup would be better but
        # avoids an extra dependency for a stretch goal)
        text = response.text
        opportunities = []
        now = _now_iso()

        # Extract post texts — look for data-ft="..." patterns or just <div> text
        # This is intentionally simple; production would use BeautifulSoup
        post_pattern = re.compile(
            r'<div[^>]*data-testid="userpost"[^>]*>(.*?)</div>\s*<div',
            re.DOTALL,
        )
        posts = post_pattern.findall(text)

        for post_html in posts[:10]:  # Limit to 10 most recent posts
            # Strip HTML tags for plain text
            post_text = re.sub(r'<[^>]+>', ' ', post_html).strip()
            post_text = re.sub(r'\s+', ' ', post_text)

            if not _matches_opportunity_keywords(post_text):
                continue

            opp = Opportunity(
                id=str(uuid.uuid4()),
                title=post_text[:100],
                company=page_id,
                location="Caribbean",
                pay="See post for details",
                url=f"https://facebook.com/{page_id}",
                category="event",
                description=post_text[:200],
                first_seen_at=now,
                source_name=f"facebook_{page_id}",
                image_url=None,
            )
            opportunities.append(opp)

        logger.info("Scraped %d opportunities from Facebook: %s", len(opportunities), page_id)
        return opportunities

    except Exception as e:
        logger.warning("Failed to scrape Facebook page %s: %s", page_id, e)
        return []


# Social media targets — add more as needed
FACEBOOK_PAGES = [
    "JamaicaTechCommunity",
    "CaribbeanTechHub",
]

INSTAGRAM_ACCOUNTS = [
    "techjamaica",
    "caribbeantech",
]


async def scrape_all_social_media() -> list[Opportunity]:
    """Scrape all configured social media sources.

    Each source fails independently — if one breaks, the others still work.
    """
    all_opps = []

    # Facebook pages
    for page_id in FACEBOOK_PAGES:
        opps = await fetch_from_facebook(page_id)
        all_opps.extend(opps)

    # Instagram (stretch — log warning if instaloader not available)
    try:
        import instaloader  # noqa: F401
        for username in INSTAGRAM_ACCOUNTS:
            try:
                opps = await _fetch_from_instagram(username)
                all_opps.extend(opps)
            except Exception as e:
                logger.warning("Instagram scrape failed for @%s: %s", username, e)
    except ImportError:
        logger.info("instaloader not installed — skipping Instagram scraping")

    return all_opps


async def _fetch_from_instagram(username: str) -> list[Opportunity]:
    """Scrape a public Instagram profile for opportunity posts.

    Requires `instaloader` package. Falls back gracefully if unavailable.
    """
    import instaloader

    loader = instaloader.Instaloader(
        download_pictures=False,
        download_videos=False,
        download_video_thumbnails=False,
        download_geotags=False,
        download_comments=False,
        save_metadata=False,
        compress_json=False,
        quiet=True,
    )

    try:
        profile = instaloader.Profile.from_username(loader.context, username)
        opportunities = []
        now = _now_iso()

        # Get profile pic
        profile_pic = str(profile.profile_pic_url) if profile.profile_pic_url else None

        # Check recent posts
        count = 0
        for post in profile.get_posts():
            if count >= 10:
                break
            count += 1

            caption = post.caption or ""
            if not _matches_opportunity_keywords(caption):
                continue

            url = f"https://instagram.com/p/{post.shortcode}"
            posted = post.date_utc.isoformat() if post.date_utc else None

            opp = Opportunity(
                id=str(uuid.uuid4()),
                title=caption[:100].replace("\n", " "),
                company=f"@{username}",
                location="Caribbean",
                pay="See post for details",
                url=url,
                category="event",
                description=caption[:200].replace("\n", " "),
                posted_at=posted,
                first_seen_at=now,
                source_name=f"instagram_{username}",
                image_url=profile_pic,
            )
            opportunities.append(opp)

        logger.info("Scraped %d opportunities from Instagram @%s", len(opportunities), username)
        return opportunities

    except Exception as e:
        logger.warning("Failed to scrape Instagram @%s: %s", username, e)
        return []


# ── Curated Caribbean opportunities database (permanent fallback) ──────────

CARIBBEAN_OPPORTUNITIES: list[dict] = [
    # ── Competitions ───────────────────────────────────────────────────────
    {
        "title": "Jamaica National Science Olympiad",
        "company": "Jamaica Science Teachers' Association",
        "location": "Jamaica",
        "pay": "Free to enter",
        "age_requirement": "High school students (ages 13-19)",
        "experience_required": "None — open to all high school students",
        "url": "https://jamaicaletters.com",
        "category": "competition",
        "description": "Annual science competition for Jamaican high school students covering biology, chemistry, physics, and earth science.",
    },
    {
        "title": "Caribbean Computing Challenge (CCC)",
        "company": "Caribbean Examination Council",
        "location": "CARICOM-wide",
        "pay": "Free to enter",
        "age_requirement": "High school students",
        "experience_required": "None — introductory level problems provided",
        "url": "https://cxc.org",
        "category": "competition",
        "description": "Programming competition for Caribbean high school students with problems ranging from beginner to advanced.",
    },
    {
        "title": "Digicel Foundation Bright Stars Challenge",
        "company": "Digicel Foundation",
        "location": "CARICOM-wide",
        "pay": "Funding for winning projects",
        "age_requirement": "Youth ages 15-25",
        "experience_required": "Social impact project idea",
        "url": "https://digicelfoundation.com",
        "category": "competition",
        "description": "Youth entrepreneurship challenge supporting social impact projects across the Caribbean.",
    },
    {
        "title": "Hackathon Caribbean",
        "company": "Community-organized",
        "location": "Various Caribbean countries",
        "pay": "Free to enter, prizes for winners",
        "age_requirement": "Ages 16+",
        "experience_required": "Basic coding skills recommended",
        "url": "https://devpost.com",
        "category": "competition",
        "description": "Regional hackathon bringing together Caribbean developers to build innovative solutions.",
    },
    {
        "title": "Jamaica Tech Hackathon",
        "company": "Jamaica Innovation Hub",
        "location": "Jamaica",
        "pay": "Prizes for top 3 teams",
        "age_requirement": "Ages 16-30",
        "experience_required": "Basic programming knowledge",
        "url": "https://devpost.com",
        "category": "competition",
        "description": "Annual hackathon in Jamaica focused on solving local challenges with technology.",
    },
    {
        "title": "Trinidad & Tobago Game Jam",
        "company": "TT Game Developers Association",
        "location": "Trinidad and Tobago",
        "pay": "Free to enter",
        "age_requirement": "All ages",
        "experience_required": "Interest in game development",
        "url": "https://itch.io/jams",
        "category": "competition",
        "description": "Game development competition where teams create games from scratch in a limited time.",
    },
    {
        "title": "Barbados Robotics Challenge",
        "company": "Barbados Robotics Club",
        "location": "Barbados",
        "pay": "Prizes and sponsorships",
        "age_requirement": "Ages 14-25",
        "experience_required": "Interest in robotics/engineering",
        "url": "",
        "category": "competition",
        "description": "Robotics competition for young Barbadians interested in engineering and automation.",
    },
    # ── Clubs & Organizations ─────────────────────────────────────────────
    {
        "title": "UWI Coding Club",
        "company": "University of the West Indies",
        "location": "UWI campuses (Jamaica, Barbados, Trinidad)",
        "pay": "Free",
        "age_requirement": "University students",
        "experience_required": "None",
        "url": "https://uwi.edu",
        "category": "club",
        "description": "Student-led coding club at UWI with workshops, projects, and networking events.",
    },
    {
        "title": "Caribbean AI & Data Science Community",
        "company": "Community-run",
        "location": "Online (Caribbean-based)",
        "pay": "Free",
        "age_requirement": "Ages 16+",
        "experience_required": "Interest in AI/data science",
        "url": "https://www.linkedin.com/groups",
        "category": "club",
        "description": "Online community for Caribbean professionals and students interested in AI and data science.",
    },
    {
        "title": "Girl Geek Dinner Caribbean",
        "company": "Girl Geek Dinner",
        "location": "Various Caribbean cities",
        "pay": "Free",
        "age_requirement": "Women and non-binary in tech",
        "experience_required": "None",
        "url": "https://girlgeekdinner.com",
        "category": "club",
        "description": "Networking events for women and non-binary people in Caribbean tech.",
    },
    {
        "title": "Jamaica Developers Community",
        "company": "Jamaica Tech Community",
        "location": "Jamaica (Kingston, Montego Bay)",
        "pay": "Free",
        "age_requirement": "Ages 16+",
        "experience_required": "Interest in software development",
        "url": "https://www.meetup.com",
        "category": "club",
        "description": "Developer meetup group for Jamaican software engineers and tech enthusiasts.",
    },
    {
        "title": "Barbados Innovation Hub",
        "company": "Barbados Entrepreneurship Foundation",
        "location": "Barbados",
        "pay": "Free membership",
        "age_requirement": "Ages 18-35",
        "experience_required": "Interest in entrepreneurship",
        "url": "",
        "category": "club",
        "description": "Innovation hub supporting young Barbadian entrepreneurs with mentorship and resources.",
    },
    {
        "title": "Trinidad Youth in Tech",
        "company": "TT Ministry of Digital Transformation",
        "location": "Trinidad and Tobago",
        "pay": "Free",
        "age_requirement": "Ages 15-25",
        "experience_required": "None",
        "url": "https://www.mdt.gov.tt",
        "category": "club",
        "description": "Government initiative connecting young Trinidadians with technology training and opportunities.",
    },
    # ── Scholarships ──────────────────────────────────────────────────────
    {
        "title": "CXC/CSEC Scholarships",
        "company": "Caribbean Examination Council",
        "location": "CARICOM-wide",
        "pay": "Full tuition scholarship",
        "age_requirement": "High school graduates",
        "experience_required": "Strong CXC/CSEC results",
        "url": "https://cxc.org",
        "category": "scholarship",
        "description": "Merit-based scholarships for Caribbean students with outstanding CSEC results.",
    },
    {
        "title": "Chevening Scholarship (Caribbean)",
        "company": "UK Government",
        "location": "UK (for Caribbean nationals)",
        "pay": "Full funding for UK Master's degree",
        "age_requirement": "Ages 18+",
        "experience_required": "Bachelor's degree, 2+ years work experience",
        "url": "https://chevening.org",
        "category": "scholarship",
        "description": "UK government scholarship for Caribbean professionals to pursue a Master's degree in the UK.",
    },
    {
        "title": "AASD Scholarship Program",
        "company": "African Academy of Sciences",
        "location": "International (Caribbean eligible)",
        "pay": "Variable",
        "age_requirement": "Graduate students",
        "experience_required": "Bachelor's degree in STEM",
        "url": "https://aasciences.africa",
        "category": "scholarship",
        "description": "STEM scholarship for graduate students including Caribbean nationals.",
    },
    {
        "title": "MIT OpenCourseWare Scholarship",
        "company": "MIT",
        "location": "Online (global)",
        "pay": "Free access to courses, certificates available",
        "age_requirement": "All ages",
        "experience_required": "Self-motivated learners",
        "url": "https://ocw.mit.edu",
        "category": "scholarship",
        "description": "Free access to MIT course materials for self-directed learners worldwide.",
    },
    {
        "title": "Google Generation Scholarship (Caribbean)",
        "company": "Google",
        "location": "Remote / Caribbean",
        "pay": "$10,000 USD scholarship",
        "age_requirement": "University students in STEM",
        "experience_required": "Enrolled in CS or related field",
        "url": "https://buildyourfuture.withgoogle.com/scholarships",
        "category": "scholarship",
        "description": "Google scholarship supporting underrepresented students in computer science.",
    },
    {
        "title": "Coursera Financial Aid",
        "company": "Coursera",
        "location": "Online (global)",
        "pay": "Free courses with financial aid",
        "age_requirement": "All ages",
        "experience_required": "None",
        "url": "https://www.coursera.org/financial-aid",
        "category": "scholarship",
        "description": "Financial aid for Coursera courses, making quality education accessible globally.",
    },
    # ── Events & Workshops ────────────────────────────────────────────────
    {
        "title": "Caribbean Tech Week",
        "company": "Community-organized",
        "location": "Various Caribbean cities",
        "pay": "Free / low-cost tickets",
        "age_requirement": "All ages",
        "experience_required": "Interest in technology",
        "url": "https://twitter.com/search?q=caribbean+tech+week",
        "category": "event",
        "description": "Annual week of tech events, talks, and networking across the Caribbean region.",
    },
    {
        "title": "WIPO Hackathon for IP (Caribbean Edition)",
        "company": "World Intellectual Property Organization",
        "location": "Online / Caribbean hubs",
        "pay": "Free to enter, prizes",
        "age_requirement": "Ages 18-35",
        "experience_required": "Innovation or business idea",
        "url": "https://wipo.int",
        "category": "event",
        "description": "Global IP hackathon with a Caribbean track, focusing on intellectual property innovation.",
    },
    {
        "title": "Jamaica UX Design Workshop",
        "company": "Jamaica Design Association",
        "location": "Jamaica",
        "pay": "Free workshop",
        "age_requirement": "Ages 16+",
        "experience_required": "Interest in design",
        "url": "",
        "category": "event",
        "description": "Hands-on UX design workshop for aspiring designers in Jamaica.",
    },
    {
        "title": "Caribbean Data Science Bootcamp",
        "company": "Data Caribbean",
        "location": "Online / Jamaica",
        "pay": "Subsidized for Caribbean residents",
        "age_requirement": "Ages 18+",
        "experience_required": "Basic Python knowledge",
        "url": "",
        "category": "event",
        "description": "Intensive data science bootcamp with subsidized pricing for Caribbean participants.",
    },
    {
        "title": "Barbados Fintech Summit",
        "company": "Barbados Fintech Association",
        "location": "Barbados",
        "pay": "Free for students",
        "age_requirement": "All ages",
        "experience_required": "Interest in fintech",
        "url": "",
        "category": "event",
        "description": "Annual fintech summit bringing together Caribbean financial technology innovators.",
    },
    # ── Volunteer / Internship ────────────────────────────────────────────
    {
        "title": "UNV Online Volunteer",
        "company": "United Nations Volunteers",
        "location": "Remote (global)",
        "pay": "Volunteer (unpaid)",
        "age_requirement": "Ages 18+",
        "experience_required": "Skills-based volunteering available",
        "url": "https://onlinevolunteering.org",
        "category": "volunteer",
        "description": "Online volunteering opportunities with UN agencies worldwide.",
    },
    {
        "title": "Code for the Caribbean Fellowship",
        "company": "Code for the Caribbean",
        "location": "Caribbean (various countries)",
        "pay": "Fellowship stipend",
        "age_requirement": "Ages 18-30",
        "experience_required": "Basic coding skills",
        "url": "https://codeforthecaribbean.org",
        "category": "volunteer",
        "description": "Fellowship placing developers with Caribbean government agencies to solve civic challenges.",
    },
    {
        "title": "Teach For Jamaica",
        "company": "Teach For All",
        "location": "Jamaica",
        "pay": "Teaching stipend",
        "age_requirement": "University graduates",
        "experience_required": "Bachelor's degree",
        "url": "https://teachforall.org",
        "category": "volunteer",
        "description": "Teaching fellowship placing graduates in underserved Jamaican schools.",
    },
    {
        "title": "Peace Corps Caribbean",
        "company": "Peace Corps",
        "location": "Dominican Republic, Jamaica, Guyana",
        "pay": "Living stipend + readjustment allowance",
        "age_requirement": "Ages 18-34",
        "experience_required": "Bachelor's degree preferred",
        "url": "https://peacecorps.gov",
        "category": "volunteer",
        "description": "Peace Corps service in Caribbean countries focusing on education and community development.",
    },
    {
        "title": "Caribbean Red Cross Youth Volunteer",
        "company": "International Red Cross",
        "location": "CARICOM-wide",
        "pay": "Volunteer (unpaid)",
        "age_requirement": "Ages 15-30",
        "experience_required": "None",
        "url": "https://icrc.org",
        "category": "volunteer",
        "description": "Youth volunteering program with Red Cross societies across the Caribbean.",
    },
    {
        "title": "Digital Jobs Africa (Caribbean Remote)",
        "company": "Global Innovation Fund",
        "location": "Remote",
        "pay": "Paid remote work",
        "age_requirement": "Ages 18-35",
        "experience_required": "Digital skills (design, dev, content)",
        "url": "",
        "category": "job",
        "description": "Remote digital work opportunities for Caribbean youth through the Global Innovation Fund.",
    },
]


def scrape_curated_list() -> list[Opportunity]:
    """Return the curated Caribbean opportunities as Opportunity objects."""
    opportunities = []
    now = _now_iso()

    for opp_data in CARIBBEAN_OPPORTUNITIES:
        salary_min, salary_max, salary_currency = _parse_salary(opp_data.get("pay", ""), source_name="curated")

        opp = Opportunity(
            id=str(uuid.uuid4()),
            title=opp_data["title"],
            company=opp_data["company"],
            location=opp_data["location"],
            pay=opp_data.get("pay", "Varies"),
            salary_min=salary_min,
            salary_max=salary_max,
            salary_currency=salary_currency,
            age_requirement=opp_data.get("age_requirement"),
            experience_required=opp_data.get("experience_required", "None"),
            url=opp_data.get("url", ""),
            category=opp_data.get("category", "event"),
            description=opp_data.get("description", ""),
            first_seen_at=now,
            source_name="curated",
            image_url=None,
        )
        opportunities.append(opp)

    logger.info("Loaded %d curated opportunities", len(opportunities))
    return opportunities


# ── LLM-powered opportunity generation ────────────────────────────────────


EXTRACTION_PROMPT = """\
You are the Job Scout for Lynks — a Caribbean career platform.

Extract opportunity information from this text. Return a JSON object:

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


def generate_opportunities_with_llm() -> list[Opportunity]:
    """Use LLM to generate current opportunities from training data."""
    cache_key = "llm_generated"
    cached = get_cached_opportunities(cache_key)
    if cached is not None:
        return [Opportunity(**o) for o in cached]

    try:
        client = OpenAI(
            api_key=settings.LLM_API_KEY,
            base_url=settings.LLM_API_BASE_URL,
        )

        response = client.chat.completions.create(
            model=settings.LLM_MODEL,
            messages=[
                {
                    "role": "system",
                    "content": EXTRACTION_PROMPT,
                },
                {
                    "role": "user",
                    "content": (
                        "Generate 5-10 current Caribbean opportunities for young people "
                        "interested in technology and career development. Return a JSON array."
                    ),
                },
            ],
            temperature=0.6,
            max_tokens=4096,
        )

        raw_content = response.choices[0].message.content.strip()
        if raw_content.startswith("```"):
            lines = raw_content.split("\n")
            lines = lines[1:]
            if lines and lines[-1].strip() == "```":
                lines = lines[:-1]
            raw_content = "\n".join(lines)

        data = json.loads(raw_content)
        if not isinstance(data, list):
            return []

        opportunities = []
        now = _now_iso()

        for item in data:
            opp = Opportunity(
                id=str(uuid.uuid4()),
                title=item.get("title", "Unknown"),
                company=item.get("company", "Unknown"),
                location=item.get("location", "Caribbean"),
                pay=item.get("pay", "See details"),
                salary_min=item.get("salary_min"),
                salary_max=item.get("salary_max"),
                salary_currency=item.get("salary_currency"),
                age_requirement=item.get("age_requirement"),
                experience_required=item.get("experience_required", "None"),
                url=item.get("url", ""),
                category=item.get("category", "event"),
                description=item.get("description", ""),
                posted_at=item.get("posted_at"),
                first_seen_at=now,
                source_name="llm_generated",
                image_url=item.get("image_url"),
            )
            opportunities.append(opp)

        logger.info("Generated %d opportunities with LLM", len(opportunities))
        set_cached_opportunities(cache_key, [o.to_dict() for o in opportunities])
        return opportunities

    except Exception as e:
        logger.warning("LLM opportunity generation failed: %s", e)
        return []


# ── Main scrape function ──────────────────────────────────────────────────


async def scrape_opportunities() -> list[dict]:
    """Scrape opportunities from ALL sources.

    Returns a combined, deduplicated list.
    Each source fails independently — the curated list is always available as fallback.
    """
    all_opportunities: list[Opportunity] = []

    # 1. Curated list (always available — permanent safety net)
    curated = scrape_curated_list()
    all_opportunities.extend(curated)
    logger.info("Curated: %d opportunities", len(curated))

    # 2. Devpost hackathons
    devpost = scrape_devpost_hackathons()
    all_opportunities.extend(devpost)
    logger.info("Devpost: %d opportunities", len(devpost))

    # 3. Eventbrite events
    eventbrite = scrape_eventbrite_caribbean()
    all_opportunities.extend(eventbrite)
    logger.info("Eventbrite: %d opportunities", len(eventbrite))

    # 4. RSS feeds
    rss = await scrape_all_rss_feeds()
    all_opportunities.extend(rss)
    logger.info("RSS feeds: %d opportunities", len(rss))

    # 5. Social media (stretch — each source fails independently)
    social = await scrape_all_social_media()
    all_opportunities.extend(social)
    logger.info("Social media: %d opportunities", len(social))

    # 6. LLM-generated (supplement)
    llm = generate_opportunities_with_llm()
    all_opportunities.extend(llm)
    logger.info("LLM generated: %d opportunities", len(llm))

    # Deduplicate by title (case-insensitive)
    seen_titles: set[str] = set()
    unique: list[dict] = []
    for opp in all_opportunities:
        title_key = opp.title.lower().strip()
        if title_key and title_key not in seen_titles:
            seen_titles.add(title_key)
            unique.append(opp.to_dict())

    logger.info("Total unique opportunities scraped: %d", len(unique))
    return unique


# ── CLI runner ─────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import asyncio

    logging.basicConfig(level=logging.INFO)
    opportunities = asyncio.run(scrape_opportunities())
    print(f"\nScraped {len(opportunities)} opportunities:\n")
    for opp in opportunities:
        print(f"  [{opp.get('category')}] {opp.get('title')} — {opp.get('location')} (source: {opp.get('source_name')})")
