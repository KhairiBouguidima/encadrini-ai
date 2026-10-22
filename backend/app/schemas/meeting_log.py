from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field
from app.models.meeting_log import MeetingLogStatus
from app.models.project import SupervisorRole


class MeetingLogCreate(BaseModel):
    meeting_date: datetime
    work_completed: str
    encountered_blockers: str
    supervisor_feedback: Optional[str] = ""
    next_week_objectives: str
    status: MeetingLogStatus = MeetingLogStatus.SUBMITTED


class MeetingLogUpdate(BaseModel):
    meeting_date: Optional[datetime] = None
    work_completed: Optional[str] = None
    encountered_blockers: Optional[str] = None
    supervisor_feedback: Optional[str] = None
    next_week_objectives: Optional[str] = None
    status: Optional[MeetingLogStatus] = None


class MeetingLogReview(BaseModel):
    action: str = Field(description="'APPROVE' or 'REQUEST_CHANGES'")
    feedback: Optional[str] = None


class MeetingLogResponse(BaseModel):
    id: str
    project_id: str
    meeting_date: datetime
    work_completed: str
    encountered_blockers: str
    supervisor_feedback: Optional[str] = ""
    next_week_objectives: str

    author_id: str
    author_name: str
    author_role: str

    status: MeetingLogStatus

    reviewed_by_id: Optional[str] = None
    reviewed_by_name: Optional[str] = None
    reviewed_by_role: Optional[SupervisorRole] = None
    reviewed_at: Optional[datetime] = None
    review_feedback: Optional[str] = None

    created_at: datetime
    updated_at: datetime
