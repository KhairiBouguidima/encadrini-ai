import re
from typing import Dict, Any, Optional, List
from datetime import datetime, timezone
from app.models.mock_defense import (
    MockDefenseQuestion, ProjectKnowledgeProfile,
    AnswerEvaluation, EvaluationCriteria, DefenseLanguage
)
from app.services.mock_defense.ai_provider_adapter import AIProviderAdapter

class AnswerEvaluationService:
    @classmethod
    async def evaluate_answer(
        cls,
        question: MockDefenseQuestion,
        student_answer: str,
        knowledge_profile: ProjectKnowledgeProfile,
        language: DefenseLanguage,
        user_api_key: Optional[str] = None
    ) -> AnswerEvaluation:
        """
        Evaluates a defense answer across the 6 academic dimensions:
        Technical Accuracy, Depth, Reasoning, Clarity, Justification, Completeness.
        """
        clean_ans = student_answer.strip()
        word_count = len(re.findall(r"\w+", clean_ans))

        # 1. Attempt LLM evaluation if available
        system_prompt = f"""You are an elite academic jury examiner evaluating a student's answer during a graduation defense (PFE).
Language of defense: {language.value}.
Examiner role: {question.examiner_role.value} ({question.examiner_name}).
Question: "{question.text}"
Category: "{question.category}"

Evaluate the student's answer fairly and rigorously. Do not automatically penalize for technology choices; assess the depth of justification, technical accuracy, trade-off understanding, and coherence.

Return strictly a JSON object with this exact schema:
{{
  "overallScore": 75,
  "criteria": {{
    "technicalAccuracy": 80,
    "depthOfUnderstanding": 70,
    "reasoning": 75,
    "clarity": 80,
    "justification": 70,
    "completeness": 75
  }},
  "strengths": ["Clear explanation of X", "Good use of terminology"],
  "weaknesses": ["Omission of trade-off Y", "Lacked comparative metrics"],
  "missingPoints": ["Mention of ACID vs BASE", "Database failure mode"],
  "technicalErrors": [],
  "improvedAnswer": "An exemplary, comprehensive answer that an excellent candidate would provide in {language.value}...",
  "followUpQuestion": "Optional follow-up question or null",
  "examinerFeedback": "Brief in-character remark from {question.examiner_name}"
}}"""

        user_prompt = f"""Student Answer:
\"\"\"{clean_ans}\"\"\"

Project context summary:
Technologies: {', '.join(knowledge_profile.technologies[:5])}
Architecture: {knowledge_profile.architecture_summary}
Databases: {', '.join(knowledge_profile.database_choices)}"""

        llm_result = await AIProviderAdapter.generate_completion_json(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            max_tokens=1200,
            temperature=0.2,
            user_api_key=user_api_key
        )

        if llm_result and "overallScore" in llm_result and "criteria" in llm_result:
            crit_data = llm_result["criteria"]
            criteria = EvaluationCriteria(
                technicalAccuracy=float(crit_data.get("technicalAccuracy", 70)),
                depthOfUnderstanding=float(crit_data.get("depthOfUnderstanding", 70)),
                reasoning=float(crit_data.get("reasoning", 70)),
                clarity=float(crit_data.get("clarity", 70)),
                justification=float(crit_data.get("justification", 70)),
                completeness=float(crit_data.get("completeness", 70)),
            )
            return AnswerEvaluation(
                overallScore=float(llm_result["overallScore"]),
                criteria=criteria,
                strengths=llm_result.get("strengths", []),
                weaknesses=llm_result.get("weaknesses", []),
                missingPoints=llm_result.get("missingPoints", []),
                technicalErrors=llm_result.get("technicalErrors", []),
                improvedAnswer=llm_result.get("improvedAnswer", ""),
                followUpQuestion=llm_result.get("followUpQuestion"),
                examinerFeedback=llm_result.get("examinerFeedback"),
                evaluated_at=datetime.now(timezone.utc)
            )

        # 2. Robust Domain-Driven Semantic Evaluator fallback
        return cls._evaluate_fallback(question, clean_ans, knowledge_profile, language)

    @classmethod
    def _evaluate_fallback(
        cls,
        question: MockDefenseQuestion,
        answer: str,
        knowledge_profile: ProjectKnowledgeProfile,
        language: DefenseLanguage
    ) -> AnswerEvaluation:
        words = re.findall(r"\w+", answer.lower())
        word_count = len(words)

        # Dimension baseline scores
        accuracy = 60.0
        depth = 55.0
        reasoning = 60.0
        clarity = 70.0
        justification = 55.0
        completeness = 60.0

        strengths: List[str] = []
        weaknesses: List[str] = []
        missing_points: List[str] = []
        errors: List[str] = []

        # Analyze reasoning connectors
        has_reasoning = any(conn in answer.lower() for conn in [
            "parce que", "car", "afin de", "pour répondre", "compromis", "avantage", "inconvénient",
            "en raison de", "because", "in order to", "trade-off", "due to", "لأن", "من أجل", "بسبب"
        ])
        if has_reasoning:
            reasoning += 18.0
            justification += 15.0
            strengths.append("Bonne articulation des arguments avec connecteurs logiques de causalité.")
        else:
            reasoning -= 10.0
            weaknesses.append("Manque de justification causale directe : reliez vos constats aux causes techniques réelles.")

        # Analyze technical keywords
        tech_hits = [t for t in knowledge_profile.technologies if t.lower() in answer.lower()]
        if tech_hits:
            accuracy += 15.0
            depth += 15.0
            strengths.append(f"Mobilisation judicieuse des concepts techniques du projet ({', '.join(tech_hits[:3])}).")
        else:
            weaknesses.append("Vocabulaire un peu trop général : citez expressément vos frameworks, protocoles ou composants.")
            missing_points.append("Mention explicite des technologies et composants implémentés dans l'architecture.")

        # Depth based on length and structure
        if word_count > 60:
            depth += 12.0
            completeness += 15.0
            strengths.append("Développement suffisant permettant au jury de comprendre le déroulement de votre raisonnement.")
        elif word_count < 20:
            depth -= 25.0
            completeness -= 25.0
            weaknesses.append("Réponse excessivement brève pour une soutenance de niveau ingénieur / master.")
            missing_points.append("Exemples concrets et détails d'implémentation.")

        # Specific question topic expectations
        q_lower = question.text.lower()
        if "base de données" in q_lower or "database" in q_lower or "mongodb" in q_lower or "postgresql" in q_lower:
            has_db_concepts = any(c in answer.lower() for c in ["cohérence", "acid", "index", "requête", "relationnel", "nosql", "schema", "schéma"])
            if has_db_concepts:
                accuracy += 10.0
                justification += 10.0
                strengths.append("Prise en compte des propriétés intrinsèques de persistance et de modélisation des données.")
            else:
                missing_points.append("Comparaison des modèles de consistance (ACID vs BASE) et des volumes de requêtes.")
                weaknesses.append("Absence d'arguments sur la cohérence transactionnelle et les patrons d'accès aux données.")

        if "sécurité" in q_lower or "security" in q_lower:
            has_sec = any(s in answer.lower() for s in ["chiffrement", "jwt", "token", "hachage", "authentification", "injection", "validation"])
            if has_sec:
                accuracy += 10.0
                strengths.append("Clarté sur la protection des données et le contrôle d'accès.")
            else:
                missing_points.append("Précision sur les protocoles de chiffrement et la gestion des permissions RBAC.")

        # Clamp criteria
        accuracy = min(98.0, max(25.0, accuracy))
        depth = min(95.0, max(25.0, depth))
        reasoning = min(96.0, max(25.0, reasoning))
        clarity = min(95.0, max(30.0, clarity))
        justification = min(95.0, max(25.0, justification))
        completeness = min(95.0, max(25.0, completeness))

        overall = round(
            (accuracy * 0.25) +
            (depth * 0.20) +
            (reasoning * 0.20) +
            (clarity * 0.15) +
            (justification * 0.10) +
            (completeness * 0.10),
            1
        )

        # Model Answer in the requested language
        if language == DefenseLanguage.EN:
            improved = (
                f"An excellent response begins by grounding the rationale in concrete constraints: "
                f"'We selected our architecture and stack to solve three specific challenges: throughput, maintainability, and team delivery velocity. "
                f"Regarding the database choice, the document structure allowed us to iterate quickly without migration bottlenecks, while ensuring transactional integrity for critical writes.' "
                f"Always contrast the benefits with accepted trade-offs."
            )
            feedback = f"Your answer demonstrates potential, but remember that the jury expects quantified evidence and clear technical trade-offs."
        elif language == DefenseLanguage.AR:
            improved = (
                f"تبدأ الإجابة الممتازة بربط القرار الهندسي بقيود المشروع الفعلية: "
                f"'لقد اعتمدنا هذا الاختيار لتلبية ثلاثة متطلبات دقيقة: سرعة الاستجابة، وقابلية الصيانة، وأمان تدفق البيانات. "
                f"وفيما يتعلق بنمذجة البيانات، راعينا حجم المعاملات وطبيعة الاستعلامات المتكررة مع ضمان اتساق السجلات الحساسة.' "
                f"احرص دائمًا على توضيح المقايضة التقنية (Trade-off)."
            )
            feedback = f"إجابتك تبرز الفكرة العامة، لكن اللجنة تنتظر دقة هندسية أعلى وربطًا مباشرًا بالأداء."
        else:
            improved = (
                f"Une excellente réponse s'articule ainsi : "
                f"1. Rappeler la contrainte métier et technique (ex: volume de requêtes, criticité de la disponibilité). "
                f"2. Justifier le choix technique sélectionné en mentionnant un compromis réel (ex: flexibilité du schéma versus cohérence stricte). "
                f"3. Démontrer par une métrique ou un test concret que cette solution répondait au cahier des charges sans introduire de dette technique majeure."
            )
            feedback = f"Votre argumentation pose les bases, mais le jury universitaire attend des éléments chiffrés et la confrontation à une solution alternative."

        if not strengths:
            strengths.append("Réponse intelligible qui aborde le sujet posé.")
        if not weaknesses:
            weaknesses.append("La réponse pourrait gagner en précision chiffrée (latence, taux de couverture, benchmarking).")
        if not missing_points:
            missing_points.append("Comparaison objective avec les autres approches du marché.")

        return AnswerEvaluation(
            overallScore=overall,
            criteria=EvaluationCriteria(
                technicalAccuracy=accuracy,
                depthOfUnderstanding=depth,
                reasoning=reasoning,
                clarity=clarity,
                justification=justification,
                completeness=completeness,
            ),
            strengths=strengths,
            weaknesses=weaknesses,
            missingPoints=missing_points,
            technicalErrors=errors,
            improvedAnswer=improved,
            followUpQuestion=None,
            examinerFeedback=feedback,
            evaluated_at=datetime.now(timezone.utc)
        )
