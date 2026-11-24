from datetime import datetime, timezone
from typing import Optional, List
from enum import Enum
from beanie import Document, PydanticObjectId
from pydantic import Field


class AssistanceServiceType(str, Enum):
    MISE_EN_PAGE_WORD = "MISE_EN_PAGE_WORD"
    TEMPLATE_LATEX = "TEMPLATE_LATEX"
    CORRECTION_STYLE = "CORRECTION_STYLE"
    PACK_COMPLET = "PACK_COMPLET"


class AssistanceRequestStatus(str, Enum):
    PENDING_PAYMENT = "PENDING_PAYMENT"
    PENDING_ASSIGNMENT = "PENDING_ASSIGNMENT"
    IN_PROGRESS = "IN_PROGRESS"
    DELIVERED = "DELIVERED"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class AssistanceRequest(Document):
    # Student Info
    student_id: PydanticObjectId
    student_name: str
    student_email: str
    student_phone: str = ""

    # Associated Project / Report
    project_id: Optional[PydanticObjectId] = None
    project_title: Optional[str] = None
    report_id: Optional[PydanticObjectId] = None
    report_title: str

    # Service Request Details
    service_type: AssistanceServiceType = AssistanceServiceType.MISE_EN_PAGE_WORD
    service_label: str = "Mise en page académique Word (Sommaire, Pagination, Marges)"
    notes_from_student: str = ""
    deadline_date: Optional[str] = None

    # Pricing & Payment in Tunisian Dinars
    price_tnd: float = 35.0
    payment_status: str = "PAID"  # "PENDING" or "PAID"
    payment_provider: Optional[str] = None  # "KONNECT", "FLOUCI", "PAYMEE", "DEMO"
    payment_transaction_id: Optional[str] = None

    # Workflow Status
    status: AssistanceRequestStatus = AssistanceRequestStatus.PENDING_ASSIGNMENT

    # Technician Assignment
    assigned_technician_id: Optional[PydanticObjectId] = None
    assigned_technician_name: Optional[str] = None
    assigned_technician_email: Optional[str] = None
    assigned_technician_phone: Optional[str] = None

    # Files
    student_file_url: Optional[str] = None
    student_file_name: Optional[str] = None
    delivered_file_url: Optional[str] = None
    delivered_file_name: Optional[str] = None
    technician_notes: Optional[str] = None

    # Rating & Feedback
    rating: Optional[int] = None
    feedback: Optional[str] = None

    # Timestamps
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    assigned_at: Optional[datetime] = None
    delivered_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    class Settings:
        name = "assistance_requests"
