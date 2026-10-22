import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie
from app.core.config import settings
from app.models.report import Report, AIAnalysisStatus
from app.models.ai_analysis import AIAnalysis, AnalysisScores, CorrectionIssue, GeneratedContent
from app.storage.storage_service import get_storage_service
from app.ai.ai_provider import get_ai_provider
from app.models.notification import Notification, NotificationType
from app.models.project import Project
from app.services.notification_service import notify


async def run_ai_analysis(report_id: str, version_number: int):
    """
    Background task: extracts text from the stored report PDF,
    sends it through the AI provider, persists results, and
    updates the version status.
    """
    client = AsyncIOMotorClient(settings.MONGODB_URL)
    await init_beanie(
        database=client[settings.MONGODB_DB_NAME],
        document_models=[Report, AIAnalysis, Notification, Project]
    )

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
        # 1. Extract raw text from stored file
        storage = get_storage_service()
        file_bytes = await storage.get_file_bytes(version.raw_file_key)
        text_content = _extract_text(file_bytes, version.original_mime_type)

        # 2. Call AI provider
        provider = get_ai_provider()
        raw_result = await provider.analyze_report(text_content)

        # 3. Validate & persist structured analysis
        scores = AnalysisScores(
            linguistic=raw_result["scores"]["linguistic"],
            structural=raw_result["scores"]["structural"],
            coherence=raw_result["scores"]["coherence"],
            overall_quality=_compute_score(
                raw_result["scores"]["linguistic"],
                raw_result["scores"]["structural"],
                raw_result["scores"]["coherence"]
            )
        )

        corrections = [
            CorrectionIssue(**c) for c in raw_result.get("corrections", [])
        ]

        gen = raw_result.get("generated_content", {})
        generated_content = GeneratedContent(
            summary=gen.get("summary", ""),
            abstract=gen.get("abstract", ""),
            keywords=gen.get("keywords", []),
            jury_questions=gen.get("jury_questions", [])
        )

        analysis = AIAnalysis(
            report_id=report.id,
            version_number=version_number,
            scores=scores,
            missing_sections=raw_result.get("missing_sections", []),
            corrections=corrections,
            generated_content=generated_content
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
                    title="AI Analysis Complete",
                    message=f"AI analysis for report v{version_number} is ready. Overall quality: {scores.overall_quality}/100",
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
                    title="AI Analysis Failed",
                    message=f"AI analysis for report v{version_number} encountered an error. Please retry.",
                    link=f"/reports/{report_id}/v{version_number}",
                )


def _extract_text(file_bytes: bytes, mime_type: str) -> str:
    """Robust text extraction from PDF or DOCX binary bytes."""
    # 1. Try DOCX (python-docx)
    try:
        import docx
        import io
        doc = docx.Document(io.BytesIO(file_bytes))
        paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
        for table in doc.tables:
            for row in table.rows:
                paragraphs.extend([cell.text.strip() for cell in row.cells if cell.text.strip()])
        if paragraphs:
            return "\n\n".join(paragraphs)
    except Exception:
        pass

    # 2. Try PDF (pdfplumber)
    try:
        import pdfplumber
        import io
        with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
            text_pages = [page.extract_text() or "" for page in pdf.pages]
            full_text = "\n\n".join(t for t in text_pages if t.strip())
            if full_text.strip():
                return full_text
    except Exception:
        pass

    # 3. Fallback to utf-8 decode with cleanup
    try:
        decoded = file_bytes.decode("utf-8", errors="ignore")
        # filter printable characters only
        return "".join(c for c in decoded if c.isprintable() or c in "\n\r\t ")
    except Exception:
        return "Rapport de Projet de Fin d'Études"


def _compute_score(linguistic: float, structural: float, coherence: float) -> float:
    """Deterministic weighted quality score — configurable defaults."""
    w_ling = 0.30
    w_struct = 0.35
    w_coher = 0.35
    return round(w_ling * linguistic + w_struct * structural + w_coher * coherence, 2)
