"""
Notification service for scheduled scraping — generates notifications
when new opportunities are discovered.
"""

from __future__ import annotations

import hashlib
import logging

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


async def generate_scrape_notifications(
    db: AsyncSession,
    opportunities: list[dict],
) -> int:
    """Generate notifications for users when new opportunities are found.

    Checks which opportunities are new (first_seen_at within last 15 minutes)
    and creates a summary notification for each active user.

    Returns the number of notifications created.
    """
    now_text = text("SELECT now() AT TIME ZONE 'utc'")
    result = await db.execute(now_text)
    now = result.scalar()

    if now is None:
        return 0

    # Find opportunities scraped in the last 15 minutes (new from this scrape)
    new_opps = []
    for opp in opportunities:
        first_seen = opp.get("first_seen_at")
        if not first_seen:
            continue
        try:
            from datetime import datetime, timezone
            seen_dt = datetime.fromisoformat(first_seen.replace("Z", "+00:00"))
            if (now - seen_dt).total_seconds() < 900:
                new_opps.append(opp)
        except (ValueError, TypeError):
            continue

    if not new_opps:
        return 0

    # Count by category
    categories: dict[str, list[str]] = {}
    for opp in new_opps:
        cat = opp.get("category", "event")
        title = opp.get("title", "New opportunity")
        categories.setdefault(cat, []).append(title)

    # Build summary message
    total = len(new_opps)
    cat_summary = ", ".join(f"{len(titles)} {cat}" for cat, titles in categories.items())
    summary_body = f"{total} new opportunities found: {cat_summary}"

    # Get all active users (users who have logged in at least once)
    users_result = await db.execute(text("SELECT DISTINCT user_id FROM notifications LIMIT 1000"))
    user_ids = [row[0] for row in users_result.fetchall()]

    # Also get users from the users table if notifications table is empty
    if not user_ids:
        try:
            users_result = await db.execute(text("SELECT id FROM users LIMIT 1000"))
            user_ids = [row[0] for row in users_result.fetchall()]
        except Exception:
            pass

    if not user_ids:
        return 0

    from app.services.notifications import create_notification

    count = 0
    for user_id in user_ids:
        try:
            await create_notification(
                db,
                user_id=user_id,
                title=f"🔍 {total} New Opportunities",
                body=summary_body,
                notification_type="opportunity_scrape",
                link="/opportunities",
            )
            count += 1
        except Exception as e:
            logger.warning("Failed to create notification for user %s: %s", user_id, e)

    logger.info("Created %d scrape notifications for %d users", count, len(user_ids))
    return count
