import io
import json
import uuid
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException, status, Depends, UploadFile, File, Form, Query
from fastapi.responses import Response
from beanie import PydanticObjectId

from app.models.user import User
from app.models.report import Report
from app.models.project import Project
from app.models.compliance import ComplianceReportDocument
from app.schemas.compliance import (
    UniversityProfileSchema, ComplianceCheckResponse, 
    CustomCharterParseResponse, SmartFixResponse
)
from app.api.deps import get_current_user
from app.storage.storage_service import get_storage_service
from app.services.compliance.university_profiles import PROFILES, get_profile
from app.services.compliance.compliance_checker import DocumentComplianceAnalyzer, parse_custom_charter_text_or_pdf
from app.services.compliance.docx_smart_fixer import DocxSmartFixer
from app.workers.ai_analysis_worker import _extract_text

router = APIRouter()


@router.get("/universities", response_model=List[UniversityProfileSchema])
async def list_university_profiles():
    """Returns official pre-configured university guidelines for Tunisian engineering/master PFEs."""
    return list(PROFILES.values())


@router.post("/custom-charter", response_model=CustomCharterParseResponse)
async def parse_custom_charter(
    file: Optional[UploadFile] = File(None),
    guidelines_text: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user)
):
    """
    Parses an uploaded custom university guideline document (PDF, DOCX, or text)
    and uses AI/heuristics to extract exact formatting constraints.
    """
    extracted_text = ""
    if file:
        content_bytes = await file.read()
        extracted_text = _extract_text(content_bytes, file.content_type or "")
    elif guidelines_text:
        extracted_text = guidelines_text.strip()
    else:
        raise HTTPException(status_code=400, detail="Veuillez fournir un fichier ou le texte de la charte.")

    if len(extracted_text) < 20:
        raise HTTPException(status_code=400, detail="Contenu insuffisant pour analyser la charte.")

    parsed_data = await parse_custom_charter_text_or_pdf(extracted_text)
    profile = get_profile("CUSTOM", parsed_data)

    return CustomCharterParseResponse(
        success=True,
        extracted_profile=profile,
        raw_guidelines_summary=parsed_data.get("description", "Charte universitaire personnalisée"),
        detected_rules=parsed_data.get("detected_rules_summary", [
            f"Police requise : {profile.body_font_families[0]} {profile.body_font_size}pt",
            f"Interligne : {profile.line_spacing}",
            f"Marges : 2.5 cm"
        ])
    )


@router.post("/check", response_model=ComplianceCheckResponse)
async def check_compliance(
    file: Optional[UploadFile] = File(None),
    report_id: Optional[str] = Form(None),
    version_number: Optional[int] = Form(None),
    university_id: str = Form("INSAT"),
    custom_rules_json: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user)
):
    """
    Performs full compliance check on a student's PFE report against chosen university guidelines.
    Can be run either against an uploaded PDF file or against an existing project report version.
    """
    custom_rules = None
    if custom_rules_json:
        try:
            custom_rules = json.loads(custom_rules_json)
        except Exception:
            pass

    profile = get_profile(university_id, custom_rules)
    storage = get_storage_service()
    pdf_bytes = b""
    file_name = "rapport.pdf"
    target_report_id = None
    target_version_num = None

    if file:
        file_name = file.filename or "rapport.pdf"
        file_bytes = await file.read()
        # If DOCX uploaded, we convert/read or verify
        if file_name.lower().endswith(".pdf"):
            pdf_bytes = file_bytes
        else:
            # If docx uploaded directly, we can run text analysis or inform user
            # Here we check if pdfplumber can open or if docx, we create PDF or analyze
            try:
                import pdfplumber
                with pdfplumber.open(io.BytesIO(file_bytes)):
                    pdf_bytes = file_bytes
            except Exception:
                raise HTTPException(
                    status_code=400, 
                    detail="Pour la vérification complète de mise en page (marges, typographie exacte), veuillez fournir un fichier PDF."
                )
    elif report_id and version_number:
        rep = await Report.get(PydanticObjectId(report_id))
        if not rep:
            raise HTTPException(status_code=404, detail="Rapport non trouvé.")
        ver = next((v for v in rep.versions if v.version_number == version_number), None)
        if not ver:
            raise HTTPException(status_code=404, detail=f"Version {version_number} non trouvée.")

        target_report_id = rep.id
        target_version_num = ver.version_number
        file_name = ver.original_file_name
        pdf_bytes = await storage.get_file_bytes(ver.pdf_file_key or ver.raw_file_key)
    else:
        raise HTTPException(
            status_code=400, 
            detail="Veuillez téléverser un fichier PDF ou spécifier un rapport existant."
        )

    # Run Analysis
    try:
        analyzer = DocumentComplianceAnalyzer(pdf_bytes, profile, file_name=file_name)
        result = analyzer.analyze()
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Erreur lors de l'analyse du document: {str(e)}")

    # Save to MongoDB
    doc = ComplianceReportDocument(
        report_id=target_report_id,
        version_number=target_version_num,
        user_id=current_user.id,
        file_name=file_name,
        university_id=profile.id,
        university_name=profile.full_name,
        overall_score=result["overall_score"],
        compliance_level=result["compliance_level"],
        summary=result["summary"],
        category_scores=result["category_scores"],
        issues=result["issues"],
        stats=result["stats"],
        custom_rules=custom_rules
    )
    await doc.insert()

    return ComplianceCheckResponse(
        id=str(doc.id),
        report_id=str(target_report_id) if target_report_id else None,
        version_number=target_version_num,
        file_name=file_name,
        university_id=profile.id,
        university_name=profile.full_name,
        overall_score=result["overall_score"],
        compliance_level=result["compliance_level"],
        summary=result["summary"],
        category_scores=result["category_scores"],
        issues=result["issues"],
        stats=result["stats"],
        can_smart_fix_docx=True,
        created_at=doc.created_at.isoformat()
    )


