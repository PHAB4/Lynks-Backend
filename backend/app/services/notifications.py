"""
Notification service — handles all notification operations.
"""

from datetime import datetime, timedelta, timezone
from sqlalchemy import select, func, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.db_models import Notification


async def get_notifications(
    db: AsyncSession,
    user_id: str,
    notification_type: str | None = None,
    is_read: bool | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[Notification]:
    """Get notifications for a user with optional filters."""
    query = select(Notification).where(Notification.user_id == user_id)

    if notification_type:
        query = query.where(Notification.type == notification_type)
    if is_read is not None:
        query = query.where(Notification.is_read == is_read)

    query = query.order_by(Notification.created_at.desc()).offset(offset).limit(limit)
    result = await db.execute(query)
    return list(result.scalars().all())


async def get_notification_by_id(
    db: AsyncSession,
    notification_id: str,
    user_id: str,
) -> Notification | None:
    """Get a specific notification by ID."""
    result = await db.execute(
        select(Notification).where(
            Notification.id == notification_id,
            Notification.user_id == user_id,
        )
    )
    return result.scalar_one_or_none()


async def get_unread_count(db: AsyncSession, user_id: str) -> int:
    """Get count of unread notifications."""
    result = await db.execute(
        select(func.count(Notification.id)).where(
            Notification.user_id == user_id,
            ~Notification.is_read,
        )
    )
    return result.scalar() or 0


async def create_notification(
    db: AsyncSession,
    user_id: str,
    title: str,
    body: str | None = None,
    notification_type: str = "reminder",
    link: dict | str | None = None,
) -> Notification:
    """Create a new notification."""
    notification = Notification(
        user_id=user_id,
        title=title,
        body=body,
        type=notification_type,
        link=link,
    )
    db.add(notification)
    await db.commit()
    await db.refresh(notification)
    return notification


async def mark_as_read(db: AsyncSession, notification_id: str, user_id: str) -> bool:
    """Mark a notification as read."""
    result = await db.execute(
        select(Notification).where(
            Notification.id == notification_id,
            Notification.user_id == user_id,
        )
    )
    notification = result.scalar_one_or_none()
    if not notification:
        return False

    notification.is_read = True
    await db.commit()
    return True


async def mark_all_as_read(db: AsyncSession, user_id: str) -> int:
    """Mark all notifications as read. Returns count of updated notifications."""
    result = await db.execute(
        update(Notification)
        .where(
            Notification.user_id == user_id,
            ~Notification.is_read,
        )
        .values(is_read=True)
    )
    await db.commit()
    return result.rowcount  # type: ignore[attr-defined]


# ── Notification Triggers ────────────────────────────────────────────────
# These functions are called from other services to create notifications.


async def create_opportunity_notification(
    db: AsyncSession,
    user_id: str,
    opportunity_title: str,
    opportunity_id: str,
) -> Notification | None:
    """Create notification for a new matching opportunity."""
    yesterday = datetime.now(tz=timezone.utc) - timedelta(hours=24)
    result = await db.execute(
        select(Notification).where(
            Notification.user_id == user_id,
            Notification.type == "opportunity",
            Notification.created_at >= yesterday,
        )
    )
    existing = result.scalars().all()

    for n in existing:
        if opportunity_title.lower() in (n.title or "").lower():
            return None

    return await create_notification(
        db,
        user_id=user_id,
        title=f"New opportunity: {opportunity_title}",
        body="A new opportunity matching your profile has been found.",
        notification_type="opportunity",
        link={"type": "opportunity", "id": opportunity_id},
    )


async def create_task_notification(
    db: AsyncSession,
    user_id: str,
    task_title: str,
    task_id: str,
    message: str,
) -> Notification:
    """Create notification for task-related events (milestones, reminders)."""
    return await create_notification(
        db,
        user_id=user_id,
        title=task_title,
        body=message,
        notification_type="task",
        link={"type": "task", "id": task_id},
    )


async def create_reminder_notification(
    db: AsyncSession,
    user_id: str,
    title: str,
    message: str,
) -> Notification:
    """Create a general reminder notification."""
    return await create_notification(
        db,
        user_id=user_id,
        title=title,
        body=message,
        notification_type="reminder",
    )


async def create_badge_notification(
    db: AsyncSession,
    user_id: str,
    badge_name: str,
    badge_id: str,
) -> Notification:
    """Create notification when a badge is earned."""
    return await create_notification(
        db,
        user_id=user_id,
        title=f"Badge earned: {badge_name}",
        body=f"Congratulations! You've earned the '{badge_name}' badge.",
        notification_type="badge",
        link={"type": "badge", "id": badge_id},
    )
