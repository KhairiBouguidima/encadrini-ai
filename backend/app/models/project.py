from datetime import datetime
from enum import Enum
from typing import Optional
from beanie import Document, Link, PydanticObjectId, Indexed
from pydantic import Field, EmailStr
from app.models.user import User

class ProjectStatus(str, Enum):
    ACTIVE = "ACTIVE"
    ARCHIVED = "ARCHIVED"

class Project(Document):
    student_id: Indexed(PydanticObjectId)
    encadrer_id: Optional[PydanticObjectId] = None
    title: str
    description: str
    status: ProjectStatus = ProjectStatus.ACTIVE
    created_at: datetime = Field(default_factory=datetime.utcnow)

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
    token_hash: Indexed(str, unique=True)
    status: InvitationStatus = InvitationStatus.PENDING
    expires_at: datetime
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "invitations"
