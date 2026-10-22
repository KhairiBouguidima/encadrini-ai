from datetime import datetime
from enum import Enum
from typing import List, Optional, Dict, Any
from beanie import Document, PydanticObjectId, Indexed
from pydantic import BaseModel, Field

class JuryRole(str, Enum):
    PRESIDENT = "PRESIDENT"
    TECHNICAL = "TECHNICAL"
    CRITICAL = "CRITICAL"

class DefenseMode(str, Enum):
    TRAINING = "TRAINING"
    REALISTIC = "REALISTIC"
    STRESS_TEST = "STRESS_TEST"

class DefenseLanguage(str, Enum):
    FR = "fr"
    EN = "en"
    AR = "ar"

class DefenseDifficulty(str, Enum):
    BEGINNER = "beginner"
    INTERMEDIATE = "intermediate"
    EXPERT = "expert"

class SimulationStatus(str, Enum):
    PENDING = "PENDING"
    ANALYZING = "ANALYZING"
    READY = "READY"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"

class EvaluationCriteria(BaseModel):
    technicalAccuracy: float = 0.0      # Exactitude technique (0-100)
    depthOfUnderstanding: float = 0.0  # Profondeur de compréhension (0-100)
    reasoning: float = 0.0             # Qualité du raisonnement (0-100)
    clarity: float = 0.0               # Clarté et structure (0-100)
    justification: float = 0.0         # Justification des choix (0-100)
    completeness: float = 0.0          # Pertinence et complétude (0-100)

class VoiceMetrics(BaseModel):
    duration_seconds: float = 0.0
    words_count: int = 0
    words_per_minute: float = 0.0
    filler_words_count: int = 0
    filler_words_detected: List[str] = []
    pacing_feedback: str = ""

class AnswerEvaluation(BaseModel):
    overallScore: float = 0.0
    criteria: EvaluationCriteria = Field(default_factory=EvaluationCriteria)
    strengths: List[str] = []
    weaknesses: List[str] = []
    missingPoints: List[str] = []
    technicalErrors: List[str] = []
    improvedAnswer: str = ""
    followUpQuestion: Optional[str] = None
    examinerFeedback: Optional[str] = None
    evaluated_at: datetime = Field(default_factory=datetime.utcnow)

class MockDefenseQuestion(BaseModel):
    id: str
    question_number: int
    examiner_role: JuryRole
    examiner_name: str
    examiner_title: str
    category: str
    difficulty: DefenseDifficulty = DefenseDifficulty.INTERMEDIATE
    text: str
    context_grounding: Optional[str] = None
    hint: Optional[str] = None
    is_follow_up: bool = False
    student_answer: Optional[str] = None
    answer_mode: Optional[str] = "text"  # "text" | "voice"
    voice_metrics: Optional[VoiceMetrics] = None
    answered_at: Optional[datetime] = None
    evaluation: Optional[AnswerEvaluation] = None

class ProjectKnowledgeProfile(BaseModel):
    objectives: List[str] = []
    problem_statement: str = ""
    architecture_summary: str = ""
    technologies: List[str] = []
    database_choices: List[str] = []
    key_methodologies: List[str] = []
    technical_limitations: List[str] = []
    security_considerations: List[str] = []
    scalability_performance: List[str] = []
    challengeable_claims: List[str] = []
    extracted_sections: Dict[str, str] = {}

class MockDefenseReport(BaseModel):
    overall_score: float = 0.0
    readiness_level: str = "Satisfaisant"
    criteria_averages: Dict[str, float] = {}
    jury_performance: Dict[str, float] = {}
    category_performance: Dict[str, float] = {}
    strongest_answers: List[Dict[str, Any]] = []
    weakest_answers: List[Dict[str, Any]] = []
    repeated_mistakes: List[str] = []
    knowledge_gaps: List[str] = []
    technical_concepts_to_revise: List[str] = []
    recommended_model_answers: List[Dict[str, str]] = []
    personalized_revision_plan: List[Dict[str, Any]] = []
    suggested_next_questions: List[str] = []
    disclaimer: str = (
        "Ce score est une estimation pédagogique générée par IA pour vous entraîner "
        "et ne constitue pas une note académique officielle ou une garantie de validation de votre soutenance."
    )
    total_duration_seconds: Optional[int] = None
    completed_at: datetime = Field(default_factory=datetime.utcnow)

class MockDefenseSimulation(Document):
    user_id: Indexed(PydanticObjectId)
    project_id: Optional[PydanticObjectId] = None
    title: str
    description: str = ""
    academic_level: str = "Master"
    category: str = "Informatique"
    tech_stack: List[str] = []
    language: DefenseLanguage = DefenseLanguage.FR
    difficulty: DefenseDifficulty = DefenseDifficulty.INTERMEDIATE
    mode: DefenseMode = DefenseMode.TRAINING
    duration_minutes: int = 20
    report_file_name: Optional[str] = None
    report_file_key: Optional[str] = None
    slides_file_name: Optional[str] = None
    slides_file_key: Optional[str] = None
    status: SimulationStatus = SimulationStatus.PENDING
    knowledge_profile: Optional[ProjectKnowledgeProfile] = None
    document_chunks: List[Dict[str, Any]] = []
    questions: List[MockDefenseQuestion] = []
    current_question_index: int = 0
    final_report: Optional[MockDefenseReport] = None
    session_started_at: Optional[datetime] = None
    session_completed_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "mock_defense_simulations"
