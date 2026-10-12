from datetime import datetime
from enum import Enum
from typing import List, Optional
from beanie import Document, PydanticObjectId, Indexed
from pydantic import Field, EmailStr

class ProjectStatus(str, Enum):
    ACTIVE = "ACTIVE"
    IN_REVIEW = "IN_REVIEW"
    COMPLETED = "COMPLETED"
    ARCHIVED = "ARCHIVED"

class Project(Document):
    student_id: Indexed(PydanticObjectId)
    encadrer_id: Optional[PydanticObjectId] = None
    encadrer_ids: List[PydanticObjectId] = Field(default_factory=list)
    title: str
    description: str
    status: ProjectStatus = ProjectStatus.ACTIVE
    progress: int = Field(default=0, ge=0, le=100)
    deadline: Optional[datetime] = None
    tags: List[str] = Field(default_factory=list)
    academic_year: Optional[str] = "2025-2026"
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
    token_hash: Indexed(str, unique=True)
    status: InvitationStatus = InvitationStatus.PENDING
    expires_at: datetime
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "invitations"
