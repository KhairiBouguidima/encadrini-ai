from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, EmailStr, Field
from app.models.assistance import AssistanceServiceType, AssistanceRequestStatus


# ── Technicians Schemas ──────────────────────────────────────────

class TechnicianCreateRequest(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr
    password: str
    phone_number: str = ""
    specialties: List[str] = Field(default_factory=lambda: ["Mise en page Word", "Normes universitaires"])
    bio: Optional[str] = ""


class TechnicianResponse(BaseModel):
    id: str
    first_name: str
    last_name: str
    email: str
    phone_number: str
    specialties: List[str]
    is_active: bool
    is_trusted_technician: bool
    completed_assistance_count: int
    created_at: datetime


# ── Assistance Requests Schemas ──────────────────────────────────

class AssistanceRequestCreate(BaseModel):
    report_id: Optional[str] = None
    project_id: Optional[str] = None
    report_title: str
    service_type: AssistanceServiceType = AssistanceServiceType.MISE_EN_PAGE_WORD
    notes_from_student: Optional[str] = ""
    deadline_date: Optional[str] = None
    student_file_url: Optional[str] = None
    student_file_name: Optional[str] = None
    payment_provider: Optional[str] = "KONNECT"


class AssistanceAssignRequest(BaseModel):
    technician_id: str


class AssistanceDeliverRequest(BaseModel):
    delivered_file_url: str
    delivered_file_name: str
    technician_notes: Optional[str] = ""


class AssistanceRateRequest(BaseModel):
    rating: int = Field(..., ge=1, le=5)
    feedback: Optional[str] = ""


class AssistanceRequestResponse(BaseModel):
    id: str
    student_id: str
    student_name: str
    student_email: str
    student_phone: str
    project_id: Optional[str] = None
    project_title: Optional[str] = None
    report_id: Optional[str] = None
    report_title: str
    service_type: AssistanceServiceType
    service_label: str
    notes_from_student: str
    deadline_date: Optional[str] = None
    price_tnd: float
    payment_status: str
    payment_provider: Optional[str] = None
    status: AssistanceRequestStatus
    assigned_technician_id: Optional[str] = None
    assigned_technician_name: Optional[str] = None
    assigned_technician_email: Optional[str] = None
    assigned_technician_phone: Optional[str] = None
    student_file_url: Optional[str] = None
    student_file_name: Optional[str] = None
    delivered_file_url: Optional[str] = None
    delivered_file_name: Optional[str] = None
    technician_notes: Optional[str] = None
    rating: Optional[int] = None
    feedback: Optional[str] = None
    created_at: datetime
    assigned_at: Optional[datetime] = None
    delivered_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
