import unittest
import asyncio
from app.models.mock_defense import (
    DefenseDifficulty, DefenseMode, DefenseLanguage, JuryRole,
    ProjectKnowledgeProfile, MockDefenseQuestion, AnswerEvaluation,
    EvaluationCriteria, MockDefenseSimulation, SimulationStatus
)
from app.services.mock_defense.document_analysis_service import DocumentAnalysisService
from app.services.mock_defense.jury_question_generator import JuryQuestionGenerator
from app.services.mock_defense.answer_evaluation_service import AnswerEvaluationService
from app.services.mock_defense.speech_transcription_service import SpeechTranscriptionService
from app.services.mock_defense.defense_report_service import DefenseReportService

class TestMockDefenseSimulator(unittest.TestCase):
    def setUp(self):
        self.sample_text = """
        Projet de Fin d'Études : Plateforme intelligente de gestion des thèses.
        Introduction et Problématique :
        Le processus actuel de suivi des mémoires de PFE souffre de retards et d'un manque de traçabilité.
        Objectifs du projet :
        Notre objectif est d'automatiser l'évaluation préliminaire, d'offrir une interface réactive et de sécuriser les données.
        Architecture et Technologies :
        Nous avons choisi une architecture découplée utilisant React, FastAPI, PostgreSQL et Docker.
        La sécurité repose sur des jetons JWT et le contrôle d'accès basé sur les rôles (RBAC).
        Base de données :
        PostgreSQL a été sélectionné pour sa robustesse transactionnelle ACID et sa gestion des contraintes d'intégrité relationnelle.
        Limites et Perspectives :
        L'analyse de charge sous forte concurrence n'a été menée que jusqu'à 500 requêtes/seconde.
        """

    def test_document_chunking_and_retrieval(self):
        chunks = DocumentAnalysisService.chunk_document(self.sample_text, chunk_size=300, overlap=50)
        self.assertGreater(len(chunks), 0)
        retrieved = DocumentAnalysisService.retrieve_relevant_chunks("PostgreSQL base de données", chunks, top_k=2)
        self.assertGreater(len(retrieved), 0)
        self.assertTrue(any("postgresql" in c["text"].lower() for c in retrieved))

    def test_knowledge_profile_extraction(self):
        profile = DocumentAnalysisService.build_knowledge_profile(
            report_text=self.sample_text,
            user_tech_stack=["React", "FastAPI"],
            title="Plateforme Thèses",
            description="Automatisation PFE"
        )
        self.assertIn("PostgreSQL", profile.database_choices)
        self.assertTrue(any("react" in t.lower() for t in profile.technologies))
        self.assertTrue(len(profile.objectives) > 0)
        self.assertTrue(len(profile.challengeable_claims) > 0)

    def test_question_generator(self):
        profile = DocumentAnalysisService.build_knowledge_profile(self.sample_text)
        questions = asyncio.run(JuryQuestionGenerator.generate_initial_questions(
            knowledge_profile=profile,
            difficulty=DefenseDifficulty.INTERMEDIATE,
            mode=DefenseMode.TRAINING,
            language=DefenseLanguage.FR,
            count=5
        ))
        self.assertEqual(len(questions), 5)
        self.assertEqual(questions[0].examiner_role, JuryRole.PRESIDENT)
        roles = {q.examiner_role for q in questions}
        self.assertTrue(JuryRole.PRESIDENT in roles)
        self.assertTrue(JuryRole.TECHNICAL in roles or JuryRole.CRITICAL in roles)

    def test_answer_evaluation(self):
        profile = DocumentAnalysisService.build_knowledge_profile(self.sample_text)
        question = MockDefenseQuestion(
            id="q1",
            question_number=1,
            examiner_role=JuryRole.TECHNICAL,
            examiner_name="Dr. Amina Mansouri",
            examiner_title="Examinatrice Technique",
            category="Base de Données",
            text="Pourquoi avez-vous choisi PostgreSQL pour votre projet ?",
            context_grounding="Choix de PostgreSQL"
        )
        student_answer = (
            "Nous avons choisi PostgreSQL parce que notre modèle de données requiert des transactions ACID strictes "
            "pour garantir l'intégrité des notes et des versions de rapports. Un compromis a été fait sur la flexibilité "
            "du schéma au profit de la robustesse relationnelle."
        )
        evaluation = asyncio.run(AnswerEvaluationService.evaluate_answer(
            question=question,
            student_answer=student_answer,
            knowledge_profile=profile,
            language=DefenseLanguage.FR
        ))
        self.assertGreaterEqual(evaluation.overallScore, 65.0)
        self.assertGreaterEqual(evaluation.criteria.technicalAccuracy, 60.0)
        self.assertTrue(len(evaluation.strengths) > 0)
        self.assertTrue(len(evaluation.improvedAnswer) > 0)

    def test_speech_delivery_metrics(self):
        speech_text = "Bonjour euh en fait nous avons développé cette solution euh du coup pour automatiser les tests."
        metrics = SpeechTranscriptionService.analyze_oral_delivery(speech_text, duration_seconds=6.0)
        self.assertGreaterEqual(metrics["filler_words_count"], 2)
        self.assertIn("euh", metrics["filler_words_detected"])
        self.assertGreater(metrics["words_per_minute"], 50.0)

    def test_final_report_generation(self):
        import types
        profile = DocumentAnalysisService.build_knowledge_profile(self.sample_text)
        sim = types.SimpleNamespace(
            questions=[
                MockDefenseQuestion(
                    id="q1",
                    question_number=1,
                    examiner_role=JuryRole.PRESIDENT,
                    examiner_name="Pr. Robert Laurent",
                    examiner_title="Président",
                    category="Objectifs",
                    text="Quelle est votre problématique ?",
                    student_answer="Notre problématique concerne les retards de relecture des rapports.",
                    evaluation=AnswerEvaluation(
                        overallScore=78.0,
                        criteria=EvaluationCriteria(
                            technicalAccuracy=80.0,
                            depthOfUnderstanding=75.0,
                            reasoning=80.0,
                            clarity=85.0,
                            justification=70.0,
                            completeness=78.0
                        ),
                        strengths=["Excellente clarté"],
                        weaknesses=["Préciser les métriques"],
                        missingPoints=["Quantifier les retards"],
                        technicalErrors=[],
                        improvedAnswer="Réponse modèle"
                    )
                )
            ],
            session_started_at=None
        )
        report = DefenseReportService.generate_final_report(sim)
        self.assertEqual(report.overall_score, 78.0)
        self.assertEqual(report.readiness_level, "Prêt pour la soutenance")
        self.assertIn("PRESIDENT", report.jury_performance)
        self.assertTrue(len(report.personalized_revision_plan) > 0)

if __name__ == "__main__":
    unittest.main()
