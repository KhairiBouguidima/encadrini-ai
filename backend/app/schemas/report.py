from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel
from app.models.report import AIAnalysisStatus

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
    current_version: int
    versions: List[ReportVersionResponse]
    created_at: datetime
