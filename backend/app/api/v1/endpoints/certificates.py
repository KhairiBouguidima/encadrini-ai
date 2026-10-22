import secrets
from datetime import datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, HTTPException, status, Depends
from fastapi.responses import StreamingResponse
from beanie import PydanticObjectId

from app.core.config import settings
from app.models.user import User, UserRole
from app.models.project import Project, SupervisorRole
from app.models.report import Report, WorkflowStatus
from app.models.compliance import ComplianceReportDocument
from app.models.certificate import PFEValidationCertificate, PFEValidationStatus
from app.models.notification import NotificationType
from app.schemas.certificate import (
    FinalValidationRequest, CertificateResponse, PublicCertificateVerificationResponse
)
from app.api.deps import get_current_user
from app.services.notification_service import notify
from app.api.v1.endpoints.projects import log_project_activity
from app.services.certificate_service import (
    compute_certificate_hash, generate_pfe_certificate_pdf
)

router = APIRouter()


def _is_project_supervisor(project: Project, user: User) -> bool:
    if user.id == project.encadrer_id:
        return True
    if user.id == getattr(project, "academic_encadrer_id", None):
        return True
    if user.id == getattr(project, "enterprise_encadrer_id", None):
        return True
    if user.id in getattr(project, "encadrer_ids", []):
        return True
    return False


def _is_project_student(project: Project, user: User) -> bool:
    if user.id == project.student_id or user.id == project.co_student_id:
        return True
    if user.id in getattr(project, "student_ids", []):
        return True
    return False


def _build_verification_url(certificate_id: str, token: str) -> str:
    base = settings.FRONTEND_URL.rstrip("/")
    return f"{base}?cert_id={certificate_id}&token={token}"


def _to_certificate_response(cert: PFEValidationCertificate) -> CertificateResponse:
    verif_url = _build_verification_url(cert.certificate_id, cert.verification_token)
    download_url = f"{settings.API_V1_STR}/certificates/{cert.certificate_id}/download"
    return CertificateResponse(
        id=str(cert.id),
        certificate_id=cert.certificate_id,
        verification_token=cert.verification_token,
        project_id=str(cert.project_id),
        report_id=str(cert.report_id),
        version_number=cert.version_number,
        validation_status=cert.validation_status,
        academic_year=cert.academic_year,
        institution_name=cert.institution_name,
        project_title=cert.project_title,
        student_names=cert.student_names,
        student_emails=cert.student_emails,
        supervisor_name=cert.supervisor_name,
        supervisor_email=cert.supervisor_email,
        supervisor_role=cert.supervisor_role,
        supervisor_mention=cert.supervisor_mention,
        supervisor_notes=cert.supervisor_notes,
        enterprise_supervisor_name=cert.enterprise_supervisor_name,
        enterprise_supervisor_email=cert.enterprise_supervisor_email,
        ai_compliance_score=cert.ai_compliance_score,
        ai_compliance_level=cert.ai_compliance_level,
        ai_compliance_summary=cert.ai_compliance_summary,
        validation_date=cert.validation_date,
        certificate_hash=cert.certificate_hash,
        legal_notice=cert.legal_notice,
        download_count=cert.download_count,
        verification_url=verif_url,
        download_url=download_url,
        created_at=cert.created_at,
    )


