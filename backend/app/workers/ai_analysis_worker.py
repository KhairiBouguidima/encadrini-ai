import asyncio
import io
from typing import Any, Dict, List, Tuple
from beanie import init_beanie
from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import settings
from app.models.report import Report, AIAnalysisStatus
from app.models.ai_analysis import (
    AIAnalysis,
    AnalysisScores,
    CorrectionIssue,
    DimensionScores,
    GeneratedContent,
    RoadmapItem,
)
from app.storage.storage_service import get_storage_service
from app.ai.ai_provider import get_ai_provider, _generate_dynamic_analysis
from app.models.notification import Notification, NotificationType
from app.models.project import Project
from app.services.notification_service import notify


async def _ensure_beanie_initialized():
    """Only initialize Beanie if running outside FastAPI lifespan (e.g., standalone test/script)."""
    try:
        Report.get_settings()
    except Exception:
        client = AsyncIOMotorClient(settings.MONGODB_URL, serverSelectionTimeoutMS=10_000)
        await init_beanie(
            database=client[settings.MONGODB_DB_NAME],
            document_models=[Report, AIAnalysis, Notification, Project],
        )


async def run_ai_analysis(report_id: str, version_number: int):
    """
    Background task: extracts text & layout metrics from the stored report file,
    sends it through the AI provider, persists results, and updates version status.
    """
    await _ensure_beanie_initialized()

    report = await Report.get(report_id)
    if not report:
        return

    version = next((v for v in report.versions if v.version_number == version_number), None)
    if not version:
        return

    # Mark PROCESSING
    version.ai_analysis_status = AIAnalysisStatus.PROCESSING
    await report.save()

    try:
        # 1. Extract raw text & layout metrics without blocking the event loop
        storage = get_storage_service()
        file_bytes = await storage.get_file_bytes(version.raw_file_key)
        text_content, layout_metrics = await asyncio.to_thread(
            _extract_text_and_layout, file_bytes, version.original_mime_type
        )

        # 2. Call AI provider
        provider = get_ai_provider()
        raw_result = await provider.analyze_report(text_content, layout_metrics=layout_metrics)

        # Fallback/enrichment to guarantee all score, mise en page & language fields exist
        fallback_result = _generate_dynamic_analysis(text_content, layout_metrics=layout_metrics)

        raw_scores = raw_result.get("scores") or {}
        fb_scores = fallback_result.get("scores", {})
        dim_data = raw_scores.get("dimension_scores") or fb_scores.get("dimension_scores")
        dim_scores = DimensionScores(**dim_data) if dim_data else None

        linguistic = float(raw_scores.get("linguistic", fb_scores.get("linguistic", 80.0)))
        structural = float(raw_scores.get("structural", fb_scores.get("structural", 75.0)))
        coherence = float(raw_scores.get("coherence", fb_scores.get("coherence", 75.0)))
        overall_quality = float(
            raw_scores.get("overall_quality")
            or _compute_score(linguistic, structural, coherence)
        )

        readiness_score = raw_scores.get("readiness_score")
        if readiness_score is None and dim_scores is not None:
            readiness_score = round(
                (dim_scores.structure * 0.25)
                + (dim_scores.methodology * 0.25)
                + (dim_scores.language * 0.20)
                + (dim_scores.formatting * 0.15)
                + (dim_scores.citations * 0.15),
                1,
            )
        elif readiness_score is None:
            readiness_score = overall_quality

        readiness_level = raw_scores.get("readiness_level") or _compute_readiness_level(float(readiness_score))

        scores = AnalysisScores(
            linguistic=linguistic,
            structural=structural,
            coherence=coherence,
            overall_quality=overall_quality,
            readiness_score=float(readiness_score),
            readiness_level=readiness_level,
            dimension_scores=dim_scores,
        )

        raw_corrections = raw_result.get("corrections") or fallback_result.get("corrections", [])
        corrections = [CorrectionIssue(**c) for c in raw_corrections]

        gen = raw_result.get("generated_content") or {}
        fb_gen = fallback_result.get("generated_content", {})
        formatting_issues = (
            gen.get("formatting_issues")
            or raw_result.get("formatting_issues")
            or fb_gen.get("formatting_issues", [])
        )
        generated_content = GeneratedContent(
            summary=gen.get("summary") or fb_gen.get("summary", ""),
            abstract=gen.get("abstract") or fb_gen.get("abstract", ""),
            keywords=gen.get("keywords") or fb_gen.get("keywords", []),
            jury_questions=gen.get("jury_questions") or fb_gen.get("jury_questions", []),
            formatting_issues=formatting_issues,
        )

        raw_roadmap = raw_result.get("roadmap") or fallback_result.get("roadmap", [])
        roadmap_items = [RoadmapItem(**r) for r in raw_roadmap]

        missing_sections = raw_result.get("missing_sections")
        if missing_sections is None:
            missing_sections = fallback_result.get("missing_sections", [])

        # Replace any stale analysis for this (report_id, version_number)
        await AIAnalysis.find(
            AIAnalysis.report_id == report.id,
            AIAnalysis.version_number == version_number,
        ).delete()

        analysis = AIAnalysis(
            report_id=report.id,
            version_number=version_number,
            scores=scores,
            missing_sections=missing_sections,
            corrections=corrections,
            generated_content=generated_content,
            roadmap=roadmap_items,
            formatting_issues=formatting_issues,
        )
        await analysis.insert()

        # 4. Mark COMPLETED
        version.ai_analysis_status = AIAnalysisStatus.COMPLETED
        await report.save()

        # Notify project stakeholders
        project = await Project.get(report.project_id)
        if project:
            recipients = set()
            if project.student_id:
                recipients.add(project.student_id)
            if project.encadrer_id:
                recipients.add(project.encadrer_id)
            for eid in getattr(project, "encadrer_ids", []) or []:
                recipients.add(eid)

            for uid in recipients:
                await notify(
                    user_id=uid,
                    notification_type=NotificationType.AI_ANALYSIS_COMPLETED,
                    title="Analyse IA terminée",
                    message=f"L'analyse IA de la version {version_number} de votre rapport est prête. Qualité globale : {scores.overall_quality}/100",
                    link=f"/reports/{report_id}/v{version_number}/analysis",
                )

    except Exception as e:
        print(f"AI analysis failed for report {report_id} v{version_number}: {e}")
        version.ai_analysis_status = AIAnalysisStatus.FAILED
        await report.save()

        # Notify project stakeholders of failure
        project = await Project.get(report.project_id)
        if project:
            recipients = set()
            if project.student_id:
                recipients.add(project.student_id)
            if project.encadrer_id:
                recipients.add(project.encadrer_id)
            for eid in getattr(project, "encadrer_ids", []) or []:
                recipients.add(eid)

            for uid in recipients:
                await notify(
                    user_id=uid,
                    notification_type=NotificationType.AI_ANALYSIS_FAILED,
                    title="Échec de l'analyse IA",
                    message=f"L'analyse IA de la version {version_number} a rencontré une erreur. Veuillez réessayer.",
                    link=f"/reports/{report_id}/v{version_number}",
                )


