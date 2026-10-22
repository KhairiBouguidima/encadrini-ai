from datetime import datetime
from enum import Enum
from typing import List, Optional
from beanie import Document, PydanticObjectId, Indexed
from pydantic import BaseModel, Field
from app.models.project import SupervisorRole


class PFEValidationStatus(str, Enum):
    PENDING = "PENDING"
    VALIDATED = "VALIDATED"
    REJECTED = "REJECTED"


class PFEValidationCertificate(Document):
    certificate_id: Indexed(str, unique=True)  # e.g. "CERT-PFE-2026-A1B2C3"
    verification_token: Indexed(str, unique=True)  # Secure URL-safe token
    
    project_id: Indexed(PydanticObjectId)
    report_id: Indexed(PydanticObjectId)
    version_number: int

    validation_status: PFEValidationStatus = PFEValidationStatus.VALIDATED
    academic_year: str = "2025-2026"
    institution_name: str = "Université / Établissement d'enseignement supérieur"
    project_title: str

    # Student & Binôme Details
    student_names: List[str] = Field(default_factory=list)
    student_emails: List[str] = Field(default_factory=list)

    # Validating Academic / Enterprise Supervisor
    supervisor_name: str
    supervisor_email: str
    supervisor_role: SupervisorRole = SupervisorRole.ACADEMIC
    supervisor_mention: Optional[str] = "Favorable pour soutenance"
    supervisor_notes: Optional[str] = None

    # Co-supervisor if available
    enterprise_supervisor_name: Optional[str] = None
    enterprise_supervisor_email: Optional[str] = None

    # Compliance & AI validation (Optional - Never fabricated!)
    ai_compliance_score: Optional[float] = None
    ai_compliance_level: Optional[str] = None
    ai_compliance_summary: Optional[str] = None

    # Official verification and legal integrity
    validation_date: datetime = Field(default_factory=datetime.utcnow)
    certificate_hash: str  # SHA-256 integrity hash
    download_count: int = 0

    # Legal notice disclaimer
    legal_notice: str = (
        "Attestation de validation académique numérique délivrée via Encadrini AI. "
        "Cette validation atteste de l'autorisation de dépôt pour soutenance et est distincte "
        "d'une signature électronique qualifiée au sens légal (eIDAS)."
    )

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "pfe_validation_certificates"
