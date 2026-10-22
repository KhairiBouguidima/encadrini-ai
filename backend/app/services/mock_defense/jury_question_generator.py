import uuid
from typing import List, Dict, Any, Optional
from app.models.mock_defense import (
    JuryRole, DefenseDifficulty, DefenseMode, DefenseLanguage,
    MockDefenseQuestion, ProjectKnowledgeProfile
)
from app.services.mock_defense.ai_provider_adapter import AIProviderAdapter

JURY_MEMBERS = {
    JuryRole.PRESIDENT: {
        "name": "Pr. Robert Laurent",
        "title": "Président du Jury & Professeur des Universités",
        "intro_fr": "Bonjour. Nous allons commencer votre soutenance. En tant que président du jury, je veillerai au bon déroulement de cette séance.",
        "intro_en": "Good morning. We will now begin your defense. As the jury president, I will oversee the progression of this session.",
        "intro_ar": "مرحبًا بكم. سنبدأ الآن مناقشة مشروعكم. بصفتي رئيسًا للجنة، سأتولى إدارة هذه الجلسة.",
    },
    JuryRole.TECHNICAL: {
        "name": "Dr. Amina Mansouri",
        "title": "Examinatrice Technique & Maître de Conférences en Génie Logiciel",
        "intro_fr": "Bonjour. J'ai examiné vos choix techniques et votre architecture. Nous allons approfondir les aspects d'ingénierie.",
        "intro_en": "Hello. I have thoroughly reviewed your technical architecture and engineering choices. Let us dive into the implementation details.",
        "intro_ar": "أهلاً بك. لقد اطلعت بدقة على اختياراتكم التقنية وهندسة النظام. سنتناول بالتفصيل الجوانب البرمجية والتطبيقية.",
    },
    JuryRole.CRITICAL: {
        "name": "Dr. Philippe Durand",
        "title": "Examinateur Critique & Chercheur Invité",
        "intro_fr": "Bonjour. Mon rôle est d'analyser la robustesse de votre travail, vos hypothèses de départ et les limites de votre approche.",
        "intro_en": "Good morning. My role is to challenge the edge cases, design compromises, and potential limitations of your project.",
        "intro_ar": "مرحبًا. دوري يكمن في فحص متانة هذا العمل، ومناقشة الفرضيات والحدود التقنية لنهجكم.",
    }
}

