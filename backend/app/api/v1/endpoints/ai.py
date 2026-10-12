from typing import List, Optional
from fastapi import APIRouter, HTTPException, status, Depends, BackgroundTasks
from beanie import PydanticObjectId

from app.models.user import User, UserRole
from app.models.project import Project
from app.models.report import Report, AIAnalysisStatus
from app.models.ai_analysis import AIAnalysis
from app.api.deps import get_current_user
from app.schemas.ai import AIAnalysisResponse, ChatRequest, ChatResponse, CheckAIRequest, CheckAIResponse
from app.workers.ai_analysis_worker import run_ai_analysis
from app.ai.ai_provider import get_ai_provider

router = APIRouter()

@router.get("/reports/{report_id}/version/{version_number}", response_model=AIAnalysisResponse)
async def get_ai_analysis(
    report_id: PydanticObjectId,
    version_number: int,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user)
):
    """Fetch the AI analysis results for a specific report version."""
    report = await Report.get(report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found.")

    # IDOR guard: verify the requesting user owns or supervises this project
    project = await Project.get(report.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found.")

    if (
        project.student_id != current_user.id
        and project.encadrer_id != current_user.id
        and current_user.role != UserRole.ADMIN
    ):
        raise HTTPException(status_code=403, detail="Access denied.")

    # Check version exists
    version = next((v for v in report.versions if v.version_number == version_number), None)
    if not version:
        raise HTTPException(status_code=404, detail=f"Version {version_number} not found.")

    analysis = await AIAnalysis.find_one(
        AIAnalysis.report_id == report.id,
        AIAnalysis.version_number == version_number
    )
    if not analysis:
        # Automatically trigger background analysis if not already running
        if version.ai_analysis_status != AIAnalysisStatus.PROCESSING:
            background_tasks.add_task(run_ai_analysis, str(report.id), version_number)
            version.ai_analysis_status = AIAnalysisStatus.PROCESSING
            await report.save()

        return AIAnalysisResponse(
            status=version.ai_analysis_status.value,
            report_id=str(report.id),
            version_number=version_number,
            scores=None,
            missing_sections=[],
            corrections=[],
            generated_content=None,
        )

    dim_scores = None
    if analysis.scores.dimension_scores:
        dim_scores = {
            "structure": analysis.scores.dimension_scores.structure,
            "methodology": analysis.scores.dimension_scores.methodology,
            "language": analysis.scores.dimension_scores.language,
            "formatting": analysis.scores.dimension_scores.formatting,
            "citations": analysis.scores.dimension_scores.citations,
        }

    roadmap_list = [
        {
            "id": r.id,
            "title": r.title,
            "description": r.description,
            "priority": r.priority,
            "dimension": r.dimension,
            "estimated_gain": r.estimated_gain,
            "estimated_effort": r.estimated_effort,
            "completed": r.completed,
        }
        for r in getattr(analysis, "roadmap", [])
    ]

    return AIAnalysisResponse(
        status=version.ai_analysis_status.value,
        report_id=str(report.id),
        version_number=version_number,
        scores={
            "linguistic": analysis.scores.linguistic,
            "structural": analysis.scores.structural,
            "coherence": analysis.scores.coherence,
            "overall_quality": analysis.scores.overall_quality,
        },
        readiness_score=analysis.scores.readiness_score or analysis.scores.overall_quality,
        readiness_level=analysis.scores.readiness_level or "Satisfaisant",
        dimension_scores=dim_scores,
        missing_sections=analysis.missing_sections,
        corrections=[
            {
                "page": c.page,
                "original": c.original,
                "suggestion": c.suggestion,
                "explanation": c.explanation,
            } for c in analysis.corrections
        ],
        generated_content={
            "summary": analysis.generated_content.summary,
            "abstract": analysis.generated_content.abstract,
            "keywords": analysis.generated_content.keywords,
            "jury_questions": analysis.generated_content.jury_questions,
            "formatting_issues": getattr(analysis.generated_content, "formatting_issues", []) or getattr(analysis, "formatting_issues", []),
        },
        roadmap=roadmap_list,
    )


@router.post("/chat", response_model=ChatResponse)
async def chat_with_agent(
    request: ChatRequest,
    current_user: User = Depends(get_current_user)
):
    """Chat with AI agent about a specific report."""
    import requests as req
    from app.core.config import settings

    # Load analysis context if available
    context_summary = ""
    try:
        from beanie import PydanticObjectId as ObjId
        report = await Report.get(ObjId(request.report_id))
        if report:
            analysis = await AIAnalysis.find_one(
                AIAnalysis.report_id == report.id,
                AIAnalysis.version_number == request.version_number
            )
            if analysis and analysis.generated_content:
                context_summary = f"""
Tu as accès aux informations suivantes sur le rapport de l'étudiant :
- Résumé du rapport : {analysis.generated_content.summary}
- Mots-clés : {', '.join(analysis.generated_content.keywords)}
- Score global : {analysis.scores.overall_quality}/100
- Sections manquantes : {', '.join(analysis.missing_sections) or 'Aucune'}
"""
    except Exception:
        pass

    system_prompt = f"""Tu es un assistant académique expert PFE (Projet de Fin d'Études) appelé "Encadrini AI".
Tu aides les étudiants à améliorer leur rapport de PFE de manière bienveillante, constructive et pédagogique.
Tu réponds toujours en français.
Tu es précis, concis et tu donnes des exemples concrets quand c'est utile.
{context_summary}
Ne mentionne jamais que tu es un LLM ou une IA - tu es l'assistant Encadrini.
"""

    api_key = settings.OPENAI_API_KEY or ""
    messages_payload = [{"role": "system", "content": system_prompt}]
    for msg in request.messages:
        messages_payload.append({"role": msg.role, "content": msg.content})

    # Try LLM API
    if api_key and api_key not in ["", "sk-fake-key-for-dev"]:
        try:
            if api_key.startswith("xai-"):
                url = "https://api.x.ai/v1/chat/completions"
                model = "grok-3-mini"
            else:
                url = "https://api.openai.com/v1/chat/completions"
                model = "gpt-4o-mini"

            resp = req.post(
                url,
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                json={"model": model, "messages": messages_payload, "temperature": 0.7},
                timeout=30,
            )
            if resp.status_code == 200:
                reply = resp.json()["choices"][0]["message"]["content"]
                return ChatResponse(reply=reply)
        except Exception as e:
            print(f"[chat] LLM error: {e}", flush=True)

    # Smart rule-based fallback agent
    last_user_msg = request.messages[-1].content.lower() if request.messages else ""
    no_summary_msg = "Le résumé n'est pas encore disponible. Veuillez patienter que l'analyse soit terminée."

    if any(w in last_user_msg for w in ["résumé", "resume", "résumer", "résume"]):
        reply = f"Voici le résumé de votre rapport :\n\n{context_summary or no_summary_msg}"
    elif any(w in last_user_msg for w in ["score", "note", "qualité", "evaluation"]):
        reply = "D'après l'analyse de votre rapport, voici vos scores :\n" + (context_summary or "Scores non disponibles. L'analyse n'est peut-être pas encore terminée.")
    elif any(w in last_user_msg for w in ["manqu", "section", "chapitre"]):
        reply = "Les sections à améliorer dans votre rapport sont identifiées dans la section 'Analyse'. Je vous recommande de vous concentrer sur les sections manquantes et de les développer avec des exemples concrets et des références bibliographiques."
    elif any(w in last_user_msg for w in ["conseil", "améliorer", "amélioration", "recomm"]):
        reply = "Voici mes recommandations pour améliorer votre rapport :\n\n1. **Introduction** : Commencez par une problématique claire\n2. **État de l'art** : Citez des travaux récents (2022-2026)\n3. **Méthodologie** : Détaillez votre architecture avec des schémas\n4. **Résultats** : Utilisez des tableaux et des graphiques comparatifs\n5. **Conclusion** : Ouvrez sur les perspectives futures"
    elif any(w in last_user_msg for w in ["bibliograph", "référence", "citation"]):
        reply = "Pour la bibliographie, utilisez le format IEEE ou APA. Exemple IEEE :\n\n[1] A. Auteur, \"Titre de l'article,\" *Nom du journal*, vol. X, no. Y, pp. Z-W, Année.\n\nCitez des articles des 5 dernières années et veillez à la cohérence du format dans tout le document."
    elif any(w in last_user_msg for w in ["bonjour", "salut", "hello", "salam"]):
        reply = f"Bonjour {current_user.first_name} ! Je suis votre assistant Encadrini IA. Je suis là pour vous aider à améliorer votre rapport de PFE. Que souhaitez-vous savoir ?"
    else:
        reply = f"Je comprends votre question concernant \"{request.messages[-1].content if request.messages else ''}\". En tant qu'assistant académique, je vous conseille de consulter les retours détaillés dans la section Analyse de votre rapport, puis de revenir vers moi avec des questions spécifiques sur vos chapitres ou votre méthodologie."

    return ChatResponse(reply=reply)


@router.post("/check-ai", response_model=CheckAIResponse)
async def check_ai_content(
    request: CheckAIRequest,
    current_user: User = Depends(get_current_user)
):
    """Estimate AI-generated content percentage and optionally rewrite if > 30%."""
    import requests as req
    import re
    from app.core.config import settings

    text = request.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Le texte ne peut pas être vide.")

    api_key = settings.OPENAI_API_KEY or ""

    # Try LLM for AI detection + rewriting
    if api_key and api_key not in ["", "sk-fake-key-for-dev"]:
        try:
            detection_prompt = f"""Analyze the following academic text and estimate the percentage of content that appears to be AI-generated (vs. human-written).
Consider indicators like: uniformly formal tone, lack of personal voice, no errors, perfect transitions, generic phrasing.

Text:
\"\"\"{text[:3000]}\"\"\"

Respond ONLY with a valid JSON object like:
{{"ai_percentage": 42.5, "reasoning": "short reason in French"}}"""

            if api_key.startswith("xai-"):
                url, model = "https://api.x.ai/v1/chat/completions", "grok-3-mini"
            else:
                url, model = "https://api.openai.com/v1/chat/completions", "gpt-4o-mini"

            resp = req.post(
                url,
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                json={"model": model, "messages": [{"role": "user", "content": detection_prompt}], "temperature": 0.1},
                timeout=30,
            )
            if resp.status_code == 200:
                content = resp.json()["choices"][0]["message"]["content"].strip()
                content = re.sub(r"```[a-z]*", "", content).strip("` \n")
                result = __import__("json").loads(content)
                ai_pct = float(result.get("ai_percentage", 50.0))
                rewritten = None

                if ai_pct > 30:
                    rewrite_prompt = f"""Rewrite the following academic text to make it sound more natural and human-written.
Keep the same meaning but vary sentence structures, add some imperfections, use a more personal academic voice.
Keep it in the same language as the original (French if French, English if English).

Original text:
\"\"\"{text[:3000]}\"\"\"

Return ONLY the rewritten text, nothing else."""
                    resp2 = req.post(
                        url,
                        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                        json={"model": model, "messages": [{"role": "user", "content": rewrite_prompt}], "temperature": 0.85},
                        timeout=30,
                    )
                    if resp2.status_code == 200:
                        rewritten = resp2.json()["choices"][0]["message"]["content"].strip()

                label = "Faible" if ai_pct <= 30 else ("Modéré" if ai_pct <= 60 else "Élevé")
                return CheckAIResponse(ai_score=round(ai_pct, 1), label=label, rewritten=rewritten)
        except Exception as e:
            print(f"[check-ai] LLM error: {e}", flush=True)

    # Heuristic fallback AI detection
    words = text.split()
    word_count = len(words)
    sentences = [s.strip() for s in re.split(r'[.!?]', text) if len(s.strip()) > 10]
    avg_sentence_length = sum(len(s.split()) for s in sentences) / max(len(sentences), 1)

    ai_indicators = 0
    ai_markers = ["en conclusion", "il convient de", "dans ce contexte", "par conséquent",
                  "il est important de", "en outre", "de plus", "ainsi", "donc", "néanmoins",
                  "cependant", "en effet", "il s'agit", "dans le cadre", "cette approche"]
    text_lower = text.lower()
    for marker in ai_markers:
        if marker in text_lower:
            ai_indicators += 1

    pct = min(95.0, max(5.0, (ai_indicators / max(len(ai_markers), 1)) * 100 * 1.5 + (5 if avg_sentence_length > 20 else 0)))
    label = "Faible" if pct <= 30 else ("Modéré" if pct <= 60 else "Élevé")

    rewritten = None
    if pct > 30:
        # Simple humanization: vary some phrases
        humanized = text
        replacements = {
            "Il convient de noter que": "Je dois souligner que",
            "En conclusion,": "Pour conclure,",
            "Il est important de": "Il faut",
            "Dans ce contexte,": "Ici,",
            "Par conséquent,": "Donc,",
        }
        for old, new in replacements.items():
            humanized = humanized.replace(old, new)
        rewritten = humanized

    return CheckAIResponse(ai_score=round(pct, 1), label=label, rewritten=rewritten)
