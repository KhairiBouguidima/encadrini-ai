import io
from datetime import datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, HTTPException, status, Depends
from fastapi.responses import StreamingResponse
from beanie import PydanticObjectId

from app.models.user import User, UserRole
from app.models.project import Project, SupervisorRole
from app.models.report import Report, WorkflowStatus
from app.models.annotation import Annotation
from app.models.evaluation import Evaluation, ApprovalStatus
from app.schemas.evaluation import (
    EvaluationCreate, EvaluationUpdate, EvaluationResponse, DualValidationVersionStatus
)
from app.api.deps import get_current_user, require_role
from app.models.notification import NotificationType
from app.services.notification_service import notify
from app.api.v1.endpoints.projects import log_project_activity

router = APIRouter()

STATUS_FRENCH_LABELS = {
    ApprovalStatus.PENDING_REVIEW: "En attente d'évaluation",
    ApprovalStatus.CORRECTIONS_REQUIRED: "Corrections requises",
    ApprovalStatus.APPROVED_FOR_DEFENSE: "Approuvé pour la soutenance",
    ApprovalStatus.REJECTED: "Rejeté",
}


def _to_response(e: Evaluation, supervisor: Optional[User] = None) -> EvaluationResponse:
    enc_name = None
    enc_email = None
    if supervisor:
        enc_name = f"{supervisor.first_name} {supervisor.last_name}".strip()
        enc_email = supervisor.email

    return EvaluationResponse(
        id=str(e.id),
        report_id=str(e.report_id),
        version_number=e.version_number,
        encadrer_id=str(e.encadrer_id),
        encadrer_name=enc_name,
        encadrer_email=enc_email,
        supervisor_role=getattr(e, "supervisor_role", SupervisorRole.ACADEMIC) or SupervisorRole.ACADEMIC,
        grade=e.grade,
        feedback=e.feedback,
        approval_status=e.approval_status or ApprovalStatus.PENDING_REVIEW,
        criteria_ratings=getattr(e, "criteria_ratings", {}) or {},
        created_at=e.created_at,
        updated_at=e.updated_at,
    )


