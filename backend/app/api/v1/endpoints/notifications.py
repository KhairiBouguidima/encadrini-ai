from fastapi import APIRouter, Depends, Query
from beanie import PydanticObjectId

from app.models.user import User
from app.models.notification import Notification
from app.api.deps import get_current_user
from app.schemas.notification import NotificationResponse, NotificationListResponse

router = APIRouter()


@router.get("/", response_model=NotificationListResponse)
async def list_notifications(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=50),
    current_user: User = Depends(get_current_user),
):
    """Paginated notifications for the current user, newest first."""
    base_query = Notification.find(Notification.user_id == current_user.id)

    total = await base_query.count()
    unread_count = await Notification.find(
        Notification.user_id == current_user.id,
        Notification.is_read == False,
    ).count()

    skip = (page - 1) * page_size
    notifs = await (
        Notification.find(Notification.user_id == current_user.id)
        .sort("-created_at")
        .skip(skip)
        .limit(page_size)
        .to_list()
    )

    return NotificationListResponse(
        notifications=[
            NotificationResponse(
                id=str(n.id),
                type=n.type.value,
                title=n.title,
                message=n.message,
                is_read=n.is_read,
                link=n.link,
                created_at=n.created_at,
            )
            for n in notifs
        ],
        unread_count=unread_count,
        total=total,
    )


@router.patch("/{notification_id}/read")
async def mark_as_read(
    notification_id: PydanticObjectId,
    current_user: User = Depends(get_current_user),
):
    """Mark a single notification as read."""
    notif = await Notification.get(notification_id)
    if not notif or notif.user_id != current_user.id:
        return {"detail": "Notification not found."}
    notif.is_read = True
    await notif.save()
    return {"status": "read"}


@router.patch("/read-all")
async def mark_all_as_read(
    current_user: User = Depends(get_current_user),
):
    """Mark all of the current user's notifications as read."""
    await Notification.find(
        Notification.user_id == current_user.id,
        Notification.is_read == False,
    ).update({"$set": {"is_read": True}})
    return {"status": "all_read"}
