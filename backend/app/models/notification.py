from datetime import datetime
from enum import Enum
from typing import Optional
from beanie import Document, Indexed, PydanticObjectId
from pydantic import Field


class NotificationType(str, Enum):
    INVITATION_RECEIVED = "INVITATION_RECEIVED"
    INVITATION_ACCEPTED = "INVITATION_ACCEPTED"
    INVITATION_REJECTED = "INVITATION_REJECTED"
    REPORT_UPLOADED = "REPORT_UPLOADED"
    ANNOTATION_ADDED = "ANNOTATION_ADDED"
    AI_ANALYSIS_COMPLETED = "AI_ANALYSIS_COMPLETED"
    AI_ANALYSIS_FAILED = "AI_ANALYSIS_FAILED"


class Notification(Document):
    user_id: Indexed(PydanticObjectId)
    type: NotificationType
    title: str
    message: str
    is_read: bool = False
    link: Optional[str] = None  # e.g. "/reports/v3" or "/projects/abc"
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "notifications"
