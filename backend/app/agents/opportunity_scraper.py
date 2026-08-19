"""
Opportunity Scraper — pulls Caribbean-relevant opportunities from the internet.

Sources:
  1. Devpost API (hackathons)
  2. Eventbrite (Caribbean events)
  3. LLM-powered opportunity generation from current knowledge

Usage:
  python -m backend.app.agents.opportunity_scraper

Or call scrape_opportunities() from a scheduled task.
"""

from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime, timezone

import httpx
from openai import OpenAI

from backend.app.core.config import settings

logger = logging.getLogger(__name__)


def scrape_devpost_hackathons() -> list[dict]:
    """Pull hackathons from Devpost API. Free, no API key needed."""
    try:
        response = httpx.get(
            "https://devpost.com/api/hackathons",
            params={"status": "upcoming", "per_page": 20},
            timeout=15,
        )
        response.raise_for_status()
        data = response.json()

        hackathons = []
        for h in data.get("hackathons", []):
            hackathons.append({
                "title": h.get("name", ""),
                "company": "Devpost",
                "location": h.get("location", "") or "Online",
                "pay": "Free to enter" if h.get("free") else "Check event details",
                "age_requirement": "Ages 16+",
                "experience_required": "Basic coding skills",
                "url": h.get("url", "https://devpost.com"),
                "category": "competition",
                "source": "devpost",
                "deadline": h.get("deadline"),
            })

        logger.info("Scraped %d hackathons from Devpost", len(hackathons))
        return hackathons
    except Exception as e:
        logger.warning("Failed to scrape Devpost: %s", e)
        return []


def scrape_eventbrite_caribbean() -> list[dict]:
    """Pull tech events from Eventbrite public search. Free, no API key needed."""
    try:
        caribbean_queries = [
            "technology event Jamaica",
            "tech event Barbados",
            "hackathon Trinidad",
            "coding workshop Caribbean",
            "STEM event Caribbean",
        ]

        events = []
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
                    events.append({
                        "title": event.get("name", ""),
                        "company": "Eventbrite",
                        "location": event.get("location", {}).get("address", "Caribbean"),
                        "pay": "Free" if event.get("is_free") else "Check event",
                        "age_requirement": "Ages 16+",
                        "experience_required": "Interest in topic",
                        "url": event.get("url", "https://eventbrite.com"),
                        "category": "event",
                        "source": "eventbrite",
                    })

        logger.info("Scraped %d events from Eventbrite", len(events))
        return events
    except Exception as e:
        logger.warning("Failed to scrape Eventbrite: %s", e)
        return []


SYSTEM_PROMPT = """\
You are the Job Scout for Lynks — a Caribbean career platform.
Generate 5-10 current, real opportunities for Caribbean young people.
Focus on competitions, scholarships, clubs, workshops, and events.
Return a JSON array with fields: title, company, location, pay, age_requirement,
experience_required, url, category.
Return ONLY the JSON array.
"""


def generate_opportunities_with_llm() -> list[dict]:
    """Use LLM to generate current opportunities as a supplement to scraping."""
    try:
        client = OpenAI(api_key=settings.LLM_API_KEY, base_url=settings.LLM_API_BASE_URL)
        response = client.chat.completions.create(
            model=settings.LLM_MODEL,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": "Generate 5-10 current Caribbean opportunities for young people interested in technology."},
            ],
            temperature=0.6,
            max_tokens=4096,
        )
        raw_content = response.choices[0].message.content.strip()
        if raw_content.startswith("```"):
            lines = raw_content.split("\n")[1:]
            if lines and lines[-1].strip() == "```":
                lines = lines[:-1]
            raw_content = "\n".join(lines)
        data = json.loads(raw_content)
        return data if isinstance(data, list) else []
    except Exception as e:
        logger.warning("LLM opportunity generation failed: %s", e)
        return []


def scrape_opportunities() -> list[dict]:
    """Scrape opportunities from all sources. Returns deduplicated list."""
    all_opportunities = []

    all_opportunities.extend(scrape_devpost_hackathons())
    all_opportunities.extend(scrape_eventbrite_caribbean())
    for opp in generate_opportunities_with_llm():
        opp["source"] = "llm_generated"
        all_opportunities.append(opp)

    # Deduplicate by title
    seen_titles = set()
    unique = []
    for opp in all_opportunities:
        title_key = opp.get("title", "").lower().strip()
        if title_key and title_key not in seen_titles:
            seen_titles.add(title_key)
            opp["id"] = str(uuid.uuid4())
            opp["scraped_at"] = datetime.now(timezone.utc).isoformat()
            unique.append(opp)

    logger.info("Total unique opportunities scraped: %d", len(unique))
    return unique


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    opportunities = scrape_opportunities()
    print(f"\nScraped {len(opportunities)} opportunities:\n")
    for opp in opportunities:
        print(f"  [{opp.get('category')}] {opp.get('title')} — {opp.get('location')}")