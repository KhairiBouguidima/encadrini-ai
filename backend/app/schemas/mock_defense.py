from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from app.models.mock_defense import JuryRole, DefenseMode, DefenseLanguage, DefenseDifficulty, SimulationStatus

class SubscriptionUsageResponse(BaseModel):
    plan: str
    monthly_simulations_limit: int
    monthly_simulations_used: int
    monthly_simulations_remaining: int
    max_questions_per_session: int
    voice_mode_enabled: bool
    stress_test_mode_enabled: bool
    detailed_revision_plan_enabled: bool
    can_start_simulation: bool

class PlanUpgradeRequest(BaseModel):
    plan: str  # "FREE" or "PREMIUM"

class VoiceMetricsResponse(BaseModel):
    duration_seconds: float
    words_count: int
    words_per_minute: float
    filler_words_count: int
    filler_words_detected: List[str]
    pacing_feedback: str

class CriteriaScores(BaseModel):
    technicalAccuracy: float = 0.0
    depthOfUnderstanding: float = 0.0
    reasoning: float = 0.0
    clarity: float = 0.0
    justification: float = 0.0
    completeness: float = 0.0

class AnswerEvaluationResponse(BaseModel):
    overallScore: float
    criteria: CriteriaScores
    strengths: List[str]
    weaknesses: List[str]
    missingPoints: List[str]
    technicalErrors: List[str]
    improvedAnswer: str
    followUpQuestion: Optional[str] = None
    examinerFeedback: Optional[str] = None
    evaluated_at: datetime

class QuestionResponse(BaseModel):
    id: str
    question_number: int
    examiner_role: JuryRole
    examiner_name: str
    examiner_title: str
    category: str
    difficulty: DefenseDifficulty
    text: str
    context_grounding: Optional[str] = None
    hint: Optional[str] = None
    is_follow_up: bool = False
    student_answer: Optional[str] = None
    answer_mode: Optional[str] = "text"
    voice_metrics: Optional[VoiceMetricsResponse] = None
    answered_at: Optional[datetime] = None
    evaluation: Optional[AnswerEvaluationResponse] = None

class ProjectKnowledgeProfileResponse(BaseModel):
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

class MockDefenseReportResponse(BaseModel):
    overall_score: float
    readiness_level: str
    criteria_averages: Dict[str, float]
    jury_performance: Dict[str, float]
    category_performance: Dict[str, float]
    strongest_answers: List[Dict[str, Any]]
    weakest_answers: List[Dict[str, Any]]
    repeated_mistakes: List[str]
    knowledge_gaps: List[str]
    technical_concepts_to_revise: List[str]
    recommended_model_answers: List[Dict[str, str]]
    personalized_revision_plan: List[Dict[str, Any]]
    suggested_next_questions: List[str]
    disclaimer: str
    total_duration_seconds: Optional[int] = None
    completed_at: datetime

class SimulationListItemResponse(BaseModel):
    id: str
    title: str
    academic_level: str
    category: str
    tech_stack: List[str]
    language: DefenseLanguage
    difficulty: DefenseDifficulty
    mode: DefenseMode
    status: SimulationStatus
    total_questions: int
    answered_questions: int
    overall_score: Optional[float] = None
    readiness_level: Optional[str] = None
    created_at: datetime
    updated_at: datetime

class SimulationDetailResponse(BaseModel):
    id: str
    user_id: str
    project_id: Optional[str] = None
    title: str
    description: str
    academic_level: str
    category: str
    tech_stack: List[str]
    language: DefenseLanguage
    difficulty: DefenseDifficulty
    mode: DefenseMode
    duration_minutes: int
    report_file_name: Optional[str] = None
    slides_file_name: Optional[str] = None
    status: SimulationStatus
    knowledge_profile: Optional[ProjectKnowledgeProfileResponse] = None
    questions: List[QuestionResponse] = []
    current_question_index: int = 0
    final_report: Optional[MockDefenseReportResponse] = None
    session_started_at: Optional[datetime] = None
    session_completed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

class AnswerSubmissionRequest(BaseModel):
    question_id: str
    answer: str
    answer_mode: str = "text"  # "text" | "voice"
    audio_duration_seconds: Optional[float] = None

class HintResponse(BaseModel):
    question_id: str
    hint: str

class TranscribeResponse(BaseModel):
    transcription: str
    duration_seconds: float
    words_count: int
    words_per_minute: float
    filler_words_count: int
    filler_words_detected: List[str]
    pacing_feedback: str
