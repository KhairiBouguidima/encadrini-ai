import json
import re
from abc import ABC, abstractmethod
from typing import Dict, Any, List

from app.core.config import settings
from app.core.http_client import get_http_client
import httpx


class BaseAIProvider(ABC):
    @abstractmethod
    async def analyze_report(
        self,
        text_content: str,
        user_api_key: str = None,
        layout_metrics: Dict[str, Any] = None,
    ) -> Dict[str, Any]:
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
    "overall_quality": 82.25,
    "readiness_score": 78.5,
    "readiness_level": "Bon",
    "dimension_scores": {{
      "structure": 80.0,
      "methodology": 75.0,
      "language": 85.0,
      "formatting": 70.0,
      "citations": 72.0
    }}
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
    ],
    "formatting_issues": [
      "Remarque sur la mise en forme 1",
      "Remarque sur la mise en forme 2"
    ]
  }},
  "roadmap": [
    {{
      "id": "act-1",
      "title": "Action prioritaire en français",
      "description": "Description détaillée de l'action à entreprendre.",
      "priority": "critical",
      "dimension": "structure",
      "estimated_gain": 8.0,
      "estimated_effort": "Moyen",
      "completed": false
    }}
  ]
}}

Important rules:
- All scores must be numbers between 0 and 100.
- readiness_score is the weighted aggregate: structure*0.25 + methodology*0.25 + language*0.20 + formatting*0.15 + citations*0.15.
- readiness_level must be one of: "Prêt pour la soutenance" (>=90), "Bon" (>=75), "Satisfaisant" (>=60), "En progrès" (>=40), "Insuffisant" (<40).
- Summary, corrections, jury_questions, roadmap, and formatting_issues must all be in French.
- Abstract must be in English.
- roadmap priority must be one of: "critical", "important", "minor".
- roadmap dimension must be one of: "structure", "methodology", "language", "formatting", "citations".
- roadmap estimated_effort must be one of: "Faible", "Moyen", "Élevé".
- formatting_issues should list mise en page and typographic defects found in the document.
- Return ONLY the raw JSON object, no markdown code block, no explanation.
"""


def _detect_language_issues(
    clean_text: str, pages_text: List[str] | None = None
) -> List[Dict[str, Any]]:
    """
    Scan report text (French & English) for real linguistic, grammar,
    typographic, and academic register issues.
    """
    rules = [
        (
            re.compile(r"\b(je|j'ai|j'utilise|mon projet|ma solution|mes résultats)\b", re.I),
            "Style personnel (1re personne)",
            "Utiliser la forme impersonnelle ou le « nous » académique (ex: « Ce travail présente… », « Il convient de… »).",
            "Le style académique d'un rapport PFE proscrit l'usage du « je » au profit d'un ton neutre et objectif.",
        ),
        (
            re.compile(r"\b(on a|on peut|on va|on utilise|on constate)\b", re.I),
            "Pronom familier « on »",
            "Remplacer « on » par une tournure passive ou impersonnelle (ex: « il est possible de… », « l'analyse montre… »).",
            "Le pronom « on » est trop familier pour un mémoire académique.",
        ),
        (
            re.compile(r"\b(malgré que|au jour d'aujourd'hui|comme même|par contre|car en effet)\b", re.I),
            "Expression fautive ou orale",
            "Remplacer par une tournure soutenue (« bien que », « aujourd'hui », « quand même », « en revanche », « en effet »).",
            "Locution déconseillée ou grammaticalement incorrecte en français académique.",
        ),
        (
            re.compile(r"\b(\w+)\s+\1\b", re.I),
            "Répétition de mot",
            "Supprimer le mot en double.",
            "Mot répété consécutivement dans la phrase.",
        ),
        (
            re.compile(r"[a-zàâäéèêëïîôöùûüç][;:?!]", re.I),
            "Espace manquante avant ponctuation double",
            "Ajouter une espace insécable avant « : », « ; », « ? » ou « ! ».",
            "Règle typographique française : les signes doubles prennent une espace avant.",
        ),
        (
            re.compile(r"\b(I have|I am|we didn't|don't|can't|won't|isn't)\b"),
            "Contraction / ton familier en anglais",
            "Écrire la forme complète et adopter un registre académique (« do not », « cannot », « this study… »).",
            "Les contractions et la 1re personne du singulier sont à éviter dans les sections en anglais.",
        ),
    ]

    chunks = (
        [(idx + 1, p) for idx, p in enumerate(pages_text) if p and p.strip()]
        if pages_text
        else [(1, clean_text)]
    )

    issues: List[Dict[str, Any]] = []
    seen_rules = set()

    for page_num, chunk in chunks:
        for pattern, label, suggestion_hint, explanation in rules:
            if (page_num, label) in seen_rules:
                continue
            m = pattern.search(chunk)
            if m:
                start = max(0, m.start() - 35)
                end = min(len(chunk), m.end() + 45)
                snippet = re.sub(r"\s+", " ", chunk[start:end]).strip()
                issues.append(
                    {
                        "page": page_num,
                        "original": f"…{snippet}…" if start > 0 or end < len(chunk) else snippet,
                        "suggestion": suggestion_hint,
                        "explanation": f"{label} — {explanation}",
                    }
                )
                seen_rules.add((page_num, label))
                if len(issues) >= 8:
                    return issues

    return issues


def _generate_dynamic_analysis(
    text_content: str, layout_metrics: Dict[str, Any] = None
) -> Dict[str, Any]:
    """
    Intelligent analysis generated from the actual document content according to the
    PFE Report Guide Specification (5 Dimensions & Readiness Score).
    """
    layout_metrics = layout_metrics or {}
    clean_text = re.sub(r"\[\[PAGE_\d+\]\]\s*", "", text_content).strip()
    words = [w for w in re.split(r'\s+', clean_text) if len(w) > 2]
    word_count = len(words)
    pages_text = layout_metrics.get("pages_text")

    # 1. Structural Analysis (25% weight)
    has_cover = bool(re.search(r'\b(projet de fin d.etudes|pfe|rapport de stage|encadrant|universite|faculte|iset|licence|master|ingenieur|ingénieur|ministère|republique|république)\b', clean_text, re.I))
    has_abstract = bool(re.search(r'\b(resume|résumé|abstract|mots.cles|keywords|sommaire|table des matieres|table des matières|liste des figures|liste des tableaux)\b', clean_text, re.I))
    has_intro = bool(re.search(r'\b(introduction|contexte|problematique|problématique|objectifs)\b', clean_text, re.I))
    has_state_art = bool(re.search(r'\b(etat de l.art|état de l.art|revue de la litterature|revue de la littérature|analyse de l.existant|solutions existantes|etudes? de projet|étude de l.existant)\b', clean_text, re.I))
    has_methodo = bool(re.search(r'\b(methodologie|méthodologie|scrum|agile|cycle en v|analyse des besoins|spécification|conception|architecture|sprint)\b', clean_text, re.I))
    has_realization = bool(re.search(r'\b(realisation|réalisation|implementation|implémentation|technologies|tests|résultats|resultats|outils|environnement)\b', clean_text, re.I))
    has_conclusion = bool(re.search(r'\b(conclusion|perspectives|bilan)\b', clean_text, re.I))
    has_biblio = bool(re.search(r'\b(bibliographie|references|références|webographie|sources|documentation technique)\b', clean_text, re.I))

    structure_score = 45.0
    if has_cover: structure_score += 7.0
    if has_abstract: structure_score += 7.0
    if has_intro: structure_score += 8.0
    if has_state_art: structure_score += 8.0
    if has_methodo: structure_score += 8.0
    if has_realization: structure_score += 8.0
    if has_conclusion: structure_score += 8.0
    if has_biblio: structure_score += 7.0
    if word_count > 3000: structure_score += 4.0
    structure_score = min(99.0, max(40.0, structure_score))

    # 2. Methodology Analysis (25% weight)
    has_problem = bool(re.search(r'\b(problematique|problématique|defis|challenges|objectifs|besoins)\b', clean_text, re.I))
    has_choices = bool(re.search(r'\b(justification|choix technique|comparatif|pourquoi|avantages|cahier des charges|diagramme)\b', clean_text, re.I))
    has_eval = bool(re.search(r'\b(validation|evaluation|évaluation|expérimentation|performances|metriques|métriques|tests|ci/cd|qualité)\b', clean_text, re.I))

    methodo_score = 55.0
    if has_problem: methodo_score += 15.0
    if has_choices: methodo_score += 15.0
    if has_eval: methodo_score += 14.0
    if word_count > 3000: methodo_score += 3.0
    methodo_score = min(99.0, max(45.0, methodo_score))

    # 3. Language Quality (20% weight) — real error scan
    detected_corrections = _detect_language_issues(clean_text, pages_text=pages_text)
    informal_matches = len(re.findall(r'\b(je|j\'ai|moi|on a|on peut|notre équipe)\b', clean_text, re.I))
    has_informal = informal_matches > 3
    language_score = 95.0 if word_count > 2000 else (88.0 if word_count > 300 else 74.0)
    language_score -= min(18.0, len(detected_corrections) * 3.0)
    if has_informal:
        language_score -= 5.0
    language_score = min(98.0, max(45.0, round(language_score, 1)))

    # 4. Formatting / Mise en page (15% weight) — content + real layout metrics
    has_figures_tables = bool(re.search(r'\b(figure|tableau)\b', clean_text, re.I))
    has_toc = bool(re.search(r'\b(sommaire|table des mati[eè]res|liste des figures|liste des tableaux)\b', clean_text, re.I))
    empty_pages = layout_metrics.get("empty_pages") or []
    fonts_used = layout_metrics.get("fonts") or []
    font_sizes_used = layout_metrics.get("font_sizes_pt") or []

    formatting_score = 68.0
    if has_cover: formatting_score += 8.0
    if has_abstract: formatting_score += 7.0
    if has_toc: formatting_score += 6.0
    if has_figures_tables: formatting_score += 7.0
    if len(empty_pages) > 1: formatting_score -= min(10.0, len(empty_pages) * 3.0)
    if len(fonts_used) > 3: formatting_score -= 5.0
    formatting_score = min(98.0, max(45.0, round(formatting_score, 1)))

    # 5. Citations & Bibliography (15% weight)
    has_citation_format = bool(re.search(r'(\[\d+\]|\(\w+,\s*\d{4}\)|https?://|www\.|isbn|doi|vol\.|n°)', clean_text, re.I))
    has_formal_biblio = bool(re.search(r'\b(bibliographie|webographie|références bibliographiques)\b', clean_text, re.I))
    has_ieee_apa = bool(has_formal_biblio and has_citation_format)
    citations_score = 95.0 if has_ieee_apa else (92.0 if has_biblio else 65.0)

    # Calculate overall Readiness Score (0-100) per PFE Guide formula
    readiness_score = round(
        (structure_score * 0.25) +
        (methodo_score * 0.25) +
        (language_score * 0.20) +
        (formatting_score * 0.15) +
        (citations_score * 0.15),
        1
    )

    # Deterministic weighted quality score
    overall_quality = round(0.30 * language_score + 0.35 * structure_score + 0.35 * methodo_score, 2)

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

    corrections = detected_corrections or [
        {
            "page": 1,
            "original": "Structure & Registre académique",
            "suggestion": "Vérifier l'uniformité du registre impersonnel et l'orthographe des titres",
            "explanation": "Aucune faute majeure détectée automatiquement ; vérifiez manuellement la cohérence terminologique."
        }
    ]

    formatting_issues = []
    if not has_cover:
        formatting_issues.append("Page de garde : Modèle officiel de l'établissement manquant ou incomplet.")
    if not has_toc:
        formatting_issues.append("Table des matières / Sommaire : Sommaire, liste des figures ou liste des tableaux non détectés.")
    if not has_abstract:
        formatting_issues.append("Résumés bilingues : Le résumé français et l'abstract anglais doivent figurer en début de document.")
    if not has_figures_tables:
        formatting_issues.append("Figures & Tableaux : Aucune légende « Figure » ou « Tableau » détectée (vérifier la numérotation séquentielle).")
    if not has_ieee_apa:
        formatting_issues.append("Style de citation : Remplacer les citations informelles par les normes IEEE [1] ou APA (Nom, Année).")
    if empty_pages:
        pages_str = ", ".join(str(p) for p in empty_pages[:5])
        formatting_issues.append(f"Pages vides ou purement graphiques détectées (pages {pages_str}) : vérifier les sauts de page superflus.")
    if len(fonts_used) > 3:
        formatting_issues.append(f"Polices multiples détectées ({', '.join(fonts_used[:4])}) : harmoniser vers une seule police (Times New Roman 12pt ou Arial 11pt).")
    if len(font_sizes_used) > 5:
        formatting_issues.append("Tailles de police hétérogènes : uniformiser les niveaux de titres (H1/H2/H3) et le corps de texte.")
    if not formatting_issues:
        formatting_issues.append("Alignement & Typographie : Vérifier l'interligne 1.5, la justification des paragraphes et la numérotation des pages.")

    return {
        "scores": {
            "linguistic": language_score,
            "structural": structure_score,
            "coherence": methodo_score,
            "overall_quality": overall_quality,
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

    async def analyze_report(
        self,
        text_content: str,
        user_api_key: str = None,
        layout_metrics: Dict[str, Any] = None,
    ) -> Dict[str, Any]:
        api_key = user_api_key or self.default_api_key
        
        # If API key exists, attempt remote LLM call with short timeout for fast fallback
        if api_key and api_key not in ["", "sk-fake-key-for-dev"]:
            doc_sample = text_content[:12000]
            prompt = ANALYSIS_PROMPT_TEMPLATE.format(doc_sample=doc_sample)
            print(f"[ai-provider] Calling {self.api_base} with model {self.model}...", flush=True)
            try:
                client = get_http_client()
                response = await client.post(
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
                    timeout=15.0,
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
            except httpx.RequestError as e:
                print(f"[ai-provider] LLM request error: {e}", flush=True)
            except Exception as e:
                print(f"[ai-provider] Unexpected error: {e}", flush=True)

        # Fallback to fast content-driven dynamic analyzer
        print("[ai-provider] Generating context-aware analysis from document text...", flush=True)
        return _generate_dynamic_analysis(text_content, layout_metrics=layout_metrics)


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