@router.post("/projects/{project_id}/final-validation", response_model=CertificateResponse)
async def validate_final_pfe_and_issue_certificate(
    project_id: PydanticObjectId,
    payload: FinalValidationRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Allow the authorized supervisor to validate the final report version and issue
    the official PFE Validation & Deposit Certificate.
    """
    project = await Project.get(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Projet non trouvé.")

    # Authorization guard: only supervisor or admin can perform final validation
    if current_user.role != UserRole.ADMIN and not _is_project_supervisor(project, current_user):
        raise HTTPException(
            status_code=403,
            detail="Seul un encadreur habilité ou l'administrateur peut accorder la validation finale du PFE."
        )

    # Resolve report
    if payload.report_id:
        report = await Report.get(PydanticObjectId(payload.report_id))
    else:
        report = await Report.find_one(Report.project_id == project.id)

    if not report or not report.versions:
        raise HTTPException(status_code=404, detail="Aucun rapport ou version soumis pour ce projet.")

    # Target version: either specified or latest version
    target_version = payload.version_number or report.current_version
    matching_version = next((v for v in report.versions if v.version_number == target_version), None)
    if not matching_version:
        matching_version = report.versions[-1]
        target_version = matching_version.version_number

    # Retrieve student details
    students: List[User] = []
    st1 = await User.get(project.student_id)
    if st1:
        students.append(st1)
    if project.co_student_id:
        st2 = await User.get(project.co_student_id)
        if st2 and st2.id not in [s.id for s in students]:
            students.append(st2)
    for sid in getattr(project, "student_ids", []):
        if sid not in [s.id for s in students]:
            st = await User.get(sid)
            if st:
                students.append(st)

    student_names = [f"{s.first_name} {s.last_name}".strip() for s in students]
    student_emails = [s.email for s in students]

    # Resolve institution name
    institution = payload.institution_name
    if not institution:
        # Use student faculty or project context
        faculties = [s.faculty for s in students if getattr(s, "faculty", None)]
        institution = faculties[0] if faculties else "Université / Établissement d'enseignement supérieur"

    # Supervisor information
    sup_role = SupervisorRole.ENTERPRISE if current_user.id == getattr(project, "enterprise_encadrer_id", None) else SupervisorRole.ACADEMIC
    sup_name = f"{current_user.first_name} {current_user.last_name}".strip()
    sup_email = current_user.email

    # Enterprise supervisor information if present
    ent_sup_name = None
    ent_sup_email = None
    if project.enterprise_encadrer_id and project.enterprise_encadrer_id != current_user.id:
        ent_u = await User.get(project.enterprise_encadrer_id)
        if ent_u:
            ent_sup_name = f"{ent_u.first_name} {ent_u.last_name}".strip()
            ent_sup_email = ent_u.email

    # AI Compliance score resolution: Optional and NEVER fabricated
    comp_doc = await ComplianceReportDocument.find_one(
        ComplianceReportDocument.report_id == report.id,
        ComplianceReportDocument.version_number == target_version,
    )
    # Also check without version number if not found
    if not comp_doc:
        comp_doc = await ComplianceReportDocument.find_one(
            ComplianceReportDocument.report_id == report.id,
        )

    ai_score: Optional[float] = None
    ai_level: Optional[str] = None
    ai_summary: Optional[str] = None

    if comp_doc:
        ai_score = round(comp_doc.overall_score, 1)
        ai_level = comp_doc.compliance_level
        ai_summary = comp_doc.summary

    # Generate unique Certificate ID and Verification Token
    cert_year = datetime.now(timezone.utc).year
    cert_id = f"CERT-PFE-{cert_year}-{secrets.token_hex(4).upper()}"
    verif_token = secrets.token_urlsafe(24)
    val_date = datetime.now(timezone.utc)

    # Compute SHA-256 cryptographic hash
    cert_hash = compute_certificate_hash(
        certificate_id=cert_id,
        project_id=str(project.id),
        report_id=str(report.id),
        version_number=target_version,
        student_names=student_names,
        supervisor_name=sup_name,
        validation_date=val_date,
    )

    # Check if certificate already exists for this project; update or create
    existing_cert = await PFEValidationCertificate.find_one(
        PFEValidationCertificate.project_id == project.id
    )

    if existing_cert:
        cert = existing_cert
        cert.certificate_id = cert_id
        cert.verification_token = verif_token
        cert.report_id = report.id
        cert.version_number = target_version
        cert.validation_status = PFEValidationStatus.VALIDATED
        cert.academic_year = getattr(project, "academic_year", "2025-2026") or "2025-2026"
        cert.institution_name = institution
        cert.project_title = project.title
        cert.student_names = student_names
        cert.student_emails = student_emails
        cert.supervisor_name = sup_name
        cert.supervisor_email = sup_email
        cert.supervisor_role = sup_role
        cert.supervisor_mention = payload.mention or "Favorable pour soutenance"
        cert.supervisor_notes = payload.notes or "Rapport final validé sans réserve pour le dépôt officiel."
        cert.enterprise_supervisor_name = ent_sup_name
        cert.enterprise_supervisor_email = ent_sup_email
        cert.ai_compliance_score = ai_score
        cert.ai_compliance_level = ai_level
        cert.ai_compliance_summary = ai_summary
        cert.validation_date = val_date
        cert.certificate_hash = cert_hash
        cert.updated_at = val_date
        await cert.save()
    else:
        cert = PFEValidationCertificate(
            certificate_id=cert_id,
            verification_token=verif_token,
            project_id=project.id,
            report_id=report.id,
            version_number=target_version,
            validation_status=PFEValidationStatus.VALIDATED,
            academic_year=getattr(project, "academic_year", "2025-2026") or "2025-2026",
            institution_name=institution,
            project_title=project.title,
            student_names=student_names,
            student_emails=student_emails,
            supervisor_name=sup_name,
            supervisor_email=sup_email,
            supervisor_role=sup_role,
            supervisor_mention=payload.mention or "Favorable pour soutenance",
            supervisor_notes=payload.notes or "Rapport final validé sans réserve pour le dépôt officiel.",
            enterprise_supervisor_name=ent_sup_name,
            enterprise_supervisor_email=ent_sup_email,
            ai_compliance_score=ai_score,
            ai_compliance_level=ai_level,
            ai_compliance_summary=ai_summary,
            validation_date=val_date,
            certificate_hash=cert_hash,
        )
        await cert.insert()

    # Mark report version as APPROVED
    matching_version.workflow_status = WorkflowStatus.APPROVED
    await report.save()

    # Notify students that final validation was granted and certificate is available
    for s in students:
        await notify(
            user_id=s.id,
            notification_type=NotificationType.FINAL_VALIDATION_COMPLETED,
            title="Validation finale PFE accordée !",
            message=(
                f"Félicitations ! L'encadreur {sup_name} a validé votre version finale (v{target_version}). "
                f"Votre Certificat Officiel de Dépôt ({cert.certificate_id}) est prêt au téléchargement."
            ),
            link=f"/projects/{project.id}?tab=certificate",
        )

    log_project_activity(
        project,
        current_user,
        "FINAL_VALIDATION_APPROVED",
        f"Validation finale accordée sur la version {target_version}. Certificat {cert.certificate_id} émis."
    )
    await project.save()

    return _to_certificate_response(cert)


@router.get("/projects/{project_id}/certificate", response_model=Optional[CertificateResponse])
async def get_project_certificate(
    project_id: PydanticObjectId,
    current_user: User = Depends(get_current_user),
):
    """
    Get the official certificate for a project if validated.
    """
    project = await Project.get(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Projet non trouvé.")

    # Permissions: project members or admin
    if current_user.role != UserRole.ADMIN and not _is_project_student(project, current_user) and not _is_project_supervisor(project, current_user):
        raise HTTPException(status_code=403, detail="Accès non autorisé aux détails du certificat de ce projet.")

    cert = await PFEValidationCertificate.find_one(
        PFEValidationCertificate.project_id == project_id
    )
    if not cert:
        return None

    return _to_certificate_response(cert)


@router.get("/certificates/{certificate_id}/download")
async def download_certificate_pdf(
    certificate_id: str,
    current_user: User = Depends(get_current_user),
):
    """
    Download the official PDF validation certificate.
    CRITICAL RULE: Never generate an official certificate before supervisor approval!
    """
    cert = await PFEValidationCertificate.find_one(
        PFEValidationCertificate.certificate_id == certificate_id
    )
    if not cert:
        raise HTTPException(status_code=404, detail="Certificat introuvable.")

    # CRITICAL: Verify official approval before generating PDF
    if cert.validation_status != PFEValidationStatus.VALIDATED:
        raise HTTPException(
            status_code=400,
            detail="Le certificat officiel ne peut pas être généré avant l'approbation formelle de l'encadreur."
        )

    # Check project permissions
    project = await Project.get(cert.project_id)
    if project and current_user.role != UserRole.ADMIN:
        is_member = _is_project_student(project, current_user) or _is_project_supervisor(project, current_user)
        if not is_member:
            raise HTTPException(status_code=403, detail="Non autorisé à télécharger ce certificat.")

    verif_url = _build_verification_url(cert.certificate_id, cert.verification_token)
    pdf_buffer = generate_pfe_certificate_pdf(cert, verif_url)

    cert.download_count += 1
    await cert.save()

    filename = f"Certificat_Depot_PFE_{cert.certificate_id}.pdf"
    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/certificates/verify/{identifier}", response_model=PublicCertificateVerificationResponse)
async def verify_certificate_authenticity(
    identifier: str,
):
    """
    Public Verification Endpoint (No authentication required).
    Scanned from the QR code or typed by university administration / jury.
    Confirms authenticity without exposing private report manuscripts, annotations or internal drafts.
    """
    cert = await PFEValidationCertificate.find_one(
        {"$or": [
            {"certificate_id": identifier},
            {"verification_token": identifier}
        ]}
    )

    if not cert or cert.validation_status != PFEValidationStatus.VALIDATED:
        return PublicCertificateVerificationResponse(
            is_valid=False,
            status_label="CERTIFICAT NON TROUVÉ OU NON VALIDÉ",
            certificate_id=identifier,
            validation_date=None,
            project_title="Non renseigné",
            institution_name="Établissement inconnu",
            academic_year="-",
            student_names=[],
            supervisor_name="Inconnu",
            supervisor_role="-",
            enterprise_supervisor_name=None,
            version_number=0,
            ai_compliance_score=None,
            ai_compliance_level=None,
            legal_notice=(
                "Aucun certificat valide correspondant à cet identifiant n'a été trouvé. "
                "Veuillez vérifier le numéro ou contacter le secrétariat académique."
            ),
            certificate_hash="INVALID",
        )

    return PublicCertificateVerificationResponse(
        is_valid=True,
        status_label="CERTIFICAT AUTHENTIQUE ET VALIDÉ PAR L'ENCADREUR",
        certificate_id=cert.certificate_id,
        validation_date=cert.validation_date,
        project_title=cert.project_title,
        institution_name=cert.institution_name,
        academic_year=cert.academic_year,
        student_names=cert.student_names,
        supervisor_name=cert.supervisor_name,
        supervisor_role=cert.supervisor_role.value if hasattr(cert.supervisor_role, "value") else str(cert.supervisor_role),
        enterprise_supervisor_name=cert.enterprise_supervisor_name,
        version_number=cert.version_number,
        ai_compliance_score=cert.ai_compliance_score,
        ai_compliance_level=cert.ai_compliance_level,
        legal_notice=cert.legal_notice,
        certificate_hash=cert.certificate_hash,
    )
