"""
Notification routes — list, get, mark read, create.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user_id
from app.db.postgres import get_db
from app.models.schemas import NotificationCreate, NotificationResponse, NotificationListResponse
from app.services.notifications import (
    get_notifications,
    get_notification_by_id,
    get_unread_count,
    create_notification,
    mark_as_read,
    mark_all_as_read,
)

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("", response_model=NotificationListResponse)
async def list_notifications(
    type: str | None = Query(None, description="Filter by notification type"),
    is_read: bool | None = Query(None, description="Filter by read status"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """List all notifications for the current user."""
    notifications = await get_notifications(
        db, user_id, notification_type=type, is_read=is_read, limit=limit, offset=offset
    )
    unread = await get_unread_count(db, user_id)
    return NotificationListResponse(
        notifications=[
            NotificationResponse(
                id=n.id,
                title=n.title,
                body=n.body,
                type=n.type,
                link=n.link,
                is_read=n.is_read,
                created_at=n.created_at,
            )
            for n in notifications
        ],
        unread_count=unread,
    )


@router.get("/unread/count")
async def unread_count(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Get count of unread notifications (for badge)."""
    count = await get_unread_count(db, user_id)
    return {"unread_count": count}


@router.get("/{notification_id}", response_model=NotificationResponse)
async def get_notification(
    notification_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Get a specific notification."""
    notification = await get_notification_by_id(db, notification_id, user_id)
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    return NotificationResponse(
        id=notification.id,
        title=notification.title,
        body=notification.body,
        type=notification.type,
        link=notification.link,
        is_read=notification.is_read,
        created_at=notification.created_at,
    )


@router.post("", response_model=NotificationResponse, status_code=201)
async def create_new_notification(
    data: NotificationCreate,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Create a new notification (for admin/utility use)."""
    notification = await create_notification(
        db,
        user_id=user_id,
        title=data.title,
        body=data.body,
        notification_type=data.type,
        link=data.link,
    )
    return NotificationResponse(
        id=notification.id,
        title=notification.title,
        body=notification.body,
        type=notification.type,
        link=notification.link,
        is_read=notification.is_read,
        created_at=notification.created_at,
    )


@router.patch("/{notification_id}/read")
async def mark_notification_read(
    notification_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Mark a notification as read."""
    success = await mark_as_read(db, notification_id, user_id)
    if not success:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"status": "ok", "message": "Notification marked as read"}


@router.post("/read-all")
async def mark_all_read(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Mark all notifications as read."""
    count = await mark_all_as_read(db, user_id)
    return {"status": "ok", "message": f"Marked {count} notifications as read"}
