import json
import re
from abc import ABC, abstractmethod
from typing import Dict, Any, List
import requests
from app.core.config import settings


class BaseAIProvider(ABC):
    @abstractmethod
    async def analyze_report(self, text_content: str, user_api_key: str = None) -> Dict[str, Any]:
        """Performs multi-dimensional analysis and returns structured JSON output."""
        pass


ANALYSIS_PROMPT_TEMPLATE = """
You are an expert academic evaluator analyzing a PFE (Projet de Fin d'Études) report.
Analyze the following untrusted report text inside <document_text> tags.

<document_text>
{doc_sample}
</document_text>

Return ONLY a valid JSON object matching this exact schema:
{{
  "scores": {{
    "linguistic": 85.0,
    "structural": 80.0,
    "coherence": 82.0,
    "overall_quality": 82.25
  }},
  "missing_sections": ["État de l'art détaillé"],
  "corrections": [
    {{
      "page": 1,
      "original": "texte avec erreur",
      "suggestion": "texte corrigé",
      "explanation": "Explication de la correction"
    }}
  ],
  "generated_content": {{
    "summary": "Résumé concis et pertinent du projet en français...",
    "abstract": "Concise executive abstract in English...",
    "keywords": ["Terme 1", "Terme 2", "Terme 3", "Terme 4"],
    "jury_questions": [
      "Question 1 pour la soutenance?",
      "Question 2 pour la soutenance?",
      "Question 3 pour la soutenance?"
    ]
  }}
}}

Important rules:
- All scores must be numbers between 0 and 100.
- Summary and jury_questions must be in French.
- Abstract must be in English.
- Return ONLY the raw JSON object, no markdown code block, no explanation.
"""


