from datetime import datetime
from enum import Enum
from typing import Optional
from beanie import Document, PydanticObjectId, Indexed
from pydantic import BaseModel, Field
from app.models.project import SupervisorRole


class MeetingLogStatus(str, Enum):
    DRAFT = "DRAFT"
    SUBMITTED = "SUBMITTED"
    APPROVED = "APPROVED"
    CHANGES_REQUESTED = "CHANGES_REQUESTED"


class MeetingLog(Document):
    project_id: Indexed(PydanticObjectId)
    meeting_date: datetime
    work_completed: str
    encountered_blockers: str
    supervisor_feedback: Optional[str] = ""
    next_week_objectives: str

    # Author information (Student / Binôme)
    author_id: Indexed(PydanticObjectId)
    author_name: str
    author_role: str = "STUDENT"

    # Status & Workflow
    status: MeetingLogStatus = MeetingLogStatus.SUBMITTED

    # Supervisor Review Information (Academic or Company supervisor)
    reviewed_by_id: Optional[PydanticObjectId] = None
    reviewed_by_name: Optional[str] = None
    reviewed_by_role: Optional[SupervisorRole] = None
    reviewed_at: Optional[datetime] = None
    review_feedback: Optional[str] = None

    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "meeting_logs"
