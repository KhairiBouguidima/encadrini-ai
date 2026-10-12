from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, EmailStr, Field
from app.models.project import ProjectStatus, InvitationStatus

class ProjectCreate(BaseModel):
    title: str
    description: str
    academic_year: Optional[str] = "2025-2026"
    deadline: Optional[datetime] = None
    tags: List[str] = Field(default_factory=list)

class ProjectUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[ProjectStatus] = None
    progress: Optional[int] = Field(default=None, ge=0, le=100)
    deadline: Optional[datetime] = None
    tags: Optional[List[str]] = None
    academic_year: Optional[str] = None

class ProjectResponse(BaseModel):
    id: str
    student_id: str
    encadrer_id: Optional[str] = None
    encadrer_ids: List[str] = []
    encadrer_name: Optional[str] = None
    encadrer_email: Optional[str] = None
    student_name: Optional[str] = None
    student_email: Optional[str] = None
    title: str
    description: str
    status: ProjectStatus
    progress: int = 0
    deadline: Optional[datetime] = None
    tags: List[str] = []
    academic_year: Optional[str] = "2025-2026"
    created_at: datetime
    updated_at: Optional[datetime] = None

class InviteEncadrerRequest(BaseModel):
    encadrer_email: EmailStr

class InvitationResponse(BaseModel):
    id: str
    project_id: str
    student_id: str
    encadrer_email: EmailStr
    status: InvitationStatus
    invitation_link: str
    email_sent: bool = True
    expires_at: datetime

class InvitationPreviewResponse(BaseModel):
    token: str
    project_id: str
    student_id: str
    student_name: str
    project_title: str
    project_description: str
    encadrer_email: EmailStr
    status: InvitationStatus
    expires_at: datetime
