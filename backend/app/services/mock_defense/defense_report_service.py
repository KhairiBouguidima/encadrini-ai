from datetime import datetime, timezone
from typing import Dict, Any, List
from app.models.mock_defense import (
    MockDefenseSimulation, MockDefenseReport, JuryRole
)

class DefenseReportService:
    @classmethod
    def generate_final_report(cls, simulation: MockDefenseSimulation) -> MockDefenseReport:
        answered_questions = [q for q in simulation.questions if q.evaluation is not None]

        if not answered_questions:
            return MockDefenseReport(
                overall_score=0.0,
                readiness_level="Non évalué",
                criteria_averages={},
                jury_performance={},
                category_performance={},
                strongest_answers=[],
                weakest_answers=[],
                repeated_mistakes=["Aucune réponse soumise."],
                knowledge_gaps=["Session incomplète."],
                technical_concepts_to_revise=[],
                recommended_model_answers=[],
                personalized_revision_plan=[],
                suggested_next_questions=["Présentez la problématique générale de votre projet."],
                completed_at=datetime.now(timezone.utc)
            )

        # 1. Overall & Criterion averages
        scores = [q.evaluation.overallScore for q in answered_questions]
        overall_score = round(sum(scores) / len(scores), 1)

        crit_keys = ["technicalAccuracy", "depthOfUnderstanding", "reasoning", "clarity", "justification", "completeness"]
        criteria_averages: Dict[str, float] = {}
        for k in crit_keys:
            vals = [getattr(q.evaluation.criteria, k, 0.0) for q in answered_questions]
            criteria_averages[k] = round(sum(vals) / len(vals), 1) if vals else 0.0

        # 2. Performance by Jury Examiner
        jury_scores: Dict[str, List[float]] = {
            JuryRole.PRESIDENT.value: [],
            JuryRole.TECHNICAL.value: [],
            JuryRole.CRITICAL.value: []
        }
        for q in answered_questions:
            jury_scores[q.examiner_role.value].append(q.evaluation.overallScore)

        jury_performance = {
            role: (round(sum(vals) / len(vals), 1) if vals else overall_score)
            for role, vals in jury_scores.items()
        }

        # 3. Performance by Question Category
        cat_scores: Dict[str, List[float]] = {}
        for q in answered_questions:
            cat = q.category.split("(")[0].strip()
            cat_scores.setdefault(cat, []).append(q.evaluation.overallScore)

        category_performance = {
            cat: round(sum(vals) / len(vals), 1)
            for cat, vals in cat_scores.items()
        }

        # 4. Readiness Level determination
        if overall_score >= 85:
            readiness_level = "Excellente préparation — Prêt avec Mention"
        elif overall_score >= 70:
            readiness_level = "Prêt pour la soutenance"
        elif overall_score >= 55:
            readiness_level = "Satisfaisant — Points techniques à consolider"
        elif overall_score >= 40:
            readiness_level = "En progrès — Des lacunes d'argumentation importantes"
        else:
            readiness_level = "Insuffisant — Nécessite un entraînement intensif"

        # 5. Strongest vs Weakest answers
        sorted_by_score = sorted(answered_questions, key=lambda x: x.evaluation.overallScore, reverse=True)
        strongest = [
            {
                "question_id": q.id,
                "question_number": q.question_number,
                "text": q.text,
                "score": q.evaluation.overallScore,
                "student_answer": q.student_answer,
                "strengths": q.evaluation.strengths,
            }
            for q in sorted_by_score[:2]
        ]
        weakest = [
            {
                "question_id": q.id,
                "question_number": q.question_number,
                "text": q.text,
                "score": q.evaluation.overallScore,
                "student_answer": q.student_answer,
                "weaknesses": q.evaluation.weaknesses,
                "missingPoints": q.evaluation.missingPoints,
            }
            for q in sorted_by_score[-2:]
        ]

        # 6. Repeated mistakes & Knowledge gaps
        repeated_mistakes: List[str] = []
        knowledge_gaps: List[str] = []
        for q in answered_questions:
            for w in q.evaluation.weaknesses:
                if w not in repeated_mistakes and len(repeated_mistakes) < 4:
                    repeated_mistakes.append(w)
            for m in q.evaluation.missingPoints:
                if m not in knowledge_gaps and len(knowledge_gaps) < 4:
                    knowledge_gaps.append(m)

        if not repeated_mistakes:
            repeated_mistakes.append("Tendance à des formulations succinctes sans comparaison chiffrée.")
        if not knowledge_gaps:
            knowledge_gaps.append("Approfondir la justification des choix de stockage face aux contraintes concurrentes.")

        # 7. Technical concepts to revise
        tech_concepts = []
        if criteria_averages.get("justification", 0) < 70:
            tech_concepts.append("Méthodologie d'analyse comparative des technologies (critères de sélection et compromis)")
        if criteria_averages.get("technicalAccuracy", 0) < 75:
            tech_concepts.append("Vocabulaire formel d'architecture logicielle (patrons de conception, découplage)")
        tech_concepts.extend([
            "Modèles de consistance et tolérance aux pannes des bases de données",
            "Mesures de sécurité applicative (authentification JWT, RBAC, chiffrement au repos et en transit)",
            "Stratégie de tests (couverture unitaire, tests de charge et métriques de validation)"
        ])
        tech_concepts = tech_concepts[:4]

        # 8. Recommended model answers for the lowest scoring questions
        model_answers = []
        for q in sorted_by_score[-2:]:
            model_answers.append({
                "question": q.text,
                "model_answer": q.evaluation.improvedAnswer or (
                    "Une réponse réussie combine : énoncé de la contrainte, démonstration du compromis technique, "
                    "et preuve empirique issue des tests du projet."
                ),
                "examiner": q.examiner_name
            })

        # 9. Personalized revision plan
        revision_plan = [
            {
                "id": "rev-1",
                "priority": "critical" if criteria_averages.get("justification", 0) < 65 else "important",
                "title": "Structurer la justification du choix de la pile technologique",
                "description": "Préparer un tableau comparatif mental : pourquoi cette technologie plutôt qu'une concurrente, en citant les contraintes précises du projet.",
                "estimated_gain": "+10 points sur la dimension Justification",
                "estimated_time": "1 heure"
            },
            {
                "id": "rev-2",
                "priority": "important",
                "title": "Maîtriser les scénarios de panne et résilience",
                "description": "Formuler une réponse claire aux questions 'Que se passe-t-il si le service X tombe ?' en décrivant la gestion d'erreurs et les timeouts.",
                "estimated_gain": "+8 points face à l'examinateur critique",
                "estimated_time": "45 minutes"
            },
            {
                "id": "rev-3",
                "priority": "minor",
                "title": "Répéter l'introduction de 2 minutes en respectant le tempo oral",
                "description": "S'entraîner à résumer la problématique sans hésitation avec un débit compris entre 110 et 140 mots par minute.",
                "estimated_gain": "+5 points sur la Clarté et la fluidité",
                "estimated_time": "30 minutes"
            }
        ]

        # 10. Suggested questions for next simulation
        next_questions = [
            "Comment avez-vous validé la résistance de votre API sous forte charge ?",
            "Quelles sont les failles potentielles de votre modèle d'authentification ?",
            "Quel retour d'expérience tirez-vous de la modélisation de vos entités de données ?"
        ]

        total_duration = None
        if simulation.session_started_at:
            delta = (datetime.now(timezone.utc) - simulation.session_started_at.replace(tzinfo=timezone.utc)).total_seconds()
            total_duration = int(max(60, delta))

        return MockDefenseReport(
            overall_score=overall_score,
            readiness_level=readiness_level,
            criteria_averages=criteria_averages,
            jury_performance=jury_performance,
            category_performance=category_performance,
            strongest_answers=strongest,
            weakest_answers=weakest,
            repeated_mistakes=repeated_mistakes,
            knowledge_gaps=knowledge_gaps,
            technical_concepts_to_revise=tech_concepts,
            recommended_model_answers=model_answers,
            personalized_revision_plan=revision_plan,
            suggested_next_questions=next_questions,
            total_duration_seconds=total_duration,
            completed_at=datetime.now(timezone.utc)
        )
