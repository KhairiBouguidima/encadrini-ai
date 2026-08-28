from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, EmailStr
from beanie import PydanticObjectId
from app.models.project import ProjectStatus, InvitationStatus

class ProjectCreate(BaseModel):
    title: str
    description: str

class ProjectResponse(BaseModel):
    id: str
    student_id: str
    encadrer_id: Optional[str] = None
    encadrer_ids: List[str] = []
    title: str
    description: str
    status: ProjectStatus
    created_at: datetime

class InviteEncadrerRequest(BaseModel):
    encadrer_email: EmailStr

class InvitationResponse(BaseModel):
    id: str
    project_id: str
    student_id: str
    encadrer_email: EmailStr
    status: InvitationStatus
    invitation_link: str
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
