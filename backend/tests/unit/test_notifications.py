"""
Lynks Backend — Notification Unit Tests

Tests the notification service layer in isolation using a mocked
database session. These tests verify CRUD operations, filtering,
and edge cases without requiring a live database.

Run: python -m pytest tests/unit/test_notifications.py -v
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.models.db_models import Notification
from app.services.notifications import (
    get_notifications,
    get_notification_by_id,
    get_unread_count,
    create_notification,
    mark_as_read,
    mark_all_as_read,
    create_opportunity_notification,
)


# ── Helpers ──────────────────────────────────────────────────────────────────


def _make_notification(
    *,
    user_id: str = "user-123",
    title: str = "Test notification",
    body: str = "Test body",
    notification_type: str = "info",
    is_read: bool = False,
    link: dict | str | None = None,
    created_at: datetime | None = None,
) -> Notification:
    """Create a Notification instance with sensible defaults."""
    return Notification(
        id=str(uuid.uuid4()),
        user_id=user_id,
        title=title,
        body=body,
        type=notification_type,
        is_read=is_read,
        link=link,
        created_at=created_at or datetime.now(tz=timezone.utc),
    )


def _mock_db(scalars_result=None, scalar_result=None, rowcount: int = 0):
    """Build a mock AsyncSession that returns the given results."""
    db = AsyncMock()
    mock_result = MagicMock()

    if scalars_result is not None:
        mock_result.scalars.return_value.all.return_value = scalars_result
    if scalar_result is not None:
        mock_result.scalar.return_value = scalar_result

    mock_result.rowcount = rowcount
    db.execute.return_value = mock_result
    return db


# ══════════════════════════════════════════════════════════════════════════════
#  1. get_notifications
# ══════════════════════════════════════════════════════════════════════════════


class TestGetNotifications:
    """Tests for get_notifications() — list with optional filters."""

    @pytest.mark.asyncio
    async def test_returns_list_of_notifications(self):
        notif = _make_notification()
        db = _mock_db(scalars_result=[notif])
        result = await get_notifications(db, "user-123")
        assert len(result) == 1
        assert result[0].title == "Test notification"

    @pytest.mark.asyncio
    async def test_returns_empty_list(self):
        db = _mock_db(scalars_result=[])
        result = await get_notifications(db, "user-123")
        assert result == []

    @pytest.mark.asyncio
    async def test_passes_type_filter(self):
        db = _mock_db(scalars_result=[])
        await get_notifications(db, "user-123", notification_type="opportunity")
        # Should not raise — just verify it executed
        db.execute.assert_called_once()

    @pytest.mark.asyncio
    async def test_passes_is_read_filter(self):
        db = _mock_db(scalars_result=[])
        await get_notifications(db, "user-123", is_read=False)
        db.execute.assert_called_once()

    @pytest.mark.asyncio
    async def test_passes_limit_and_offset(self):
        db = _mock_db(scalars_result=[])
        await get_notifications(db, "user-123", limit=10, offset=20)
        db.execute.assert_called_once()


# ══════════════════════════════════════════════════════════════════════════════
#  2. get_notification_by_id
# ══════════════════════════════════════════════════════════════════════════════


class TestGetNotificationById:
    """Tests for get_notification_by_id() — single notification lookup."""

    @pytest.mark.asyncio
    async def test_returns_notification(self):
        notif = _make_notification()
        db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = notif
        db.execute.return_value = mock_result
        result = await get_notification_by_id(db, notif.id, "user-123")
        assert result is not None
        assert result.title == "Test notification"

    @pytest.mark.asyncio
    async def test_returns_none_when_not_found(self):
        db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        db.execute.return_value = mock_result
        result = await get_notification_by_id(db, "nonexistent-id", "user-123")
        assert result is None


# ══════════════════════════════════════════════════════════════════════════════
#  3. get_unread_count
# ══════════════════════════════════════════════════════════════════════════════


class TestGetUnreadCount:
    """Tests for get_unread_count() — badge count."""

    @pytest.mark.asyncio
    async def test_returns_count(self):
        db = _mock_db(scalar_result=5)
        result = await get_unread_count(db, "user-123")
        assert result == 5

    @pytest.mark.asyncio
    async def test_returns_zero_when_none(self):
        db = _mock_db(scalar_result=0)
        result = await get_unread_count(db, "user-123")
        assert result == 0

    @pytest.mark.asyncio
    async def test_returns_zero_when_none_returns_none(self):
        db = _mock_db(scalar_result=None)
        result = await get_unread_count(db, "user-123")
        assert result == 0


# ══════════════════════════════════════════════════════════════════════════════
#  4. create_notification
# ══════════════════════════════════════════════════════════════════════════════


class TestCreateNotification:
    """Tests for create_notification() — insert and return."""

    @pytest.mark.asyncio
    async def test_creates_notification(self):
        db = AsyncMock()
        result = await create_notification(
            db, user_id="user-123", title="New alert", body="Something happened"
        )
        assert result.title == "New alert"
        assert result.body == "Something happened"
        assert result.type == "reminder"  # default
        db.add.assert_called_once()
        db.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_creates_with_custom_type(self):
        db = AsyncMock()
        result = await create_notification(
            db, user_id="user-123", title="Alert", notification_type="opportunity"
        )
        assert result.type == "opportunity"

    @pytest.mark.asyncio
    async def test_creates_with_link(self):
        db = AsyncMock()
        link = {"type": "opportunity", "id": "opp-456"}
        result = await create_notification(
            db, user_id="user-123", title="Alert", link=link
        )
        assert result.link == link


# ══════════════════════════════════════════════════════════════════════════════
#  5. mark_as_read
# ══════════════════════════════════════════════════════════════════════════════


class TestMarkAsRead:
    """Tests for mark_as_read() — mark single notification read."""

    @pytest.mark.asyncio
    async def test_marks_read(self):
        notif = _make_notification(is_read=False)
        db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = notif
        db.execute.return_value = mock_result
        result = await mark_as_read(db, notif.id, "user-123")
        assert result is True
        assert notif.is_read is True
        db.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_returns_false_when_not_found(self):
        db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        db.execute.return_value = mock_result
        result = await mark_as_read(db, "nonexistent", "user-123")
        assert result is False


# ══════════════════════════════════════════════════════════════════════════════
#  6. mark_all_as_read
# ══════════════════════════════════════════════════════════════════════════════


class TestMarkAllAsRead:
    """Tests for mark_all_as_read() — bulk mark read."""

    @pytest.mark.asyncio
    async def test_returns_count(self):
        db = _mock_db(rowcount=3)
        result = await mark_all_as_read(db, "user-123")
        assert result == 3
        db.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_returns_zero_when_nothing_to_mark(self):
        db = _mock_db(rowcount=0)
        result = await mark_all_as_read(db, "user-123")
        assert result == 0


# ══════════════════════════════════════════════════════════════════════════════
#  7. create_opportunity_notification (trigger function)
# ══════════════════════════════════════════════════════════════════════════════


class TestCreateOpportunityNotification:
    """Tests for create_opportunity_notification() — dedup + create."""

    @pytest.mark.asyncio
    async def test_creates_when_no_existing(self):
        """Should create when no similar notification exists."""
        db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = []
        db.execute.return_value = mock_result
        result = await create_opportunity_notification(
            db, "user-123", "Software Engineer at Acme", "opp-1"
        )
        assert result is not None
        assert "Software Engineer at Acme" in result.title

    @pytest.mark.asyncio
    async def test_skips_when_duplicate_exists(self):
        """Should return None when a notification with the same title exists within 24h."""
        existing = _make_notification(
            title="New opportunity: Software Engineer at Acme",
            notification_type="opportunity",
        )
        db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = [existing]
        db.execute.return_value = mock_result
        result = await create_opportunity_notification(
            db, "user-123", "Software Engineer at Acme", "opp-1"
        )
        assert result is None
