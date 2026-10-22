from typing import List, Optional
import json
from fastapi import APIRouter, HTTPException, status, Depends, UploadFile, File, Form
from app.models.user import User
from app.api.deps import get_current_user
from app.schemas.mock_defense import (
    SubscriptionUsageResponse, PlanUpgradeRequest, SimulationDetailResponse,
    SimulationListItemResponse, MockDefenseReportResponse, AnswerSubmissionRequest,
    HintResponse, TranscribeResponse, QuestionResponse
)
from app.services.mock_defense.subscription_usage_service import SubscriptionUsageService
from app.services.mock_defense.defense_simulation_service import DefenseSimulationService
from app.services.mock_defense.speech_transcription_service import SpeechTranscriptionService

router = APIRouter()

# ── 1. Subscription & Entitlement Endpoints ────────────────────────
@router.get("/subscription/usage", response_model=SubscriptionUsageResponse)
async def get_subscription_usage(current_user: User = Depends(get_current_user)):
    """Retrieve the current user's simulation usage and plan entitlement limits."""
    summary = await SubscriptionUsageService.get_usage_summary(current_user)
    return SubscriptionUsageResponse(**summary)

@router.post("/subscription/upgrade", response_model=SubscriptionUsageResponse)
async def upgrade_subscription(
    body: PlanUpgradeRequest,
    current_user: User = Depends(get_current_user)
):
    """Upgrade or switch the user's plan tier (FREE or PREMIUM)."""
    user = await SubscriptionUsageService.upgrade_plan(current_user, body.plan)
    summary = await SubscriptionUsageService.get_usage_summary(user)
    return SubscriptionUsageResponse(**summary)

# ── 2. Create and List Simulations ──────────────────────────────────
@router.post("/", response_model=SimulationDetailResponse, status_code=status.HTTP_201_CREATED)
async def create_simulation(
    title: str = Form(...),
    description: Optional[str] = Form(""),
    academic_level: Optional[str] = Form("Master"),
    category: Optional[str] = Form("Informatique"),
    tech_stack: Optional[str] = Form("[]"),  # JSON array string or comma separated
    language: Optional[str] = Form("fr"),
    difficulty: Optional[str] = Form("intermediate"),
    mode: Optional[str] = Form("TRAINING"),
    duration_minutes: Optional[int] = Form(20),
    project_id: Optional[str] = Form(None),
    report_file: Optional[UploadFile] = File(None),
    slides_file: Optional[UploadFile] = File(None),
    current_user: User = Depends(get_current_user)
):
    """Create a new mock defense simulation with optional report and slides upload."""
    parsed_tech_stack: List[str] = []
    if tech_stack:
        try:
            parsed = json.loads(tech_stack)
            if isinstance(parsed, list):
                parsed_tech_stack = [str(t).strip() for t in parsed if str(t).strip()]
        except Exception:
            parsed_tech_stack = [t.strip() for t in tech_stack.split(",") if t.strip()]

    simulation = await DefenseSimulationService.create_simulation(
        user=current_user,
        title=title,
        description=description or "",
        academic_level=academic_level or "Master",
        category=category or "Informatique",
        tech_stack=parsed_tech_stack,
        language=language or "fr",
        difficulty=difficulty or "intermediate",
        mode=mode or "TRAINING",
        duration_minutes=duration_minutes or 20,
        project_id=project_id,
        report_file=report_file,
        slides_file=slides_file,
    )

    return _to_detail_response(simulation)

@router.get("/", response_model=List[SimulationListItemResponse])
async def list_simulations(current_user: User = Depends(get_current_user)):
    """List all simulations belonging to the authenticated student."""
    simulations = await DefenseSimulationService.list_simulations(current_user)
    items = []
    for s in simulations:
        answered_cnt = sum(1 for q in s.questions if q.evaluation is not None)
        score = s.final_report.overall_score if s.final_report else None
        readiness = s.final_report.readiness_level if s.final_report else None

        items.append(SimulationListItemResponse(
            id=str(s.id),
            title=s.title,
            academic_level=s.academic_level,
            category=s.category,
            tech_stack=s.tech_stack,
            language=s.language,
            difficulty=s.difficulty,
            mode=s.mode,
            status=s.status,
            total_questions=len(s.questions),
            answered_questions=answered_cnt,
            overall_score=score,
            readiness_level=readiness,
            created_at=s.created_at,
            updated_at=s.updated_at
        ))
    return items

