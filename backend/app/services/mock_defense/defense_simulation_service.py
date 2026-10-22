from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from beanie import PydanticObjectId
from fastapi import HTTPException, status, UploadFile

from app.models.user import User
from app.models.mock_defense import (
    MockDefenseSimulation, MockDefenseQuestion, SimulationStatus,
    DefenseDifficulty, DefenseMode, DefenseLanguage, VoiceMetrics
)
from app.storage.storage_service import get_storage_service
from app.services.mock_defense.subscription_usage_service import SubscriptionUsageService
from app.services.mock_defense.document_analysis_service import DocumentAnalysisService
from app.services.mock_defense.jury_question_generator import JuryQuestionGenerator
from app.services.mock_defense.answer_evaluation_service import AnswerEvaluationService
from app.services.mock_defense.defense_report_service import DefenseReportService
from app.services.mock_defense.speech_transcription_service import SpeechTranscriptionService

ALLOWED_REPORT_EXTS = [".pdf", ".docx"]
ALLOWED_SLIDES_EXTS = [".pdf", ".pptx"]
MAX_FILE_SIZE = 40 * 1024 * 1024  # 40 MB

class DefenseSimulationService:
    @classmethod
    async def create_simulation(
        cls,
        user: User,
        title: str,
        description: str = "",
        academic_level: str = "Master",
        category: str = "Informatique",
        tech_stack: List[str] = None,
        language: str = "fr",
        difficulty: str = "intermediate",
        mode: str = "TRAINING",
        duration_minutes: int = 20,
        project_id: Optional[str] = None,
        report_file: Optional[UploadFile] = None,
        slides_file: Optional[UploadFile] = None,
    ) -> MockDefenseSimulation:
        # 1. Enforce Subscription Entitlement Check
        can_start = await SubscriptionUsageService.can_start_simulation(user)
        if not can_start:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Quota mensuel de simulations atteint pour votre forfait actuel. Passez à la version Premium pour continuer."
            )

        # Check mode entitlement (e.g. Stress Test requires Premium)
        can_mode = await SubscriptionUsageService.can_use_mode(user, mode)
        if not can_mode:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Le Mode Stress Test est réservé aux membres Premium."
            )

        storage = get_storage_service()
        report_text = ""
        slides_text = ""
        report_file_name = None
        report_file_key = None
        slides_file_name = None
        slides_file_key = None

        # 2. Process and Store Report Document
        if report_file and report_file.filename:
            report_file_name = report_file.filename
            content = await report_file.read()
            if len(content) > MAX_FILE_SIZE:
                raise HTTPException(status_code=400, detail="Le fichier de rapport dépasse la taille maximale autorisée (40 Mo).")

            report_file_key = f"mock_defense/{user.id}/reports/{int(datetime.utcnow().timestamp())}_{report_file.filename}"
            await storage.upload_file(content, report_file_key)
            report_text = DocumentAnalysisService.extract_text(content, report_file.filename, report_file.content_type or "")

        # 3. Process and Store Optional Slides Document
        if slides_file and slides_file.filename:
            slides_file_name = slides_file.filename
            content = await slides_file.read()
            if len(content) > MAX_FILE_SIZE:
                raise HTTPException(status_code=400, detail="Le support de présentation dépasse la taille maximale (40 Mo).")

            slides_file_key = f"mock_defense/{user.id}/slides/{int(datetime.utcnow().timestamp())}_{slides_file.filename}"
            await storage.upload_file(content, slides_file_key)
            slides_text = DocumentAnalysisService.extract_text(content, slides_file.filename, slides_file.content_type or "")

        # Fallback text if user created without document (e.g. manual project specs)
        if not report_text.strip():
            report_text = f"Projet : {title}\nDescription : {description}\nTechnologies : {', '.join(tech_stack or [])}"

        # 4. Chunk document for lightweight RAG retrieval
        chunks = DocumentAnalysisService.chunk_document(report_text + "\n\n" + slides_text)

        # 5. Extract Project Knowledge Profile
        profile = DocumentAnalysisService.build_knowledge_profile(
            report_text=report_text,
            slides_text=slides_text,
            user_tech_stack=tech_stack or [],
            title=title,
            description=description
        )

        # 6. Parse Enums
        lang_enum = DefenseLanguage.FR
        if language.lower() == "en":
            lang_enum = DefenseLanguage.EN
        elif language.lower() == "ar":
            lang_enum = DefenseLanguage.AR

        diff_enum = DefenseDifficulty.INTERMEDIATE
        if difficulty.lower() == "beginner":
            diff_enum = DefenseDifficulty.BEGINNER
        elif difficulty.lower() == "expert":
            diff_enum = DefenseDifficulty.EXPERT

        mode_enum = DefenseMode.TRAINING
        if mode.upper() == "REALISTIC":
            mode_enum = DefenseMode.REALISTIC
        elif mode.upper() == "STRESS_TEST":
            mode_enum = DefenseMode.STRESS_TEST

        # 7. Generate Initial Questions
        max_q = min(SubscriptionUsageService.get_max_questions(user), 6 if mode_enum == DefenseMode.TRAINING else 8)
        initial_questions = await JuryQuestionGenerator.generate_initial_questions(
            knowledge_profile=profile,
            difficulty=diff_enum,
            mode=mode_enum,
            language=lang_enum,
            count=max_q,
            user_api_key=user.openai_api_key
        )

        simulation = MockDefenseSimulation(
            user_id=user.id,
            project_id=PydanticObjectId(project_id) if project_id else None,
            title=title,
            description=description,
            academic_level=academic_level,
            category=category,
            tech_stack=profile.technologies,
            language=lang_enum,
            difficulty=diff_enum,
            mode=mode_enum,
            duration_minutes=duration_minutes,
            report_file_name=report_file_name,
            report_file_key=report_file_key,
            slides_file_name=slides_file_name,
            slides_file_key=slides_file_key,
            status=SimulationStatus.READY,
            knowledge_profile=profile,
            document_chunks=chunks,
            questions=initial_questions,
            current_question_index=0,
            session_started_at=None,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc)
        )
        await simulation.insert()

        # 8. Record simulation count on user profile
        await SubscriptionUsageService.record_simulation_used(user)

        return simulation

    @classmethod
    async def get_simulation(cls, simulation_id: str, user: User) -> MockDefenseSimulation:
        try:
            obj_id = PydanticObjectId(simulation_id)
        except Exception:
            raise HTTPException(status_code=400, detail="Identifiant de simulation invalide.")

        sim = await MockDefenseSimulation.get(obj_id)
        if not sim:
            raise HTTPException(status_code=404, detail="Simulation introuvable.")

        # IDOR protection
        if sim.user_id != user.id and user.role != "ADMIN":
            raise HTTPException(status_code=403, detail="Accès non autorisé à cette simulation.")

        return sim

    @classmethod
    async def list_simulations(cls, user: User) -> List[MockDefenseSimulation]:
        return await MockDefenseSimulation.find(
            MockDefenseSimulation.user_id == user.id
        ).sort("-created_at").to_list()

    @classmethod
    async def start_session(cls, simulation_id: str, user: User) -> MockDefenseSimulation:
        sim = await cls.get_simulation(simulation_id, user)
        if sim.status in [SimulationStatus.PENDING, SimulationStatus.READY]:
            sim.status = SimulationStatus.IN_PROGRESS
            sim.session_started_at = datetime.now(timezone.utc)
            sim.updated_at = datetime.now(timezone.utc)
            await sim.save()
        return sim

    @classmethod
    async def submit_answer(
        cls,
        simulation_id: str,
        question_id: str,
        answer: str,
        answer_mode: str,
        audio_duration_seconds: Optional[float],
        user: User
    ) -> Dict[str, Any]:
        sim = await cls.get_simulation(simulation_id, user)
        if sim.status == SimulationStatus.COMPLETED:
            raise HTTPException(status_code=400, detail="Cette soutenance est déjà terminée.")

        # Ensure session is marked IN_PROGRESS
        if sim.status != SimulationStatus.IN_PROGRESS:
            sim.status = SimulationStatus.IN_PROGRESS
            sim.session_started_at = datetime.now(timezone.utc)

        # Locate target question
        q_idx = next((i for i, q in enumerate(sim.questions) if q.id == question_id), None)
        if q_idx is None:
            raise HTTPException(status_code=404, detail="Question introuvable dans cette simulation.")

        current_q = sim.questions[q_idx]

        # Oral delivery analysis if voice mode
        voice_metrics_obj = None
        if answer_mode == "voice":
            can_voice = await SubscriptionUsageService.can_use_voice(user)
            if not can_voice:
                raise HTTPException(status_code=403, detail="Le mode vocal est réservé aux membres Premium.")
            raw_metrics = SpeechTranscriptionService.analyze_oral_delivery(
                text=answer,
                duration_seconds=audio_duration_seconds or 15.0
            )
            voice_metrics_obj = VoiceMetrics(**raw_metrics)

        # Evaluate Answer
        evaluation = await AnswerEvaluationService.evaluate_answer(
            question=current_q,
            student_answer=answer,
            knowledge_profile=sim.knowledge_profile,
            language=sim.language,
            user_api_key=user.openai_api_key
        )

        current_q.student_answer = answer
        current_q.answer_mode = answer_mode
        current_q.voice_metrics = voice_metrics_obj
        current_q.answered_at = datetime.now(timezone.utc)
        current_q.evaluation = evaluation

        # Adaptive follow-up logic:
        # In Stress Test or Realistic mode, if criteria indicate need for deeper probe
        # and session max question limit is not yet reached, inject follow-up question
        max_q_allowed = SubscriptionUsageService.get_max_questions(user)
        has_follow_up = False
        follow_up_question = None

        if len(sim.questions) < max_q_allowed and (sim.mode == DefenseMode.STRESS_TEST or (sim.mode == DefenseMode.REALISTIC and evaluation.overallScore < 60)):
            follow_up_question = await JuryQuestionGenerator.generate_follow_up_question(
                current_question=current_q,
                student_answer=answer,
                evaluation_score=evaluation.overallScore,
                knowledge_profile=sim.knowledge_profile,
                language=sim.language,
                user_api_key=user.openai_api_key
            )
            if follow_up_question:
                sim.questions.insert(q_idx + 1, follow_up_question)
                # Re-index questions sequence
                for idx, q in enumerate(sim.questions):
                    q.question_number = idx + 1
                has_follow_up = True

        # Advance current question index
        sim.current_question_index = min(len(sim.questions), q_idx + 1)
        sim.updated_at = datetime.now(timezone.utc)
        await sim.save()

        is_finished = sim.current_question_index >= len(sim.questions)

        return {
            "question": current_q,
            "evaluation": evaluation,
            "has_follow_up": has_follow_up,
            "follow_up_question": follow_up_question,
            "is_finished": is_finished,
            "current_question_index": sim.current_question_index,
            "total_questions": len(sim.questions)
        }

    @classmethod
    async def get_hint(cls, simulation_id: str, question_id: str, user: User) -> str:
        sim = await cls.get_simulation(simulation_id, user)
        if sim.mode == DefenseMode.STRESS_TEST:
            raise HTTPException(
                status_code=400,
                detail="Les indices sont strictement désactivés en Mode Stress Test."
            )

        q = next((q for q in sim.questions if q.id == question_id), None)
        if not q:
            raise HTTPException(status_code=404, detail="Question introuvable.")

        return q.hint or "Structurez votre réponse en reliant votre décision technique à une contrainte concrète du projet."

    @classmethod
    async def finish_simulation(cls, simulation_id: str, user: User) -> MockDefenseSimulation:
        sim = await cls.get_simulation(simulation_id, user)
        if sim.status == SimulationStatus.COMPLETED and sim.final_report:
            return sim

        report = DefenseReportService.generate_final_report(sim)
        sim.final_report = report
        sim.status = SimulationStatus.COMPLETED
        sim.session_completed_at = datetime.now(timezone.utc)
        sim.updated_at = datetime.now(timezone.utc)
        await sim.save()
        return sim

    @classmethod
    async def delete_simulation(cls, simulation_id: str, user: User) -> None:
        sim = await cls.get_simulation(simulation_id, user)
        await sim.delete()
