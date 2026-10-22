from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field
from app.models.certificate import PFEValidationStatus
from app.models.project import SupervisorRole


class FinalValidationRequest(BaseModel):
    report_id: Optional[str] = None
    version_number: Optional[int] = None
    mention: Optional[str] = "Favorable pour soutenance"
    notes: Optional[str] = None
    institution_name: Optional[str] = None


class CertificateResponse(BaseModel):
    id: str
    certificate_id: str
    verification_token: str
    project_id: str
    report_id: str
    version_number: int
    validation_status: PFEValidationStatus
    academic_year: str
    institution_name: str
    project_title: str

    student_names: List[str]
    student_emails: List[str]

    supervisor_name: str
    supervisor_email: str
    supervisor_role: SupervisorRole
    supervisor_mention: Optional[str] = None
    supervisor_notes: Optional[str] = None

    enterprise_supervisor_name: Optional[str] = None
    enterprise_supervisor_email: Optional[str] = None

    # AI compliance score (Optional - never fabricated)
    ai_compliance_score: Optional[float] = None
    ai_compliance_level: Optional[str] = None
    ai_compliance_summary: Optional[str] = None

    validation_date: datetime
    certificate_hash: str
    legal_notice: str
    download_count: int
    verification_url: str
    download_url: str
    created_at: datetime


class PublicCertificateVerificationResponse(BaseModel):
    is_valid: bool
    status_label: str  # "CERTIFICAT AUTHENTIQUE ET VALIDÉ" or "NON TROUVÉ / RÉVOQUÉ"
    certificate_id: str
    validation_date: Optional[datetime] = None
    project_title: str
    institution_name: str
    academic_year: str
    student_names: List[str]
    supervisor_name: str
    supervisor_role: str
    enterprise_supervisor_name: Optional[str] = None
    version_number: int
    ai_compliance_score: Optional[float] = None
    ai_compliance_level: Optional[str] = None
    legal_notice: str
    certificate_hash: str