# ── 3. Simulation Detail & Lifecycle ────────────────────────────────
@router.get("/{simulation_id}", response_model=SimulationDetailResponse)
async def get_simulation(
    simulation_id: str,
    current_user: User = Depends(get_current_user)
):
    """Retrieve full details of a simulation including knowledge profile, questions, and answers."""
    simulation = await DefenseSimulationService.get_simulation(simulation_id, current_user)
    return _to_detail_response(simulation)

@router.post("/{simulation_id}/start", response_model=SimulationDetailResponse)
async def start_session(
    simulation_id: str,
    current_user: User = Depends(get_current_user)
):
    """Start or resume the live defense simulation session."""
    sim = await DefenseSimulationService.start_session(simulation_id, current_user)
    return _to_detail_response(sim)

@router.post("/{simulation_id}/answers")
async def submit_answer(
    simulation_id: str,
    payload: AnswerSubmissionRequest,
    current_user: User = Depends(get_current_user)
):
    """Submit an answer to a question and receive immediate structured evaluation."""
    result = await DefenseSimulationService.submit_answer(
        simulation_id=simulation_id,
        question_id=payload.question_id,
        answer=payload.answer,
        answer_mode=payload.answer_mode,
        audio_duration_seconds=payload.audio_duration_seconds,
        user=current_user
    )
    return result

@router.post("/{simulation_id}/hints", response_model=HintResponse)
async def get_hint(
    simulation_id: str,
    question_id: str = Form(...),
    current_user: User = Depends(get_current_user)
):
    """Retrieve an in-context pedagogical hint for the question (disabled in stress mode)."""
    hint_text = await DefenseSimulationService.get_hint(simulation_id, question_id, current_user)
    return HintResponse(question_id=question_id, hint=hint_text)

@router.post("/{simulation_id}/finish", response_model=MockDefenseReportResponse)
async def finish_simulation(
    simulation_id: str,
    current_user: User = Depends(get_current_user)
):
    """End the simulation session and generate the final comprehensive readiness report."""
    sim = await DefenseSimulationService.finish_simulation(simulation_id, current_user)
    return sim.final_report

@router.get("/{simulation_id}/report", response_model=MockDefenseReportResponse)
async def get_simulation_report(
    simulation_id: str,
    current_user: User = Depends(get_current_user)
):
    """Fetch the final performance report for a completed defense simulation."""
    sim = await DefenseSimulationService.get_simulation(simulation_id, current_user)
    if not sim.final_report:
        sim = await DefenseSimulationService.finish_simulation(simulation_id, current_user)
    return sim.final_report

@router.delete("/{simulation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_simulation(
    simulation_id: str,
    current_user: User = Depends(get_current_user)
):
    """Delete a simulation and its data."""
    await DefenseSimulationService.delete_simulation(simulation_id, current_user)
    return None

# ── 4. Speech to Text & Oral Delivery Endpoint ──────────────────────
@router.post("/transcribe", response_model=TranscribeResponse)
async def transcribe_audio(
    audio_file: Optional[UploadFile] = File(None),
    transcript_text: Optional[str] = Form(None),
    duration_seconds: Optional[float] = Form(15.0),
    current_user: User = Depends(get_current_user)
):
    """
    Transcribes audio or evaluates oral delivery metrics (WPM, filler words, pacing)
    for voice-recorded answers.
    """
    text = transcript_text or ""
    if audio_file and not text.strip():
        audio_bytes = await audio_file.read()
        text = await SpeechTranscriptionService.transcribe_audio_bytes(
            audio_bytes, audio_file.filename or "recording.webm"
        )

    metrics = SpeechTranscriptionService.analyze_oral_delivery(
        text=text,
        duration_seconds=duration_seconds or 15.0
    )

    return TranscribeResponse(
        transcription=text,
        duration_seconds=metrics["duration_seconds"],
        words_count=metrics["words_count"],
        words_per_minute=metrics["words_per_minute"],
        filler_words_count=metrics["filler_words_count"],
        filler_words_detected=metrics["filler_words_detected"],
        pacing_feedback=metrics["pacing_feedback"]
    )

