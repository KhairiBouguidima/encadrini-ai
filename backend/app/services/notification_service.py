"""
Notification service — centralised helper to create notifications from anywhere
in the backend (endpoints, workers, etc.).
"""
from beanie import PydanticObjectId
from app.models.notification import Notification, NotificationType


async def notify(
    user_id: PydanticObjectId,
    notification_type: NotificationType,
    title: str,
    message: str,
    link: str = None,
):
    """Insert a notification document for the target user."""
    notif = Notification(
        user_id=user_id,
        type=notification_type,
        title=title,
        message=message,
        link=link,
    )
    await notif.insert()
    return notif