class JuryQuestionGenerator:
    @classmethod
    async def generate_initial_questions(
        cls,
        knowledge_profile: ProjectKnowledgeProfile,
        difficulty: DefenseDifficulty,
        mode: DefenseMode,
        language: DefenseLanguage,
        count: int = 5,
        user_api_key: Optional[str] = None
    ) -> List[MockDefenseQuestion]:
        """
        Generates a tailored sequence of jury questions adapted to the project's actual tech stack,
        architecture, and limitations. Uses LLM if available, with intelligent contextual fallback.
        """
        tech_list = ", ".join(knowledge_profile.technologies[:6]) or "Technologies modernes"
        db_choice = knowledge_profile.database_choices[0] if knowledge_profile.database_choices else "la base de données"

        # Try LLM generation first
        system_prompt = f"""You are an elite academic jury for a graduation project defense.
Language of defense: {language.value}.
Difficulty level: {difficulty.value}.
Generate exactly {count} realistic, challenging, and strictly grounded jury defense questions.
Alternate between examiners:
1. PRESIDENT: general problem, motivation, objectives, methodology.
2. TECHNICAL: architecture, tech stack ({tech_list}), DB ({db_choice}), APIs, security, testing.
3. CRITICAL: edge cases, trade-offs, limitations, unsupported claims, failure modes.

Return JSON schema:
{{
  "questions": [
    {{
      "examiner_role": "PRESIDENT" | "TECHNICAL" | "CRITICAL",
      "category": "Architecture" | "Base de données" | "Sécurité" | "Objectifs & Méthodologie" | "Limitations",
      "text": "Question text in {language.value}",
      "context_grounding": "Reason grounded in student's project",
      "hint": "Pedagogical hint for the student"
    }}
  ]
}}"""

        user_prompt = f"""Project Title & Overview:
Problem statement: {knowledge_profile.problem_statement}
Objectives: {', '.join(knowledge_profile.objectives)}
Architecture: {knowledge_profile.architecture_summary}
Tech stack: {tech_list}
Database: {', '.join(knowledge_profile.database_choices)}
Limitations: {', '.join(knowledge_profile.technical_limitations)}"""

        llm_result = await AIProviderAdapter.generate_completion_json(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            max_tokens=2000,
            temperature=0.4,
            user_api_key=user_api_key
        )

        if llm_result and "questions" in llm_result and len(llm_result["questions"]) > 0:
            parsed_questions = []
            for i, q in enumerate(llm_result["questions"][:count]):
                role = JuryRole.PRESIDENT if q.get("examiner_role") == "PRESIDENT" else (
                    JuryRole.TECHNICAL if q.get("examiner_role") == "TECHNICAL" else JuryRole.CRITICAL
                )
                member = JURY_MEMBERS[role]
                parsed_questions.append(MockDefenseQuestion(
                    id=str(uuid.uuid4()),
                    question_number=i + 1,
                    examiner_role=role,
                    examiner_name=member["name"],
                    examiner_title=member["title"],
                    category=q.get("category", "Architecture"),
                    difficulty=difficulty,
                    text=q.get("text", ""),
                    context_grounding=q.get("context_grounding"),
                    hint=q.get("hint")
                ))
            return parsed_questions

        # Domain-driven Fallback Generator grounded in actual student profile
        return cls._generate_contextual_fallback_questions(
            knowledge_profile=knowledge_profile,
            difficulty=difficulty,
            language=language,
            count=count
        )

    @classmethod
    def _generate_contextual_fallback_questions(
        cls,
        knowledge_profile: ProjectKnowledgeProfile,
        difficulty: DefenseDifficulty,
        language: DefenseLanguage,
        count: int = 5
    ) -> List[MockDefenseQuestion]:
        techs = knowledge_profile.technologies
        primary_tech = techs[0] if techs else "l'architecture choisie"
        secondary_tech = techs[1] if len(techs) > 1 else "vos services backend"
        db = knowledge_profile.database_choices[0] if knowledge_profile.database_choices else "MongoDB ou PostgreSQL"

        # French question bank
        q_fr = [
            (
                JuryRole.PRESIDENT,
                "Objectifs & Méthodologie",
                "Pouvez-vous synthétiser la problématique principale de votre PFE et expliquer précisément en quoi votre solution se distingue des approches existantes ?",
                "Cadrage du projet et proposition de valeur.",
                "Structurez votre réponse en 3 temps : Contexte du besoin, limites des solutions existantes, et valeur ajoutée tangible de votre apport."
            ),
            (
                JuryRole.TECHNICAL,
                "Architecture & Choix Techniques",
                f"Pourquoi avoir sélectionné {primary_tech} et {secondary_tech} pour cette implémentation ? Quels compromis de performance et de maintenabilité avez-vous consentis ?",
                f"Justification argumentée de {primary_tech} face aux alternatives.",
                "Évitez de citer des arguments marketing. Expliquez les contraintes techniques concrètes du projet justifiant ces choix."
            ),
            (
                JuryRole.TECHNICAL,
                "Base de Données & Modélisation",
                f"Comment justifiez-vous le choix de {db} plutôt qu'une solution alternative (ex. relationnelle vs NoSQL) ? Comment garantissez-vous l'intégrité et la scalabilité de vos données ?",
                f"Modélisation des données avec {db}.",
                "Comparez le modèle de cohérence (ACID vs BASE), le volume de données attendu et les requêtes critiques de votre application."
            ),
            (
                JuryRole.CRITICAL,
                "Résilience & Cas Limites",
                "Que se passerait-il si votre service principal devenait indisponible ou subissait une charge dix fois supérieure à vos prévisions lors d'une opération critique ?",
                "Gestion des pannes, résilience et tolérance aux défaillances.",
                "Mentionnez les mécanismes de repli : timeouts, disjoncteurs (circuit-breakers), files d'attente asynchrones ou réplication."
            ),
            (
                JuryRole.TECHNICAL,
                "Sécurité & Fiabilité",
                "Quels vecteurs d'attaque avez-vous identifiés et comment avez-vous sécurisé les flux sensibles (authentification, chiffrement, validation des entrées) ?",
                "Protection des données sensibles et conformité de sécurité.",
                "Citez les protocoles appliqués (ex: JWT avec rotation, hachage des mots de passe, contrôle d'accès RBAC et sanitization)."
            ),
            (
                JuryRole.CRITICAL,
                "Limitations & Rétrospective",
                "Si vous deviez recommencer ce projet avec l'expérience acquise aujourd'hui, quelle décision technique modifieriez-vous et pourquoi ?",
                "Capacité de recul critique et d'auto-évaluation de l'ingénieur.",
                "Faites preuve d'honnêteté intellectuelle. Choisissez un compromis technique réel et démontrez comment vous le surmonteriez."
            )
        ]

        # English question bank
        q_en = [
            (
                JuryRole.PRESIDENT,
                "Objectives & Methodology",
                "Could you synthesize the primary research problem of your graduation project and explain how your solution adds concrete value compared to existing platforms?",
                "Project scope and tangible value proposition.",
                "Structure your answer into: Problem context, drawbacks of existing tools, and your specific innovative contribution."
            ),
            (
                JuryRole.TECHNICAL,
                "Architecture & Tech Stack",
                f"What technical criteria led you to choose {primary_tech} and {secondary_tech}? What trade-offs in terms of scalability and maintainability did you accept?",
                f"Architectural rationale behind {primary_tech}.",
                "Avoid generic arguments. Discuss real system constraints, developer ergonomics, and performance throughput."
            ),
            (
                JuryRole.TECHNICAL,
                "Database & Data Modeling",
                f"Why did you choose {db} for this specific workload? How do you ensure data consistency and low-latency queries under high concurrency?",
                f"Data modeling with {db}.",
                "Address consistency models (ACID vs BASE), schema design, indexing strategies, and read/write access patterns."
            ),
            (
                JuryRole.CRITICAL,
                "Reliability & Failure Modes",
                "What happens to critical project operations if your main service or third-party dependency encounters a sudden outage?",
                "Fault tolerance and recovery strategies.",
                "Detail your fallback strategies: graceful degradation, circuit breaker patterns, queuing, or idempotency keys."
            ),
            (
                JuryRole.CRITICAL,
                "Limitations & Technical Retrospective",
                "If you were to start this graduation project over from scratch today, what technical decision would you change and why?",
                "Critical thinking and retrospective maturity.",
                "Demonstrate intellectual honesty by analyzing a genuine trade-off and explaining a more robust alternative design."
            )
        ]

        # Arabic question bank
        q_ar = [
            (
                JuryRole.PRESIDENT,
                "الأهداف والمنهجية",
                "هل يمكنك تلخيص الإشكالية الأساسية لمشروع التخرج وتوضيح القيمة المضافة الفعلية لحلك مقارنة بالحلول الموجودة؟",
                "سياق المشروع والهدف الأساسي.",
                "قسّم إجابتك إلى: سياق الإشكالية، عيوب الحلول الحالية، والحل المبتكر الذي قدمته."
            ),
            (
                JuryRole.TECHNICAL,
                "الهندسة المعمارية والتقنيات",
                f"ما هي المبررات التقنية لاختيار {primary_tech} و {secondary_tech}؟ وما هي التنازلات من حيث الأداء وقابلية الصيانة؟",
                f"تبرير الاختيارات البرمجية لـ {primary_tech}.",
                "تجنب الإجابات العامة وتحدث عن قيود النظام الفعلية وسرعة المعالجة."
            ),
            (
                JuryRole.TECHNICAL,
                "قواعد البيانات ونمذجة البيانات",
                f"لماذا اخترت {db} لهذا الاستخدام بالتحديد؟ وكيف تضمن اتساق البيانات والتعامل مع الضغط العالي؟",
                f"نمذجة البيانات باستخدام {db}.",
                "قارن بين نماذج الاتساق (ACID vs BASE)، ونظام الفهرسة، وطبيعة الاستعلامات المتكررة."
            ),
            (
                JuryRole.CRITICAL,
                "المرونة والتعامل مع الأعطال",
                "ماذا يحدث للعمليات الحساسة في حال تعطل أحد الخدمات الأساسية أو انقطاع الاتصال بقاعدة البيانات؟",
                "مقاومة الأعطال والاستمرارية.",
                "تحدث عن آليات التعافي: العزل، الطوابير غير المتزامنة، وإعادة المحاولة التلقائية."
            ),
            (
                JuryRole.CRITICAL,
                "الحدود والتقييم النقدي",
                "إذا أتيحت لك الفرصة لإعادة تنفيذ هذا المشروع اليوم، ما هو القرار التقني الذي ستغيره ولماذا؟",
                "التفكير النقدي والنضج الهندسي.",
                "أظهر شفافية في توضيح المقايضة الهندسية والبديل الأنسب بناءً على النتائج."
            )
        ]

        bank = q_fr if language == DefenseLanguage.FR else (q_en if language == DefenseLanguage.EN else q_ar)
        selected = bank[:count]

        questions: List[MockDefenseQuestion] = []
        for i, item in enumerate(selected):
            role, cat, text, grounding, hint = item
            member = JURY_MEMBERS[role]
            questions.append(MockDefenseQuestion(
                id=str(uuid.uuid4()),
                question_number=i + 1,
                examiner_role=role,
                examiner_name=member["name"],
                examiner_title=member["title"],
                category=cat,
                difficulty=difficulty,
                text=text,
                context_grounding=grounding,
                hint=hint
            ))

        return questions

    @classmethod
    async def generate_follow_up_question(
        cls,
        current_question: MockDefenseQuestion,
        student_answer: str,
        evaluation_score: float,
        knowledge_profile: ProjectKnowledgeProfile,
        language: DefenseLanguage,
        user_api_key: Optional[str] = None
    ) -> Optional[MockDefenseQuestion]:
        """
        Dynamically adapts jury questioning based on the student's answer:
        - If high score (> 75): Deep technical follow-up exploring internal mechanics or edge case.
        - If low/vague (< 55): Probing follow-up challenging the missing justification.
        """
        examiner_role = current_question.examiner_role
        member = JURY_MEMBERS[examiner_role]

        system_prompt = f"""You are {member['name']} ({member['title']}).
A student in an academic defense just answered your question: "{current_question.text}".
Their answer: "{student_answer}".
Evaluation score: {evaluation_score}/100.
Language: {language.value}.

Generate a sharp, professional follow-up question in character.
- If score >= 70: Acknowledge the point and push deeper into architectural nuance or stress condition.
- If score < 70: Challenge the specific omission or weak justification.

Return JSON:
{{
  "text": "Follow-up question in {language.value}",
  "hint": "Brief hint"
}}"""

        llm_result = await AIProviderAdapter.generate_completion_json(
            system_prompt=system_prompt,
            user_prompt="Generate follow-up question now.",
            max_tokens=400,
            temperature=0.3,
            user_api_key=user_api_key
        )

        if llm_result and "text" in llm_result:
            return MockDefenseQuestion(
                id=str(uuid.uuid4()),
                question_number=current_question.question_number + 1,
                examiner_role=examiner_role,
                examiner_name=member["name"],
                examiner_title=member["title"],
                category=f"{current_question.category} (Approfondissement)",
                difficulty=DefenseDifficulty.EXPERT if evaluation_score >= 70 else DefenseDifficulty.INTERMEDIATE,
                text=llm_result["text"],
                context_grounding="Question de relance adaptative basée sur votre réponse précédente.",
                hint=llm_result.get("hint", "Approfondissez les arguments techniques et justifiez avec des métriques concrètes."),
                is_follow_up=True
            )

        # High quality fallback follow-up
        if evaluation_score >= 70:
            text = f"Votre argumentation est intéressante. Cependant, comment validez-vous ce choix sous de fortes contraintes de concurrence et quelles métriques précises confirment votre hypothèse ?"
        else:
            text = f"Vous avez exposé les aspects généraux, mais vous n'avez pas justifié les compromis techniques réels face à une solution concurrente. Quels sont les critères quantifiables qui ont motivé votre décision ?"

        return MockDefenseQuestion(
            id=str(uuid.uuid4()),
            question_number=current_question.question_number + 1,
            examiner_role=examiner_role,
            examiner_name=member["name"],
            examiner_title=member["title"],
            category=f"{current_question.category} (Précision)",
            difficulty=DefenseDifficulty.INTERMEDIATE,
            text=text,
            context_grounding="Approfondissement de l'argumentation technique.",
            hint="Précisez votre réponse en reliant la contrainte technique à un cas d'usage concret.",
            is_follow_up=True
        )