def _to_detail_response(sim) -> SimulationDetailResponse:
    kp = None
    if sim.knowledge_profile:
        kp = {
            "objectives": sim.knowledge_profile.objectives,
            "problem_statement": sim.knowledge_profile.problem_statement,
            "architecture_summary": sim.knowledge_profile.architecture_summary,
            "technologies": sim.knowledge_profile.technologies,
            "database_choices": sim.knowledge_profile.database_choices,
            "key_methodologies": sim.knowledge_profile.key_methodologies,
            "technical_limitations": sim.knowledge_profile.technical_limitations,
            "security_considerations": sim.knowledge_profile.security_considerations,
            "scalability_performance": sim.knowledge_profile.scalability_performance,
            "challengeable_claims": sim.knowledge_profile.challengeable_claims,
        }

    q_list = []
    for q in sim.questions:
        vm = None
        if q.voice_metrics:
            vm = {
                "duration_seconds": q.voice_metrics.duration_seconds,
                "words_count": q.voice_metrics.words_count,
                "words_per_minute": q.voice_metrics.words_per_minute,
                "filler_words_count": q.voice_metrics.filler_words_count,
                "filler_words_detected": q.voice_metrics.filler_words_detected,
                "pacing_feedback": q.voice_metrics.pacing_feedback,
            }

        eval_resp = None
        if q.evaluation:
            eval_resp = {
                "overallScore": q.evaluation.overallScore,
                "criteria": {
                    "technicalAccuracy": q.evaluation.criteria.technicalAccuracy,
                    "depthOfUnderstanding": q.evaluation.criteria.depthOfUnderstanding,
                    "reasoning": q.evaluation.criteria.reasoning,
                    "clarity": q.evaluation.criteria.clarity,
                    "justification": q.evaluation.criteria.justification,
                    "completeness": q.evaluation.criteria.completeness,
                },
                "strengths": q.evaluation.strengths,
                "weaknesses": q.evaluation.weaknesses,
                "missingPoints": q.evaluation.missingPoints,
                "technicalErrors": q.evaluation.technicalErrors,
                "improvedAnswer": q.evaluation.improvedAnswer,
                "followUpQuestion": q.evaluation.followUpQuestion,
                "examinerFeedback": q.evaluation.examinerFeedback,
                "evaluated_at": q.evaluation.evaluated_at,
            }

        q_list.append({
            "id": q.id,
            "question_number": q.question_number,
            "examiner_role": q.examiner_role,
            "examiner_name": q.examiner_name,
            "examiner_title": q.examiner_title,
            "category": q.category,
            "difficulty": q.difficulty,
            "text": q.text,
            "context_grounding": q.context_grounding,
            "hint": q.hint,
            "is_follow_up": q.is_follow_up,
            "student_answer": q.student_answer,
            "answer_mode": q.answer_mode,
            "voice_metrics": vm,
            "answered_at": q.answered_at,
            "evaluation": eval_resp,
        })

    rep = None
    if sim.final_report:
        rep = {
            "overall_score": sim.final_report.overall_score,
            "readiness_level": sim.final_report.readiness_level,
            "criteria_averages": sim.final_report.criteria_averages,
            "jury_performance": sim.final_report.jury_performance,
            "category_performance": sim.final_report.category_performance,
            "strongest_answers": sim.final_report.strongest_answers,
            "weakest_answers": sim.final_report.weakest_answers,
            "repeated_mistakes": sim.final_report.repeated_mistakes,
            "knowledge_gaps": sim.final_report.knowledge_gaps,
            "technical_concepts_to_revise": sim.final_report.technical_concepts_to_revise,
            "recommended_model_answers": sim.final_report.recommended_model_answers,
            "personalized_revision_plan": sim.final_report.personalized_revision_plan,
            "suggested_next_questions": sim.final_report.suggested_next_questions,
            "disclaimer": sim.final_report.disclaimer,
            "total_duration_seconds": sim.final_report.total_duration_seconds,
            "completed_at": sim.final_report.completed_at,
        }

    return SimulationDetailResponse(
        id=str(sim.id),
        user_id=str(sim.user_id),
        project_id=str(sim.project_id) if sim.project_id else None,
        title=sim.title,
        description=sim.description,
        academic_level=sim.academic_level,
        category=sim.category,
        tech_stack=sim.tech_stack,
        language=sim.language,
        difficulty=sim.difficulty,
        mode=sim.mode,
        duration_minutes=sim.duration_minutes,
        report_file_name=sim.report_file_name,
        slides_file_name=sim.slides_file_name,
        status=sim.status,
        knowledge_profile=kp,
        questions=q_list,
        current_question_index=sim.current_question_index,
        final_report=rep,
        session_started_at=sim.session_started_at,
        session_completed_at=sim.session_completed_at,
        created_at=sim.created_at,
        updated_at=sim.updated_at
    )
