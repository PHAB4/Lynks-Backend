"""Opportunity Scraper — pulls Caribbean opportunities from the internet."""
from __future__ import annotations
import json
import logging
import re
from datetime import datetime, timezone
from openai import OpenAI
from app.core.config import settings

logger = logging.getLogger(__name__)


def scrape_devpost_hackathons() -> list[dict]:
    try:
        import urllib.request
        url = "https://devpost.com/api/hackathons"
        req = urllib.request.Request(url, headers={"User-Agent": "Lynks/1.0"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read())
        opportunities = []
        for h in data.get("hackathons", [])[:20]:
            if "caribbean" in h.get("name", "").lower() or "jamaica" in h.get("location", "").lower():
                opportunities.append({"title": h["name"], "company": h.get("organization", "Devpost"), "location": h.get("location", "Online"), "category": "competition", "url": h.get("url", "")})
        return opportunities
    except Exception as e:
        logger.warning("Devpost scrape failed: %s", e)
        return []


def generate_llm_opportunities() -> list[dict]:
    try:
        client = OpenAI(api_key=settings.LLM_API_KEY, base_url=settings.LLM_API_BASE_URL)
        result = client.chat.completions.create(
            model=settings.LLM_MODEL,
            messages=[
                {"role": "system", "content": "List current Caribbean tech opportunities for youth. Return JSON array: [{\"title\": \"...\", \"company\": \"...\", \"location\": \"...\", \"category\": \"competition|job|club|scholarship|event|volunteer\", \"url\": \"...\"}]"},
                {"role": "user", "content": "List 10 current Caribbean opportunities for young people interested in technology."}
            ],
            temperature=0.7,
            max_tokens=2048,
        )
        text = result.choices[0].message.content or "[]"
        return json.loads(text)
    except Exception as e:
        logger.warning("LLM opportunity generation failed: %s", e)
        return []


def scrape_all() -> list[dict]:
    all_opps = []
    all_opps.extend(scrape_devpost_hackathons())
    all_opps.extend(generate_llm_opportunities())
    return all_opps