from datetime import datetime
from enum import Enum
from typing import Optional, Dict
from beanie import Document, PydanticObjectId, Indexed
from pydantic import Field
from app.models.project import SupervisorRole


class ApprovalStatus(str, Enum):
    PENDING_REVIEW = "PENDING_REVIEW"
    CORRECTIONS_REQUIRED = "CORRECTIONS_REQUIRED"
    APPROVED_FOR_DEFENSE = "APPROVED_FOR_DEFENSE"
    REJECTED = "REJECTED"


class Evaluation(Document):
    report_id: Indexed(PydanticObjectId)
    version_number: int
    encadrer_id: PydanticObjectId
    supervisor_role: SupervisorRole = SupervisorRole.ACADEMIC
    grade: float  # 0–20
    feedback: Optional[str] = None
    approval_status: ApprovalStatus = ApprovalStatus.PENDING_REVIEW
    criteria_ratings: Dict[str, float] = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "evaluations"
