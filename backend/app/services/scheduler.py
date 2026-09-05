"""
Background Opportunity Scheduler — periodic scraping of Caribbean opportunities.

Runs as an asyncio background task during the FastAPI app lifecycle.
No external dependencies (APScheduler, Celery) — just stdlib asyncio.

Features:
- Configurable interval (default: every 6 hours)
- Tracks last run, next run, total runs, and errors
- Generates notifications when new opportunities are found
- Graceful startup/shutdown with the FastAPI lifespan
"""

from __future__ import annotations

import asyncio
import logging
import time
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

# Default scrape interval: 6 hours
DEFAULT_INTERVAL_SECONDS = 6 * 60 * 60

_scheduler_instance: OpportunityScheduler | None = None


class OpportunityScheduler:
    """Manages periodic background opportunity scraping."""

    def __init__(self, interval_seconds: int = DEFAULT_INTERVAL_SECONDS):
        self.interval_seconds = interval_seconds
        self._task: asyncio.Task | None = None
        self._running = False

        # Status tracking
        self.last_run_at: str | None = None
        self.last_run_status: str = "never"
        self.last_run_count: int = 0
        self.last_run_sources: list[str] = []
        self.last_error: str | None = None
        self.total_runs: int = 0
        self.total_opportunities_scraped: int = 0
        self.started_at: str | None = None

    def start(self) -> None:
        """Start the background scheduler task."""
        if self._running:
            logger.warning("Scheduler already running")
            return

        self._running = True
        self.started_at = datetime.now(timezone.utc).isoformat()
        self._task = asyncio.create_task(self._run_loop())
        logger.info("Opportunity scheduler started (interval: %ds)", self.interval_seconds)

    async def stop(self) -> None:
        """Gracefully stop the background scheduler."""
        self._running = False
        if self._task and not self._task.done():
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        logger.info("Opportunity scheduler stopped")

    def get_status(self) -> dict:
        """Return current scheduler status."""
        now = datetime.now(timezone.utc)
        next_run = None
        if self.last_run_at and self._running:
            try:
                last_dt = datetime.fromisoformat(self.last_run_at)
                next_dt = last_dt.timestamp() + self.interval_seconds
                next_run = datetime.fromtimestamp(next_dt, tz=timezone.utc).isoformat()
            except (ValueError, OSError):
                pass

        return {
            "running": self._running,
            "interval_hours": self.interval_seconds / 3600,
            "started_at": self.started_at,
            "last_run_at": self.last_run_at,
            "last_run_status": self.last_run_status,
            "last_run_count": self.last_run_count,
            "last_run_sources": self.last_run_sources,
            "last_error": self.last_error,
            "next_run_at": next_run,
            "total_runs": self.total_runs,
            "total_opportunities_scraped": self.total_opportunities_scraped,
        }

    async def _run_loop(self) -> None:
        """Main loop — runs scrape at configured interval."""
        # Wait 30 seconds after startup before first scrape (let the app settle)
        await asyncio.sleep(30)

        while self._running:
            await self._do_scrape()
            await asyncio.sleep(self.interval_seconds)

    async def _do_scrape(self) -> None:
        """Execute a single scrape cycle."""
        logger.info("Starting scheduled opportunity scrape...")
        start_time = time.time()

        try:
            from app.agents.opportunity_scraper import scrape_opportunities
            from app.db.postgres import async_session
            from app.services.notification_service import generate_scrape_notifications

            opportunities = await scrape_opportunities()
            elapsed = round(time.time() - start_time, 1)
            sources = list({o.get("source_name", "unknown") for o in opportunities})

            self.last_run_at = datetime.now(timezone.utc).isoformat()
            self.last_run_status = "ok"
            self.last_run_count = len(opportunities)
            self.last_run_sources = sources
            self.last_error = None
            self.total_runs += 1
            self.total_opportunities_scraped += len(opportunities)

            logger.info(
                "Scheduled scrape complete: %d opportunities from %s (%.1fs)",
                len(opportunities),
                sources,
                elapsed,
            )

            # Generate notifications for new opportunities (if DB is available)
            try:
                async with async_session() as db:
                    await generate_scrape_notifications(db, opportunities)
                    await db.commit()
            except Exception as e:
                logger.warning("Failed to generate scrape notifications: %s", e)

        except Exception as e:
            elapsed = round(time.time() - start_time, 1)
            self.last_run_at = datetime.now(timezone.utc).isoformat()
            self.last_run_status = "error"
            self.last_run_count = 0
            self.last_run_sources = []
            self.last_error = str(e)
            self.total_runs += 1
            logger.error("Scheduled scrape failed after %.1fs: %s", elapsed, e)


def get_scheduler() -> OpportunityScheduler:
    """Get or create the singleton scheduler instance."""
    global _scheduler_instance
    if _scheduler_instance is None:
        _scheduler_instance = OpportunityScheduler()
    return _scheduler_instance


def create_scheduler(interval_seconds: int = DEFAULT_INTERVAL_SECONDS) -> OpportunityScheduler:
    """Create a fresh scheduler instance (for testing or custom intervals)."""
    global _scheduler_instance
    _scheduler_instance = OpportunityScheduler(interval_seconds=interval_seconds)
    return _scheduler_instance
