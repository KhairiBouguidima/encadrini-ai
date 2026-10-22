from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, EmailStr, Field
from app.models.project import ProjectStatus, InvitationStatus, SupervisorRole, InvitationType, TaskStatus

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

class StudentInfo(BaseModel):
    id: str
    name: str
    email: str
    faculty: Optional[str] = ""
    is_owner: bool = False

class EncadrerInfo(BaseModel):
    id: str
    name: str
    email: str
    faculty: Optional[str] = ""
    role: SupervisorRole = SupervisorRole.ACADEMIC

class TaskResponse(BaseModel):
    id: str
    title: str
    description: Optional[str] = ""
    assigned_to: Optional[str] = None
    assigned_name: Optional[str] = None
    status: str
    due_date: Optional[datetime] = None
    created_at: datetime
    completed_at: Optional[datetime] = None

class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = ""
    assigned_to: Optional[str] = None
    due_date: Optional[datetime] = None

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    assigned_to: Optional[str] = None
    status: Optional[TaskStatus] = None
    due_date: Optional[datetime] = None

class ActivityResponse(BaseModel):
    id: str
    user_id: Optional[str] = None
    user_name: str
    user_role: str
    action: str
    details: str
    created_at: datetime

class ProjectResponse(BaseModel):
    id: str
    student_id: str
    co_student_id: Optional[str] = None
    student_ids: List[str] = []
    students: List[StudentInfo] = []
    student_name: Optional[str] = None
    student_email: Optional[str] = None
    co_student_name: Optional[str] = None
    co_student_email: Optional[str] = None
    co_student_faculty: Optional[str] = None
    is_binome: bool = False

    encadrer_id: Optional[str] = None
    encadrer_ids: List[str] = []
    encadrers: List[EncadrerInfo] = []
    academic_encadrer_id: Optional[str] = None
    academic_encadrer: Optional[EncadrerInfo] = None
    enterprise_encadrer_id: Optional[str] = None
    enterprise_encadrer: Optional[EncadrerInfo] = None
    encadrer_name: Optional[str] = None
    encadrer_email: Optional[str] = None

    title: str
    description: str
    status: ProjectStatus
    progress: int = 0
    deadline: Optional[datetime] = None
    tags: List[str] = []
    academic_year: Optional[str] = "2025-2026"
    tasks: List[TaskResponse] = []
    activities: List[ActivityResponse] = []
    created_at: datetime
    updated_at: Optional[datetime] = None

class InviteEncadrerRequest(BaseModel):
    encadrer_email: EmailStr
    role: SupervisorRole = SupervisorRole.ACADEMIC

class InviteBinomeRequest(BaseModel):
    email: EmailStr

class InvitationResponse(BaseModel):
    id: str
    project_id: str
    student_id: str
    invitation_type: InvitationType = InvitationType.SUPERVISOR
    supervisor_role: Optional[SupervisorRole] = None
    recipient_email: EmailStr
    encadrer_email: EmailStr
    status: InvitationStatus
    invitation_link: str
    email_sent: bool = True
    expires_at: datetime
    created_at: Optional[datetime] = None

class InvitationPreviewResponse(BaseModel):
    token: Optional[str] = None
    invitation_id: Optional[str] = None
    project_id: str
    student_id: str
    student_name: str
    project_title: str
    project_description: str
    invitation_type: InvitationType = InvitationType.SUPERVISOR
    supervisor_role: Optional[SupervisorRole] = None
    encadrer_email: EmailStr
    recipient_email: Optional[EmailStr] = None
    status: InvitationStatus
    expires_at: datetime
    created_at: Optional[datetime] = None

class InvitationItemResponse(BaseModel):
    id: str
    project_id: str
    student_id: str
    student_name: Optional[str] = None
    invitation_type: InvitationType = InvitationType.SUPERVISOR
    supervisor_role: Optional[SupervisorRole] = None
    recipient_email: EmailStr
    encadrer_email: EmailStr
    status: InvitationStatus
    invitation_link: Optional[str] = None
    expires_at: datetime
    created_at: datetime
