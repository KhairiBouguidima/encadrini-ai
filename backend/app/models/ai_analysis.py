from datetime import datetime
from typing import List, Optional, Dict, Any
from beanie import Document, PydanticObjectId, Indexed
from pydantic import BaseModel, Field

class AnalysisScores(BaseModel):
    linguistic: float
    structural: float
    coherence: float
    overall_quality: float

class CorrectionIssue(BaseModel):
    page: Optional[int] = None
    original: str
    suggestion: str
    explanation: str

class GeneratedContent(BaseModel):
    summary: str
    abstract: str
    keywords: List[str]
    jury_questions: List[str]

class AIAnalysis(Document):
    report_id: Indexed(PydanticObjectId)
    version_number: Indexed(int)
    scores: AnalysisScores
    missing_sections: List[str] = []
    corrections: List[CorrectionIssue] = []
    generated_content: GeneratedContent
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "ai_analyses"