def _extract_docx(file_bytes: bytes) -> Tuple[str, Dict[str, Any]]:
    import docx

    doc = docx.Document(io.BytesIO(file_bytes))
    paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
    fonts = set()
    sizes = set()
    for p in doc.paragraphs:
        for run in p.runs:
            if run.font.name:
                fonts.add(run.font.name)
            if run.font.size:
                sizes.add(round(run.font.size.pt, 1))
    for table in doc.tables:
        for row in table.rows:
            paragraphs.extend([cell.text.strip() for cell in row.cells if cell.text.strip()])

    metrics: Dict[str, Any] = {
        "file_type": "docx",
        "paragraph_count": len(doc.paragraphs),
        "table_count": len(doc.tables),
        "fonts": sorted(fonts)[:10],
        "font_sizes_pt": sorted(sizes)[:10],
    }
    return ("\n\n".join(paragraphs), metrics)


def _extract_pdf(file_bytes: bytes) -> Tuple[str, Dict[str, Any]]:
    import pdfplumber

    with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
        total_pages = len(pdf.pages)
        # Cap extraction at 80 pages for speed ("ykammel fisse")
        max_pages = min(total_pages, 80)
        text_pages: List[str] = []
        empty_pages: List[int] = []
        for idx in range(max_pages):
            txt = pdf.pages[idx].extract_text() or ""
            if not txt.strip():
                empty_pages.append(idx + 1)
            text_pages.append(txt)

        pages_payload = [
            f"[[PAGE_{i + 1}]]\n{t}" for i, t in enumerate(text_pages) if t.strip()
        ]
        metrics: Dict[str, Any] = {
            "file_type": "pdf",
            "page_count": total_pages,
            "empty_pages": empty_pages[:10],
            "pages_text": text_pages,
        }
        return ("\n\n".join(pages_payload), metrics)


def _extract_text_and_layout(file_bytes: bytes, mime_type: str) -> Tuple[str, Dict[str, Any]]:
    """Fast, MIME-aware text and layout extraction from PDF or DOCX binary bytes."""
    mime = (mime_type or "").lower()
    is_pdf = "pdf" in mime or file_bytes[:4] == b"%PDF"
    is_docx = "word" in mime or "officedocument" in mime or file_bytes[:2] == b"PK"

    if is_pdf:
        try:
            text, metrics = _extract_pdf(file_bytes)
            if text.strip():
                return text, metrics
        except Exception:
            pass
    elif is_docx:
        try:
            text, metrics = _extract_docx(file_bytes)
            if text.strip():
                return text, metrics
        except Exception:
            pass

    # Fallback cross-try if mime was unknown
    for extractor in (_extract_pdf, _extract_docx):
        try:
            text, metrics = extractor(file_bytes)
            if text.strip():
                return text, metrics
        except Exception:
            continue

    # 3. Fallback to utf-8 decode with cleanup
    try:
        decoded = file_bytes.decode("utf-8", errors="ignore")
        cleaned = "".join(c for c in decoded if c.isprintable() or c in "\n\r\t ")
        return (cleaned or "Rapport de Projet de Fin d'Études", {"file_type": "text"})
    except Exception:
        return ("Rapport de Projet de Fin d'Études", {"file_type": "unknown"})


def _extract_text(file_bytes: bytes, mime_type: str) -> str:
    """Robust text extraction from PDF or DOCX binary bytes."""
    text, _ = _extract_text_and_layout(file_bytes, mime_type)
    return text


def _compute_score(linguistic: float, structural: float, coherence: float) -> float:
    """Deterministic weighted quality score — configurable defaults."""
    w_ling = 0.30
    w_struct = 0.35
    w_coher = 0.35
    return round(w_ling * linguistic + w_struct * structural + w_coher * coherence, 2)


def _compute_readiness_level(readiness_score: float) -> str:
    if readiness_score >= 90.0:
        return "Prêt pour la soutenance"
    if readiness_score >= 75.0:
        return "Bon"
    if readiness_score >= 60.0:
        return "Satisfaisant"
    if readiness_score >= 40.0:
        return "En progrès"
    return "Insuffisant"
