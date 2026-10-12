from datetime import datetime
from typing import List, Optional, Dict, Any
from beanie import Document, PydanticObjectId, Indexed
from pydantic import BaseModel, Field

class DimensionScores(BaseModel):
    structure: float      # 25% weight
    methodology: float    # 25% weight
    language: float       # 20% weight
    formatting: float     # 15% weight
    citations: float      # 15% weight

class RoadmapItem(BaseModel):
    id: str
    title: str
    description: str
    priority: str        # "critical", "important", "minor"
    dimension: str       # "structure", "methodology", "language", "formatting", "citations"
    estimated_gain: float
    estimated_effort: str # "Faible", "Moyen", "Élevé"
    completed: bool = False

class AnalysisScores(BaseModel):
    linguistic: float
    structural: float
    coherence: float
    overall_quality: float
    readiness_score: Optional[float] = None
    readiness_level: Optional[str] = None  # "Prêt pour la soutenance", "Bon", "Satisfaisant", "En progrès", "Insuffisant"
    dimension_scores: Optional[DimensionScores] = None

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
    formatting_issues: List[str] = []

class AIAnalysis(Document):
    report_id: Indexed(PydanticObjectId)
    version_number: Indexed(int)
    scores: AnalysisScores
    missing_sections: List[str] = []
    corrections: List[CorrectionIssue] = []
    generated_content: GeneratedContent
    roadmap: List[RoadmapItem] = []
    formatting_issues: List[str] = []
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "ai_analyses"