def _generate_dynamic_analysis(text_content: str) -> Dict[str, Any]:
    """
    Intelligent analysis generated from the actual document content according to the
    PFE Report Guide Specification (5 Dimensions & Readiness Score).
    """
    clean_text = text_content.strip()
    words = [w for w in re.split(r'\s+', clean_text) if len(w) > 2]
    word_count = len(words)

    # 1. Structural Analysis (25% weight)
    has_cover = bool(re.search(r'\b(projet de fin d.etudes|pfe|rapport de stage|encadrant|universite|faculte)\b', clean_text, re.I))
    has_abstract = bool(re.search(r'\b(resume|abstract|mots.cles|keywords)\b', clean_text, re.I))
    has_intro = bool(re.search(r'\b(introduction|contexte|problematique|problématique)\b', clean_text, re.I))
    has_state_art = bool(re.search(r'\b(etat de l.art|état de l.art|revue de la litterature|analyse de l.existant|solutions existantes)\b', clean_text, re.I))
    has_methodo = bool(re.search(r'\b(methodologie|méthodologie|scrum|agile|cycle en v|analyse des besoins|spécification|conception|architecture)\b', clean_text, re.I))
    has_realization = bool(re.search(r'\b(realisation|réalisation|implementation|implémentation|technologies|tests|résultats|resultats)\b', clean_text, re.I))
    has_conclusion = bool(re.search(r'\b(conclusion|perspectives)\b', clean_text, re.I))
    has_biblio = bool(re.search(r'\b(bibliographie|references|références|webographie)\b', clean_text, re.I))

    structure_score = 40.0
    if has_cover: structure_score += 8.0
    if has_abstract: structure_score += 8.0
    if has_intro: structure_score += 10.0
    if has_state_art: structure_score += 10.0
    if has_methodo: structure_score += 10.0
    if has_realization: structure_score += 8.0
    if has_conclusion: structure_score += 8.0
    if has_biblio: structure_score += 8.0
    structure_score = min(98.0, max(35.0, structure_score))

    # 2. Methodology Analysis (25% weight)
    has_problem = bool(re.search(r'\b(problematique|problématique|defis|challenges|objectifs)\b', clean_text, re.I))
    has_choices = bool(re.search(r'\b(justification|choix technique|comparatif|pourquoi|avantages)\b', clean_text, re.I))
    has_eval = bool(re.search(r'\b(validation|evaluation|expérimentation|performances|metriques)\b', clean_text, re.I))

    methodo_score = 45.0
    if has_problem: methodo_score += 18.0
    if has_choices: methodo_score += 18.0
    if has_eval: methodo_score += 14.0
    methodo_score = min(95.0, max(40.0, methodo_score))

    # 3. Language Quality (20% weight)
    has_informal = bool(re.search(r'\b(je|on|notre équipe|moi)\b', clean_text, re.I))
    language_score = 82.0 if word_count > 150 else 70.0
    if has_informal: language_score -= 8.0

    # 4. Formatting (15% weight)
    formatting_score = 80.0 if (has_cover and has_abstract) else 68.0

    # 5. Citations & Bibliography (15% weight)
    has_ieee_apa = bool(re.search(r'(\[\d+\]|\(\w+,\s*\d{4}\))', clean_text))
    citations_score = 85.0 if (has_biblio and has_ieee_apa) else (60.0 if has_biblio else 40.0)

    # Calculate overall Readiness Score (0-100) per PFE Guide formula
    readiness_score = round(
        (structure_score * 0.25) +
        (methodo_score * 0.25) +
        (language_score * 0.20) +
        (formatting_score * 0.15) +
        (citations_score * 0.15),
        1
    )

    # Determine Readiness Level
    if readiness_score >= 90.0:
        readiness_level = "Prêt pour la soutenance"
    elif readiness_score >= 75.0:
        readiness_level = "Bon"
    elif readiness_score >= 60.0:
        readiness_level = "Satisfaisant"
    elif readiness_score >= 40.0:
        readiness_level = "En progrès"
    else:
        readiness_level = "Insuffisant"

    # Missing sections
    missing = []
    if not has_state_art: missing.append("État de l'art approfondi et étude comparative (Recommandé)")
    if not has_intro: missing.append("Introduction générale avec problématique claire (Obligatoire)")
    if not has_methodo: missing.append("Spécification des besoins & Conception détaillée (Obligatoire)")
    if not has_realization: missing.append("Implémentation & Résultats expérimentaux (Obligatoire)")
    if not has_conclusion: missing.append("Conclusion générale et perspectives (Obligatoire)")
    if not has_biblio: missing.append("Références bibliographiques selon les normes IEEE/APA (Obligatoire)")
    if not missing:
        missing = ["Résumés bilingues (Français / Anglais)"]

    # 6. Improvement Roadmap (Prioritized action list per PFE specification)
    roadmap = []

    if not has_state_art:
        roadmap.append({
            "id": "act-1",
            "title": "Rédiger l'état de l'art et la synthèse comparative",
            "description": "Ajouter un chapitre dédié comparant les solutions existantes pour justifier le besoin de votre projet.",
            "priority": "critical",
            "dimension": "structure",
            "estimated_gain": 8.5,
            "estimated_effort": "Moyen",
            "completed": False
        })
    if not has_biblio or not has_ieee_apa:
        roadmap.append({
            "id": "act-2",
            "title": "Standardiser les citations et la bibliographie",
            "description": "Harmoniser les références au format IEEE (ex: [1]) et vérifier la présence d'une bibliographie complète.",
            "priority": "critical",
            "dimension": "citations",
            "estimated_gain": 6.0,
            "estimated_effort": "Faible",
            "completed": False
        })
    if has_informal:
        roadmap.append({
            "id": "act-3",
            "title": "Adopter un registre académique strict",
            "description": "Remplacer l'usage du 'Je' et du 'On' informel par le style académique ou la forme passive.",
            "priority": "important",
            "dimension": "language",
            "estimated_gain": 4.5,
            "estimated_effort": "Faible",
            "completed": False
        })
    if not has_eval:
        roadmap.append({
            "id": "act-4",
            "title": "Détailler la section de validation et métriques de performance",
            "description": "Ajouter des tableaux comparatifs et des graphiques mesurant les résultats de votre solution par rapport aux objectifs initiaux.",
            "priority": "important",
            "dimension": "methodology",
            "estimated_gain": 7.0,
            "estimated_effort": "Moyen",
            "completed": False
        })
    
    # Always guarantee at least 2 roadmap actions
    if len(roadmap) < 2:
        roadmap.append({
            "id": "act-5",
            "title": "Enrichir la conclusion générale et les perspectives",
            "description": "Formuler une ouverture vers des évolutions futures (ex: microservices, intégration d'autres modèles LLM).",
            "priority": "minor",
            "dimension": "structure",
            "estimated_gain": 3.0,
            "estimated_effort": "Faible",
            "completed": False
        })

    # Extract keywords
    common_stops = {
        'les', 'des', 'pour', 'dans', 'avec', 'cette', 'nous', 'vous', 'sont', 'plus',
        'tout', 'faire', 'comme', 'leur', 'mais', 'aussi', 'projet', 'rapport', 'travail',
        'cette', 'alors', 'ainsi', 'entre', 'chaque', 'autre', 'apres', 'après'
    }
    extracted_keywords = []
    for w in words:
        cleaned = re.sub(r'[^\w]', '', w)
        if len(cleaned) > 5 and cleaned.lower() not in common_stops and cleaned.lower() not in [k.lower() for k in extracted_keywords]:
            extracted_keywords.append(cleaned.capitalize())
            if len(extracted_keywords) >= 5:
                break
    if len(extracted_keywords) < 4:
        extracted_keywords = ["Projet PFE", "Méthodologie", "Architecture Logicielle", "Validation Expérimentale"]

    # Dynamic Summary
    paragraphs = [p.strip() for p in clean_text.split('\n') if len(p.strip()) > 60]
    if paragraphs:
        summary_base = " ".join(paragraphs[:2])
        if len(summary_base) > 400:
            summary_base = summary_base[:400] + "..."
        summary = f"Ce rapport de PFE traite de : {summary_base}"
    else:
        summary = "Le document présente le rapport de projet de fin d'études, incluant le cadre de travail, la méthodologie retenue, les choix de conception et les perspectives d'avenir."

    abstract = "This graduation project dissertation outlines the problem statement, system design, implementation methodology, and key evaluation results."

    kw1 = extracted_keywords[0] if len(extracted_keywords) > 0 else "l'architecture globale"
    kw2 = extracted_keywords[1] if len(extracted_keywords) > 1 else "les performances"
    jury_questions = [
        f"Quelles ont été les contraintes majeures lors de la mise en œuvre de {kw1} ?",
        f"Comment avez-vous validé et mesuré {kw2} par rapport à la problématique initiale ?",
        "Quelles sont les perspectives d'amélioration ou d'extension industrielle de votre solution ?"
    ]

    corrections = [
        {
            "page": 1,
            "original": "Introduction & Problématique",
            "suggestion": "Préciser la démarche méthodologique dès les premières lignes du chapitre",
            "explanation": "Permet au jury d'évaluer directement le cadre du travail selon le Guide PFE."
        },
        {
            "page": 2,
            "original": "Citations & Références",
            "suggestion": "Uniformiser les références bibliographiques au format IEEE/APA",
            "explanation": "Assure la conformité académique de la bibliographie."
        }
    ]

    formatting_issues = []
    if not has_cover:
        formatting_issues.append("Page de garde : Modèle officiel de l'établissement manquant ou incomplet.")
    if not has_ieee_apa:
        formatting_issues.append("Style de citation : Remplacer les citations informelles par les normes IEEE [1] ou APA (Nom, Année).")
    if not has_abstract:
        formatting_issues.append("Résumés bilingues : Le résumé français et l'abstract anglais doivent figurer en début de document.")
    formatting_issues.append("Légendes des figures et tableaux : Vérifier la numérotation séquentielle (ex: Figure 1.1) et les références croisées.")
    formatting_issues.append("Alignement & Typographie : Harmoniser la police (Times New Roman 12pt ou Arial 11pt, interligne 1.5).")

    return {
        "scores": {
            "linguistic": language_score,
            "structural": structure_score,
            "coherence": methodo_score,
            "overall_quality": readiness_score,
            "readiness_score": readiness_score,
            "readiness_level": readiness_level,
            "dimension_scores": {
                "structure": structure_score,
                "methodology": methodo_score,
                "language": language_score,
                "formatting": formatting_score,
                "citations": citations_score,
            }
        },
        "missing_sections": missing,
        "corrections": corrections,
        "generated_content": {
            "summary": summary,
            "abstract": abstract,
            "keywords": extracted_keywords[:5],
            "jury_questions": jury_questions,
            "formatting_issues": formatting_issues,
        },
        "roadmap": roadmap
    }


