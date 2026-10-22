import secrets
from datetime import datetime
from enum import Enum
from typing import List, Optional
from beanie import Document, PydanticObjectId, Indexed
from pydantic import BaseModel, Field, EmailStr

class ProjectStatus(str, Enum):
    ACTIVE = "ACTIVE"
    IN_REVIEW = "IN_REVIEW"
    COMPLETED = "COMPLETED"
    ARCHIVED = "ARCHIVED"

class SupervisorRole(str, Enum):
    ACADEMIC = "ACADEMIC"
    ENTERPRISE = "ENTERPRISE"

class InvitationType(str, Enum):
    SUPERVISOR = "SUPERVISOR"
    BINOME = "BINOME"

class TaskStatus(str, Enum):
    TODO = "TODO"
    IN_PROGRESS = "IN_PROGRESS"
    DONE = "DONE"

class ProjectTask(BaseModel):
    id: str = Field(default_factory=lambda: secrets.token_hex(6))
    title: str
    description: Optional[str] = ""
    assigned_to: Optional[PydanticObjectId] = None
    assigned_name: Optional[str] = None
    status: TaskStatus = TaskStatus.TODO
    due_date: Optional[datetime] = None
    created_by: Optional[PydanticObjectId] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = None

class ProjectActivity(BaseModel):
    id: str = Field(default_factory=lambda: secrets.token_hex(6))
    user_id: Optional[PydanticObjectId] = None
    user_name: str
    user_role: str
    action: str
    details: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

class Project(Document):
    student_id: Indexed(PydanticObjectId)
    co_student_id: Optional[PydanticObjectId] = None
    student_ids: List[PydanticObjectId] = Field(default_factory=list)
    
    encadrer_id: Optional[PydanticObjectId] = None
    encadrer_ids: List[PydanticObjectId] = Field(default_factory=list)
    academic_encadrer_id: Optional[PydanticObjectId] = None
    enterprise_encadrer_id: Optional[PydanticObjectId] = None

    title: str
    description: str
    status: ProjectStatus = ProjectStatus.ACTIVE
    progress: int = Field(default=0, ge=0, le=100)
    deadline: Optional[datetime] = None
    tags: List[str] = Field(default_factory=list)
    academic_year: Optional[str] = "2025-2026"
    
    tasks: List[ProjectTask] = Field(default_factory=list)
    activities: List[ProjectActivity] = Field(default_factory=list)

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "projects"

class InvitationStatus(str, Enum):
    PENDING = "PENDING"
    ACCEPTED = "ACCEPTED"
    DECLINED = "DECLINED"
    EXPIRED = "EXPIRED"

class Invitation(Document):
    project_id: PydanticObjectId
    student_id: PydanticObjectId
    encadrer_email: Indexed(EmailStr)
    recipient_email: Optional[EmailStr] = None
    invitation_type: InvitationType = InvitationType.SUPERVISOR
    supervisor_role: Optional[SupervisorRole] = None
    token_hash: Indexed(str, unique=True)
    status: InvitationStatus = InvitationStatus.PENDING
    expires_at: datetime
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "invitations"
