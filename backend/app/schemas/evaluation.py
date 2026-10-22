from datetime import datetime
from typing import Optional, Dict, List
from pydantic import BaseModel, Field, field_validator
from app.models.evaluation import ApprovalStatus
from app.models.project import SupervisorRole


class EvaluationCreate(BaseModel):
    report_id: str
    version_number: int
    grade: float
    feedback: Optional[str] = None
    approval_status: Optional[ApprovalStatus] = ApprovalStatus.PENDING_REVIEW
    supervisor_role: Optional[SupervisorRole] = None
    criteria_ratings: Optional[Dict[str, float]] = None

    @field_validator("grade")
    @classmethod
    def validate_grade(cls, v: float) -> float:
        if not (0 <= v <= 20):
            raise ValueError("La note doit être entre 0 et 20.")
        return round(v, 2)


class EvaluationUpdate(BaseModel):
    grade: Optional[float] = None
    feedback: Optional[str] = None
    approval_status: Optional[ApprovalStatus] = None
    criteria_ratings: Optional[Dict[str, float]] = None

    @field_validator("grade")
    @classmethod
    def validate_grade(cls, v: Optional[float]) -> Optional[float]:
        if v is not None and not (0 <= v <= 20):
            raise ValueError("La note doit être entre 0 et 20.")
        return round(v, 2) if v is not None else v


class EvaluationResponse(BaseModel):
    id: str
    report_id: str
    version_number: int
    encadrer_id: str
    encadrer_name: Optional[str] = None
    encadrer_email: Optional[str] = None
    supervisor_role: SupervisorRole = SupervisorRole.ACADEMIC
    grade: float
    feedback: Optional[str] = None
    approval_status: ApprovalStatus = ApprovalStatus.PENDING_REVIEW
    criteria_ratings: Dict[str, float] = Field(default_factory=dict)
    created_at: datetime
    updated_at: datetime


class DualValidationVersionStatus(BaseModel):
    report_id: str
    version_number: int
    workflow_status: str
    requires_academic: bool
    requires_enterprise: bool
    academic_evaluation: Optional[EvaluationResponse] = None
    enterprise_evaluation: Optional[EvaluationResponse] = None
    academic_approved: bool = False
    enterprise_approved: bool = False
    is_fully_approved: bool = False
    requires_changes: bool = False
    summary_message: str
    evaluations: List[EvaluationResponse] = []
