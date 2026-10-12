from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field
from app.models.report import AIAnalysisStatus, ReportType

class ReportCreate(BaseModel):
    title: str = Field(..., min_length=2, max_length=150)
    report_type: ReportType = ReportType.PFE
    description: Optional[str] = ""

class ReportUpdate(BaseModel):
    title: Optional[str] = None
    report_type: Optional[ReportType] = None
    description: Optional[str] = None

class ReportVersionResponse(BaseModel):
    version_number: int
    original_file_name: str
    original_mime_type: str
    file_size: int
    uploaded_at: datetime
    ai_analysis_status: AIAnalysisStatus

class ReportResponse(BaseModel):
    id: str
    project_id: str
    title: str = "Rapport principal"
    report_type: str = "PFE"
    description: Optional[str] = ""
    current_version: int
    versions: List[ReportVersionResponse]
    created_at: datetime
    updated_at: Optional[datetime] = None

class ReportListResponse(BaseModel):
    reports: List[ReportResponse]
    total: int
