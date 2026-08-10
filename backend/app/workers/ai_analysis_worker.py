import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie
from app.core.config import settings
from app.models.report import Report, AIAnalysisStatus
from app.models.ai_analysis import AIAnalysis, AnalysisScores, CorrectionIssue, GeneratedContent
from app.storage.storage_service import get_storage_service
from app.ai.ai_provider import get_ai_provider


async def run_ai_analysis(report_id: str, version_number: int):
    """
    Background task: extracts text from the stored report PDF,
    sends it through the AI provider, persists results, and
    updates the version status.
    """
    client = AsyncIOMotorClient(settings.MONGODB_URL)
    await init_beanie(
        database=client[settings.MONGODB_DB_NAME],
        document_models=[Report, AIAnalysis]
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

    except Exception as e:
        print(f"AI analysis failed for report {report_id} v{version_number}: {e}")
        version.ai_analysis_status = AIAnalysisStatus.FAILED
        await report.save()


def _extract_text(file_bytes: bytes, mime_type: str) -> str:
    """Simple text extraction — PDF via raw decode, DOCX via python-docx."""
    if "pdf" in mime_type:
        # Try pdfplumber if available, else fallback to raw decode
        try:
            import pdfplumber
            import io
            with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
                return "\n\n".join(
                    page.extract_text() or "" for page in pdf.pages
                )
        except ImportError:
            return file_bytes.decode("utf-8", errors="ignore")
    elif "word" in mime_type or "docx" in mime_type:
        try:
            import docx
            import io
            doc = docx.Document(io.BytesIO(file_bytes))
            return "\n".join(p.text for p in doc.paragraphs if p.text.strip())
        except ImportError:
            return file_bytes.decode("utf-8", errors="ignore")
    else:
        return file_bytes.decode("utf-8", errors="ignore")


def _compute_score(linguistic: float, structural: float, coherence: float) -> float:
    """Deterministic weighted quality score — configurable defaults."""
    w_ling = 0.30
    w_struct = 0.35
    w_coher = 0.35
    return round(w_ling * linguistic + w_struct * structural + w_coher * coherence, 2)