async def _check_supervisor(report_id: PydanticObjectId, current_user: User):
    """Verify current user is a supervisor for the report's project."""
    report = await Report.get(report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Rapport non trouvé.")
    project = await Project.get(report.project_id)
    is_supervisor = project and (
        project.encadrer_id == current_user.id
        or getattr(project, "academic_encadrer_id", None) == current_user.id
        or getattr(project, "enterprise_encadrer_id", None) == current_user.id
        or current_user.id in getattr(project, "encadrer_ids", [])
    )
    if not is_supervisor:
        raise HTTPException(status_code=403, detail="Non autorisé à évaluer ce rapport.")
    return report, project


async def compute_dual_validation(report: Report, version_number: int, project: Project) -> DualValidationVersionStatus:
    """Computes the dual validation status for a specific report version."""
    # Find all evaluations for this version
    evaluations = await Evaluation.find(
        Evaluation.report_id == report.id,
        Evaluation.version_number == version_number,
    ).to_list()

    eval_responses: List[EvaluationResponse] = []
    academic_eval: Optional[EvaluationResponse] = None
    enterprise_eval: Optional[EvaluationResponse] = None

    for ev in evaluations:
        sup = await User.get(ev.encadrer_id)
        resp = _to_response(ev, sup)
        eval_responses.append(resp)

        # Distinguish role
        if ev.encadrer_id == project.enterprise_encadrer_id or ev.supervisor_role == SupervisorRole.ENTERPRISE:
            enterprise_eval = resp
        elif ev.encadrer_id == project.academic_encadrer_id or ev.supervisor_role == SupervisorRole.ACADEMIC:
            academic_eval = resp
        elif not academic_eval:
            academic_eval = resp

    requires_academic = bool(project.academic_encadrer_id or project.encadrer_id or not project.enterprise_encadrer_id)
    requires_enterprise = bool(project.enterprise_encadrer_id)

    academic_approved = bool(academic_eval and academic_eval.approval_status == ApprovalStatus.APPROVED_FOR_DEFENSE)
    enterprise_approved = bool(enterprise_eval and enterprise_eval.approval_status == ApprovalStatus.APPROVED_FOR_DEFENSE)

    # Check for corrections request or rejection
    any_corrections = any(e.approval_status == ApprovalStatus.CORRECTIONS_REQUIRED for e in eval_responses)
    any_rejected = any(e.approval_status == ApprovalStatus.REJECTED for e in eval_responses)

    # Calculate overall workflow status
    if any_corrections:
        wf_status = WorkflowStatus.CHANGES_REQUESTED
        summary_msg = "Des corrections ont été demandées. Veuillez réviser le document et déposer une nouvelle version."
    elif any_rejected:
        wf_status = WorkflowStatus.REJECTED
        summary_msg = "Le livrable a été rejeté par l'un des encadreurs."
    elif requires_academic and requires_enterprise:
        if academic_approved and enterprise_approved:
            wf_status = WorkflowStatus.APPROVED
            summary_msg = "Double validation validée ! Les deux encadreurs (académique et entreprise) ont approuvé ce rapport pour la soutenance."
        elif academic_approved and not enterprise_eval:
            wf_status = WorkflowStatus.UNDER_REVIEW
            summary_msg = "Approuvé par l'encadreur académique. En attente de l'avis de l'encadreur d'entreprise."
        elif enterprise_approved and not academic_eval:
            wf_status = WorkflowStatus.UNDER_REVIEW
            summary_msg = "Approuvé par l'encadreur d'entreprise. En attente de l'avis de l'encadreur académique."
        elif academic_eval or enterprise_eval:
            wf_status = WorkflowStatus.UNDER_REVIEW
            summary_msg = "En cours d'examen par les encadreurs."
        else:
            wf_status = WorkflowStatus.SUBMITTED
            summary_msg = "Document soumis. En attente des évaluations académique et professionnelle."
    elif requires_enterprise:
        if enterprise_approved:
            wf_status = WorkflowStatus.APPROVED
            summary_msg = "Rapport approuvé pour soutenance par le tuteur d'entreprise."
        elif enterprise_eval:
            wf_status = WorkflowStatus.UNDER_REVIEW
            summary_msg = "En cours d'examen par l'encadreur d'entreprise."
        else:
            wf_status = WorkflowStatus.SUBMITTED
            summary_msg = "En attente de l'évaluation de l'encadreur d'entreprise."
    else:
        # Academic only
        if academic_approved:
            wf_status = WorkflowStatus.APPROVED
            summary_msg = "Rapport approuvé pour soutenance par l'encadreur académique."
        elif academic_eval:
            wf_status = WorkflowStatus.UNDER_REVIEW
            summary_msg = "En cours d'examen par l'encadreur académique."
        else:
            wf_status = WorkflowStatus.SUBMITTED
            summary_msg = "En attente de l'évaluation de l'encadreur académique."

    is_fully_approved = (wf_status == WorkflowStatus.APPROVED)
    requires_changes = (wf_status == WorkflowStatus.CHANGES_REQUESTED)

    # Sync with report version workflow status in DB
    for v in report.versions:
        if v.version_number == version_number:
            if v.workflow_status != wf_status:
                v.workflow_status = wf_status
                report.updated_at = datetime.now(timezone.utc)
                await report.save()
            break

    return DualValidationVersionStatus(
        report_id=str(report.id),
        version_number=version_number,
        workflow_status=wf_status.value,
        requires_academic=requires_academic,
        requires_enterprise=requires_enterprise,
        academic_evaluation=academic_eval,
        enterprise_evaluation=enterprise_eval,
        academic_approved=academic_approved,
        enterprise_approved=enterprise_approved,
        is_fully_approved=is_fully_approved,
        requires_changes=requires_changes,
        summary_message=summary_msg,
        evaluations=eval_responses,
    )


@router.post("/", response_model=EvaluationResponse, status_code=status.HTTP_201_CREATED)
async def create_or_update_evaluation(
    payload: EvaluationCreate,
    current_user: User = Depends(require_role([UserRole.ENCADRER]))
):
    """Create or update (upsert) a grade, feedback, and approval status for a report version."""
    report_id = PydanticObjectId(payload.report_id)
    report, project = await _check_supervisor(report_id, current_user)

    status_val = payload.approval_status or ApprovalStatus.PENDING_REVIEW

    # Deduce supervisor role
    s_role = payload.supervisor_role
    if not s_role:
        if project.enterprise_encadrer_id == current_user.id:
            s_role = SupervisorRole.ENTERPRISE
        else:
            s_role = SupervisorRole.ACADEMIC

    existing = await Evaluation.find_one(
        Evaluation.report_id == report_id,
        Evaluation.version_number == payload.version_number,
        Evaluation.encadrer_id == current_user.id,
    )
    if existing:
        existing.grade = payload.grade
        existing.feedback = payload.feedback
        existing.approval_status = status_val
        existing.supervisor_role = s_role
        if payload.criteria_ratings is not None:
            existing.criteria_ratings = payload.criteria_ratings
        existing.updated_at = datetime.now(timezone.utc)
        await existing.save()
        target_eval = existing
    else:
        target_eval = Evaluation(
            report_id=report_id,
            version_number=payload.version_number,
            encadrer_id=current_user.id,
            supervisor_role=s_role,
            grade=payload.grade,
            feedback=payload.feedback,
            approval_status=status_val,
            criteria_ratings=payload.criteria_ratings or {},
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc)
        )
        await target_eval.insert()

    # Log project activity
    role_label = "académique" if s_role == SupervisorRole.ACADEMIC else "entreprise"
    decision_fr = STATUS_FRENCH_LABELS.get(status_val, str(status_val))
    log_project_activity(
        project,
        current_user,
        "EVALUATION_SOUMISE",
        f"Avis {role_label} sur v{payload.version_number} : {payload.grade}/20 ({decision_fr})"
    )
    await project.save()

    # Compute dual validation status
    dual_status = await compute_dual_validation(report, payload.version_number, project)

    # Students to notify (both creator and binome)
    students_to_notify = [project.student_id]
    if getattr(project, "co_student_id", None):
        students_to_notify.append(project.co_student_id)

    supervisor_name = f"{current_user.first_name} {current_user.last_name}".strip()

    for sid in students_to_notify:
        if dual_status.is_fully_approved:
            await notify(
                user_id=sid,
                notification_type=NotificationType.DUAL_APPROVAL_COMPLETED,
                title="Double Validation Obtenue !",
                message=f"Le rapport « {report.title} » (v{payload.version_number}) a reçu l'approbation conjointe de vos deux encadreurs pour la soutenance.",
                link=f"/reports/{report.id}/v{payload.version_number}"
            )
        elif status_val == ApprovalStatus.CORRECTIONS_REQUIRED:
            await notify(
                user_id=sid,
                notification_type=NotificationType.CHANGES_REQUESTED,
                title=f"Corrections requises ({role_label})",
                message=f"{supervisor_name} demande des corrections sur la version {payload.version_number}. Déposez une nouvelle version corrigée.",
                link=f"/reports/{report.id}/v{payload.version_number}"
            )
        else:
            await notify(
                user_id=sid,
                notification_type=NotificationType.EVALUATION_SAVED,
                title=f"Avis {role_label} enregistré",
                message=f"{supervisor_name} a évalué la version {payload.version_number} : {payload.grade}/20 ({decision_fr}).",
                link=f"/reports/{report.id}/v{payload.version_number}"
            )

    return _to_response(target_eval, current_user)