@router.get("/reports/{report_id}/version/{version_number}", response_model=Optional[ComplianceCheckResponse])
async def get_latest_compliance(
    report_id: PydanticObjectId,
    version_number: int,
    current_user: User = Depends(get_current_user)
):
    """Fetches the latest compliance check report for a specific report version."""
    doc = await ComplianceReportDocument.find_one(
        ComplianceReportDocument.report_id == report_id,
        ComplianceReportDocument.version_number == version_number
    ).sort("-created_at")

    if not doc:
        return None

    return ComplianceCheckResponse(
        id=str(doc.id),
        report_id=str(doc.report_id) if doc.report_id else None,
        version_number=doc.version_number,
        file_name=doc.file_name,
        university_id=doc.university_id,
        university_name=doc.university_name,
        overall_score=doc.overall_score,
        compliance_level=doc.compliance_level,
        summary=doc.summary,
        category_scores=doc.category_scores,
        issues=doc.issues,
        stats=doc.stats,
        can_smart_fix_docx=True,
        created_at=doc.created_at.isoformat()
    )


@router.post("/smart-fix", response_model=SmartFixResponse)
async def run_smart_fix(
    file: Optional[UploadFile] = File(None),
    report_id: Optional[str] = Form(None),
    version_number: Optional[int] = Form(None),
    university_id: str = Form("INSAT"),
    custom_rules_json: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user)
):
    """
    Applies automatic Smart Fixes to a DOCX report:
    Normalizes margins (2.5cm or university specs), body fonts, line spacing (1.5),
    paragraph justification, heading hierarchy and caption styling while preserving
    all tables, drawings, images, and content structure.
    """
    custom_rules = None
    if custom_rules_json:
        try:
            custom_rules = json.loads(custom_rules_json)
        except Exception:
            pass

    profile = get_profile(university_id, custom_rules)
    storage = get_storage_service()
    docx_bytes = b""
    original_name = "manuscrit.docx"

    if file:
        original_name = file.filename or "rapport_corrige.docx"
        docx_bytes = await file.read()
    elif report_id and version_number:
        rep = await Report.get(PydanticObjectId(report_id))
        if not rep:
            raise HTTPException(status_code=404, detail="Rapport non trouvé.")
        ver = next((v for v in rep.versions if v.version_number == version_number), None)
        if not ver:
            raise HTTPException(status_code=404, detail=f"Version {version_number} non trouvée.")
        
        # Check if raw file was docx
        if "word" in ver.original_mime_type or ver.original_file_name.lower().endswith(".docx"):
            docx_bytes = await storage.get_file_bytes(ver.raw_file_key)
            original_name = ver.original_file_name
        else:
            raise HTTPException(
                status_code=400,
                detail="Le fichier d'origine de cette version est un PDF. Veuillez téléverser votre fichier source DOCX pour appliquer les Smart Fixes."
            )
    else:
        raise HTTPException(
            status_code=400,
            detail="Veuillez fournir un fichier Word DOCX à corriger."
        )

    # Perform Smart Fix
    try:
        fixer = DocxSmartFixer(docx_bytes, profile)
        fixed_bytes, fixes_applied = fixer.fix()
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Impossible de traiter le fichier DOCX: {str(e)}")

    # Store fixed file
    fix_id = str(uuid.uuid4())
    clean_base = original_name.rsplit(".", 1)[0]
    fixed_filename = f"{clean_base}_CONFORME_{profile.name}.docx"
    dest_key = f"fixed_docx/{fix_id}/{fixed_filename}"
    await storage.upload_file(fixed_bytes, dest_key)

    return SmartFixResponse(
        success=True,
        message=f"Document DOCX corrigé avec succès selon la charte {profile.full_name}.",
        file_name=fixed_filename,
        download_url=f"/api/v1/compliance/download-fixed/{fix_id}?filename={fixed_filename}",
        total_fixes_applied=len(fixes_applied),
        fixes_summary=fixes_applied
    )


@router.get("/download-fixed/{fix_id}")
async def download_fixed_docx(
    fix_id: str,
    filename: Optional[str] = Query("rapport_corrige.docx")
):
    """Downloads the corrected DOCX file produced by Smart Fix."""
    storage = get_storage_service()
    dest_key = f"fixed_docx/{fix_id}/{filename}"
    try:
        file_bytes = await storage.get_file_bytes(dest_key)
    except Exception:
        raise HTTPException(status_code=404, detail="Fichier corrigé introuvable ou expiré.")

    return Response(
        content=file_bytes,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )
