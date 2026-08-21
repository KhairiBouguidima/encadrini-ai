from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime


class NotificationResponse(BaseModel):
    id: str
    type: str
    title: str
    message: str
    is_read: bool
    link: Optional[str] = None
    created_at: datetime


class NotificationListResponse(BaseModel):
    notifications: List[NotificationResponse]
    unread_count: int
    total: int