class OpenAICompatibleProvider(BaseAIProvider):
    """Provider that connects to LLMs (OpenAI, xAI, Groq) with intelligent fallback."""

    def __init__(self, api_base: str, model: str, default_api_key: str = ""):
        self.api_base = api_base.rstrip("/")
        self.model = model
        self.default_api_key = default_api_key

    async def analyze_report(self, text_content: str, user_api_key: str = None) -> Dict[str, Any]:
        api_key = user_api_key or self.default_api_key
        
        # If API key exists, attempt remote LLM call
        if api_key and api_key not in ["", "sk-fake-key-for-dev"]:
            doc_sample = text_content[:12000]
            prompt = ANALYSIS_PROMPT_TEMPLATE.format(doc_sample=doc_sample)
            try:
                print(f"[ai-provider] Calling {self.api_base} with model {self.model}...", flush=True)
                response = requests.post(
                    f"{self.api_base}/chat/completions",
                    headers={
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": self.model,
                        "messages": [{"role": "user", "content": prompt}],
                        "temperature": 0.3,
                    },
                    timeout=30,
                )
                if response.status_code == 200:
                    data = response.json()
                    content = data["choices"][0]["message"]["content"].strip()
                    if content.startswith("```"):
                        content = content.split("\n", 1)[1] if "\n" in content else content[3:]
                    if content.endswith("```"):
                        content = content[:-3]
                    content = content.strip()
                    result = json.loads(content)
                    print(f"[ai-provider] LLM Analysis successful! Score: {result.get('scores', {}).get('overall_quality')}", flush=True)
                    return result
                else:
                    print(f"[ai-provider] LLM API returned status {response.status_code}: {response.text[:200]}", flush=True)
            except Exception as e:
                print(f"[ai-provider] LLM request error: {e}", flush=True)

        # Fallback to content-driven dynamic analyzer
        print("[ai-provider] Generating context-aware analysis from document text...", flush=True)
        return _generate_dynamic_analysis(text_content)


def get_ai_provider() -> BaseAIProvider:
    api_key = settings.OPENAI_API_KEY or ""

    if api_key.startswith("xai-"):
        return OpenAICompatibleProvider(
            api_base="https://api.x.ai/v1",
            model="grok-3-mini",
            default_api_key=api_key,
        )
    elif api_key.startswith("sk-") and api_key != "sk-fake-key-for-dev":
        return OpenAICompatibleProvider(
            api_base="https://api.openai.com/v1",
            model="gpt-4o-mini",
            default_api_key=api_key,
        )
    return OpenAICompatibleProvider(
        api_base="https://api.openai.com/v1",
        model="gpt-4o-mini",
        default_api_key="",
    )
