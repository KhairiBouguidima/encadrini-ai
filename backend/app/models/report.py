from datetime import datetime
from enum import Enum
from typing import List, Optional
from beanie import Document, PydanticObjectId, Indexed
from pydantic import BaseModel, Field

class AIAnalysisStatus(str, Enum):
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"

class ReportType(str, Enum):
    PFE = "PFE"
    CAHIER_CHARGES = "CAHIER_CHARGES"
    AVANCEMENT = "AVANCEMENT"
    INTERMEDIAIRE = "INTERMEDIAIRE"
    FINAL = "FINAL"
    AUTRE = "AUTRE"

class ReportVersion(BaseModel):
    version_number: int
    original_file_name: str
    original_mime_type: str
    raw_file_key: str
    pdf_file_key: str  # Same as raw_file_key if PDF, or converted PDF key if DOCX
    file_size: int
    uploaded_at: datetime = Field(default_factory=datetime.utcnow)
    ai_analysis_status: AIAnalysisStatus = AIAnalysisStatus.PENDING

class Report(Document):
    project_id: Indexed(PydanticObjectId)
    title: str = "Rapport principal"
    report_type: ReportType = ReportType.PFE
    description: Optional[str] = ""
    current_version: int = 0
    versions: List[ReportVersion] = []
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "reports"
