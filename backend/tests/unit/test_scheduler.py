"""Unit tests for the opportunity scheduler service."""

from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, patch, MagicMock

import pytest

from app.services.scheduler import OpportunityScheduler, get_scheduler, create_scheduler


class TestOpportunityScheduler:
    """Tests for the OpportunityScheduler class."""

    def test_init_defaults(self):
        scheduler = OpportunityScheduler()
        assert scheduler.interval_seconds == 6 * 60 * 60
        assert scheduler._running is False
        assert scheduler.total_runs == 0
        assert scheduler.last_run_status == "never"

    def test_init_custom_interval(self):
        scheduler = OpportunityScheduler(interval_seconds=300)
        assert scheduler.interval_seconds == 300

    def test_get_status_not_running(self):
        scheduler = OpportunityScheduler()
        status = scheduler.get_status()
        assert status["running"] is False
        assert status["interval_hours"] == 6.0
        assert status["total_runs"] == 0
        assert status["last_run_status"] == "never"
        assert status["last_run_at"] is None
        assert status["started_at"] is None

    def test_singleton_get_scheduler(self):
        s1 = create_scheduler(interval_seconds=100)
        s2 = get_scheduler()
        assert s1 is s2
        assert s1.interval_seconds == 100

    @pytest.mark.asyncio
    async def test_do_scrape_success(self):
        scheduler = OpportunityScheduler(interval_seconds=60)

        mock_opportunities = [
            {"title": "Hack Jamaica", "source_name": "devpost_api", "first_seen_at": "2026-09-05T12:00:00+00:00"},
            {"title": "UWI Scholarship", "source_name": "curated", "first_seen_at": "2026-09-05T12:00:00+00:00"},
        ]

        with (
            patch("app.agents.opportunity_scraper.scrape_opportunities", new_callable=AsyncMock, return_value=mock_opportunities),
            patch("app.db.postgres.async_session") as mock_session_cls,
            patch("app.services.notification_service.generate_scrape_notifications", new_callable=AsyncMock, return_value=2),
        ):
            mock_session = AsyncMock()
            mock_session_cls.return_value.__aenter__ = AsyncMock(return_value=mock_session)
            mock_session_cls.return_value.__aexit__ = AsyncMock(return_value=False)

            await scheduler._do_scrape()

        assert scheduler.last_run_status == "ok"
        assert scheduler.last_run_count == 2
        assert scheduler.total_runs == 1
        assert scheduler.total_opportunities_scraped == 2
        assert "devpost_api" in scheduler.last_run_sources
        assert "curated" in scheduler.last_run_sources
        assert scheduler.last_error is None

    @pytest.mark.asyncio
    async def test_do_scrape_error(self):
        scheduler = OpportunityScheduler(interval_seconds=60)

        with patch(
            "app.agents.opportunity_scraper.scrape_opportunities",
            new_callable=AsyncMock,
            side_effect=RuntimeError("Network timeout"),
        ):
            await scheduler._do_scrape()

        assert scheduler.last_run_status == "error"
        assert scheduler.last_run_count == 0
        assert scheduler.total_runs == 1
        assert "Network timeout" in scheduler.last_error

    @pytest.mark.asyncio
    async def test_do_scrape_notification_failure_does_not_crash(self):
        scheduler = OpportunityScheduler(interval_seconds=60)

        mock_opportunities = [
            {"title": "Test", "source_name": "test", "first_seen_at": "2026-09-05T12:00:00+00:00"},
        ]

        with (
            patch("app.agents.opportunity_scraper.scrape_opportunities", new_callable=AsyncMock, return_value=mock_opportunities),
            patch("app.db.postgres.async_session") as mock_session_cls,
            patch("app.services.notification_service.generate_scrape_notifications", new_callable=AsyncMock, side_effect=RuntimeError("DB down")),
        ):
            mock_session = AsyncMock()
            mock_session_cls.return_value.__aenter__ = AsyncMock(return_value=mock_session)
            mock_session_cls.return_value.__aexit__ = AsyncMock(return_value=False)

            # Should NOT raise — notification failure is caught
            await scheduler._do_scrape()

        assert scheduler.last_run_status == "ok"
        assert scheduler.last_run_count == 1

    @pytest.mark.asyncio
    async def test_start_stop(self):
        scheduler = OpportunityScheduler(interval_seconds=9999)

        scheduler.start()
        assert scheduler._running is True
        assert scheduler.started_at is not None
        assert scheduler._task is not None

        await scheduler.stop()
        assert scheduler._running is False

    def test_status_after_error(self):
        scheduler = OpportunityScheduler()
        scheduler.last_run_status = "error"
        scheduler.last_error = "Connection refused"
        scheduler.total_runs = 5

        status = scheduler.get_status()
        assert status["last_run_status"] == "error"
        assert status["last_error"] == "Connection refused"
        assert status["total_runs"] == 5