@router.get("/reports/{report_id}/version/{version_number}/dual-status", response_model=DualValidationVersionStatus)
async def get_dual_validation_status(
    report_id: PydanticObjectId,
    version_number: int,
    current_user: User = Depends(get_current_user)
):
    """Fetch dual validation status for a specific version."""
    report = await Report.get(report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Rapport non trouvé.")
    project = await Project.get(report.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Projet non trouvé.")

    # Access check: student in project, supervisor in project, or admin
    is_student = (project.student_id == current_user.id or getattr(project, "co_student_id", None) == current_user.id)
    is_supervisor = (
        project.encadrer_id == current_user.id
        or getattr(project, "academic_encadrer_id", None) == current_user.id
        or getattr(project, "enterprise_encadrer_id", None) == current_user.id
        or current_user.id in getattr(project, "encadrer_ids", [])
    )
    if not (is_student or is_supervisor or current_user.role == UserRole.ADMIN):
        raise HTTPException(status_code=403, detail="Accès non autorisé.")

    return await compute_dual_validation(report, version_number, project)


@router.get("/reports/{report_id}/version/{version_number}/all", response_model=List[EvaluationResponse])
async def get_all_version_evaluations(
    report_id: PydanticObjectId,
    version_number: int,
    current_user: User = Depends(get_current_user)
):
    """Fetch all evaluations (Academic & Enterprise) for a specific report version."""
    report = await Report.get(report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Rapport non trouvé.")
    project = await Project.get(report.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Projet non trouvé.")

    is_student = (project.student_id == current_user.id or getattr(project, "co_student_id", None) == current_user.id)
    is_supervisor = (
        project.encadrer_id == current_user.id
        or getattr(project, "academic_encadrer_id", None) == current_user.id
        or getattr(project, "enterprise_encadrer_id", None) == current_user.id
        or current_user.id in getattr(project, "encadrer_ids", [])
    )
    if not (is_student or is_supervisor or current_user.role == UserRole.ADMIN):
        raise HTTPException(status_code=403, detail="Accès non autorisé.")

    evaluations = await Evaluation.find(
        Evaluation.report_id == report_id,
        Evaluation.version_number == version_number,
    ).to_list()

    results: List[EvaluationResponse] = []
    for ev in evaluations:
        sup = await User.get(ev.encadrer_id)
        results.append(_to_response(ev, sup))
    return results


@router.get("/reports/{report_id}/version/{version_number}", response_model=EvaluationResponse)
async def get_evaluation(
    report_id: PydanticObjectId,
    version_number: int,
    current_user: User = Depends(get_current_user)
):
    """Fetch evaluation for a specific report version."""
    report = await Report.get(report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Rapport non trouvé.")
    project = await Project.get(report.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Projet non trouvé.")

    is_student = (project.student_id == current_user.id or getattr(project, "co_student_id", None) == current_user.id)
    is_supervisor = (
        project.encadrer_id == current_user.id
        or getattr(project, "academic_encadrer_id", None) == current_user.id
        or getattr(project, "enterprise_encadrer_id", None) == current_user.id
        or current_user.id in getattr(project, "encadrer_ids", [])
    )
    if not (is_supervisor or is_student or current_user.role == UserRole.ADMIN):
        raise HTTPException(status_code=403, detail="Accès refusé.")

    # If supervisor calls, return their own evaluation if available
    if is_supervisor:
        my_eval = await Evaluation.find_one(
            Evaluation.report_id == report_id,
            Evaluation.version_number == version_number,
            Evaluation.encadrer_id == current_user.id,
        )
        if my_eval:
            return _to_response(my_eval, current_user)

    evaluation = await Evaluation.find_one(
        Evaluation.report_id == report_id,
        Evaluation.version_number == version_number,
    )
    if not evaluation:
        raise HTTPException(status_code=404, detail="Aucune évaluation pour cette version.")

    supervisor = await User.get(evaluation.encadrer_id)
    return _to_response(evaluation, supervisor)


@router.patch("/{evaluation_id}", response_model=EvaluationResponse)
async def update_evaluation(
    evaluation_id: PydanticObjectId,
    payload: EvaluationUpdate,
    current_user: User = Depends(require_role([UserRole.ENCADRER]))
):
    evaluation = await Evaluation.get(evaluation_id)
    if not evaluation:
        raise HTTPException(status_code=404, detail="Évaluation non trouvée.")
    if evaluation.encadrer_id != current_user.id and current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Vous ne pouvez modifier que vos propres évaluations.")
    if payload.grade is not None:
        evaluation.grade = payload.grade
    if payload.feedback is not None:
        evaluation.feedback = payload.feedback
    if payload.approval_status is not None:
        evaluation.approval_status = payload.approval_status
    if payload.criteria_ratings is not None:
        evaluation.criteria_ratings = payload.criteria_ratings
    evaluation.updated_at = datetime.now(timezone.utc)
    await evaluation.save()

    report = await Report.get(evaluation.report_id)
    if report:
        project = await Project.get(report.project_id)
        if project:
            await compute_dual_validation(report, evaluation.version_number, project)

    return _to_response(evaluation, current_user)


@router.get("/reports/{report_id}/version/{version_number}/pdf")
async def export_evaluation_pdf(
    report_id: PydanticObjectId,
    version_number: int,
    current_user: User = Depends(get_current_user)
):
    """Generate and download a comprehensive PDF evaluation sheet with dual-validation details."""
    report = await Report.get(report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Rapport non trouvé.")
    project = await Project.get(report.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Projet non trouvé.")

    is_student = (project.student_id == current_user.id or getattr(project, "co_student_id", None) == current_user.id)
    is_supervisor = (
        project.encadrer_id == current_user.id
        or getattr(project, "academic_encadrer_id", None) == current_user.id
        or getattr(project, "enterprise_encadrer_id", None) == current_user.id
        or current_user.id in getattr(project, "encadrer_ids", [])
    )
    if not (is_supervisor or is_student or current_user.role == UserRole.ADMIN):
        raise HTTPException(status_code=403, detail="Accès refusé.")

    dual_status = await compute_dual_validation(report, version_number, project)
    evaluations = await Evaluation.find(
        Evaluation.report_id == report_id,
        Evaluation.version_number == version_number,
    ).to_list()

    if not evaluations:
        raise HTTPException(status_code=404, detail="Aucune évaluation enregistrée pour cette version.")

    # Fetch users & annotations
    student1 = await User.get(project.student_id) if project.student_id else None
    student2 = await User.get(project.co_student_id) if getattr(project, "co_student_id", None) else None

    annotations = await Annotation.find(
        Annotation.report_id == report_id,
        Annotation.version_number == version_number
    ).sort(+Annotation.page_number).to_list()

    # Generate PDF in memory with ReportLab
    from reportlab.lib.pagesizes import A4
    from reportlab.lib import colors
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=36,
        leftMargin=36,
        topMargin=36,
        bottomMargin=36
    )

    styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=18,
        leading=22,
        textColor=colors.HexColor('#1e3a8a'),
    )

    heading_style = ParagraphStyle(
        'SectionHeading',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=15,
        textColor=colors.HexColor('#0f172a'),
        spaceBefore=12,
        spaceAfter=5,
    )

    body_style = ParagraphStyle(
        'Body',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=13,
        textColor=colors.HexColor('#334155'),
    )

    elements = []

    # Brand Header
    elements.append(Paragraph("ENCADRINI AI — SYSTÈME DE DOUBLE VALIDATION PFE", ParagraphStyle('Brand', fontName='Helvetica-Bold', fontSize=10, textColor=colors.HexColor('#2563eb'))))
    elements.append(Paragraph("Procès-Verbal d'Évaluation & Validation Conjointe", title_style))
    elements.append(Spacer(1, 8))
    elements.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor('#2563eb'), spaceAfter=10))

    # Project & Students Metadata
    st1_str = f"{student1.first_name} {student1.last_name} ({student1.email})" if student1 else "Étudiant"
    team_str = st1_str
    if student2:
        team_str += f"<br/><b>Binôme :</b> {student2.first_name} {student2.last_name} ({student2.email})"

    global_status_label = "VALIDÉ POUR LA SOUTENANCE (Double Accord)" if dual_status.is_fully_approved else (
        "CORRECTIONS REQUISES" if dual_status.requires_changes else dual_status.workflow_status
    )
    status_bg = '#dcfce7' if dual_status.is_fully_approved else ('#fef3c7' if dual_status.requires_changes else '#f1f5f9')
    status_fg = '#15803d' if dual_status.is_fully_approved else ('#b45309' if dual_status.requires_changes else '#334155')

    meta_data = [
        [
            Paragraph("<b>Projet PFE :</b>", body_style), Paragraph(project.title, body_style),
            Paragraph("<b>Rapport :</b>", body_style), Paragraph(f"{report.title} (v{version_number})", body_style),
        ],
        [
            Paragraph("<b>Équipe :</b>", body_style), Paragraph(team_str, body_style),
            Paragraph("<b>Statut global :</b>", body_style), Paragraph(f"<font color='{status_fg}'><b>{global_status_label}</b></font>", body_style),
        ],
        [
            Paragraph("<b>Année Univ. :</b>", body_style), Paragraph(project.academic_year or "2025-2026", body_style),
            Paragraph("<b>Date d'émission :</b>", body_style), Paragraph(datetime.now(timezone.utc).strftime("%d/%m/%Y à %H:%M"), body_style),
        ]
    ]

    meta_table = Table(meta_data, colWidths=[75, 200, 95, 150])
    meta_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#f8fafc')),
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#cbd5e1')),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
    ]))
    elements.append(meta_table)
    elements.append(Spacer(1, 12))

    # Dual Validation Highlight Box
    dual_rows = [
        [
            Paragraph(f"<b>Statut de Validation Conjointe :</b> {dual_status.summary_message}", ParagraphStyle('DualNotice', fontName='Helvetica-Bold', fontSize=10, textColor=colors.HexColor(status_fg)))
        ]
    ]
    dual_box = Table(dual_rows, colWidths=[520])
    dual_box.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor(status_bg)),
        ('BOX', (0, 0), (-1, -1), 1.5, colors.HexColor(status_fg)),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('LEFTPADDING', (0, 0), (-1, -1), 10),
        ('RIGHTPADDING', (0, 0), (-1, -1), 10),
    ]))
    elements.append(dual_box)
    elements.append(Spacer(1, 10))

    # Detailed Reviews (Both Academic & Enterprise)
    elements.append(Paragraph("Avis & Décisions des Superviseurs", heading_style))

    for ev in evaluations:
        sup = await User.get(ev.encadrer_id)
        sup_name = f"{sup.first_name} {sup.last_name}" if sup else "Superviseur"
        is_academic = (ev.supervisor_role == SupervisorRole.ACADEMIC or ev.encadrer_id == project.academic_encadrer_id)
        role_title = "Encadreur Académique (Université)" if is_academic else "Encadreur Entreprise (Tuteur Professionnel)"
        role_color = '#1d4ed8' if is_academic else '#0f766e'

        grade_txt = f"<b>{ev.grade:.2f} / 20</b>"
        decision_txt = STATUS_FRENCH_LABELS.get(ev.approval_status, str(ev.approval_status))
        fb_content = ev.feedback.strip() if ev.feedback else "Aucun commentaire général rédigé."

        eval_card_data = [
            [
                Paragraph(f"<font color='{role_color}'><b>{role_title}</b></font><br/>{sup_name} ({sup.email if sup else ''})", body_style),
                Paragraph(f"Note attribuée :<br/><font size=14 color='{role_color}'>{grade_txt}</font>", body_style),
                Paragraph(f"Décision :<br/><b>{decision_txt}</b>", body_style),
            ],
            [
                Paragraph(f"<b>Appréciation & Recommandations :</b><br/>{fb_content.replace(chr(10), '<br/>')}", body_style),
                "", ""
            ]
        ]
        ev_table = Table(eval_card_data, colWidths=[240, 140, 140])
        ev_table.setStyle(TableStyle([
            ('SPAN', (0, 1), (2, 1)),
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#ffffff')),
            ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#cbd5e1')),
            ('LINEBELOW', (0, 0), (-1, 0), 0.5, colors.HexColor('#e2e8f0')),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('LEFTPADDING', (0, 0), (-1, -1), 8),
            ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ]))
        elements.append(ev_table)
        elements.append(Spacer(1, 8))

    # Annotations Table
    elements.append(Spacer(1, 6))
    elements.append(Paragraph(f"Remarques Détaillées et Annotations ({len(annotations)})", heading_style))
    if annotations:
        ann_rows = [[
            Paragraph("<b>Page</b>", body_style),
            Paragraph("<b>Extrait</b>", body_style),
            Paragraph("<b>Commentaire</b>", body_style),
        ]]
        for a in annotations:
            ann_rows.append([
                Paragraph(f"p. {a.page_number}", body_style),
                Paragraph(f"<i>« {a.selected_text[:70]}... »</i>" if a.selected_text else "-", body_style),
                Paragraph(a.content, body_style),
            ])
        ann_table = Table(ann_rows, colWidths=[40, 160, 320])
        ann_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#f1f5f9')),
            ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#cbd5e1')),
            ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
            ('TOPPADDING', (0, 0), (-1, -1), 5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
            ('LEFTPADDING', (0, 0), (-1, -1), 6),
            ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ]))
        elements.append(ann_table)
    else:
        elements.append(Paragraph("Aucune remarque marginale enregistrée sur cette version.", body_style))

    elements.append(Spacer(1, 14))
    elements.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor('#cbd5e1'), spaceAfter=6))
    elements.append(Paragraph(
        "Fiche officielle certifiée générée par Encadrini AI — Workflow Binômes & Multi-Encadreurs.",
        ParagraphStyle('Footer', fontName='Helvetica-Oblique', fontSize=8, textColor=colors.HexColor('#94a3b8'), alignment=1)
    ))

    doc.build(elements)
    buffer.seek(0)

    filename = f"Double_Validation_{report.title[:15].replace(' ', '_')}_v{version_number}.pdf"
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )
