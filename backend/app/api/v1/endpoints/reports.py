from typing import List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, status, Depends, UploadFile, File, Form, BackgroundTasks, Query
from fastapi.responses import Response
from beanie import PydanticObjectId

from app.models.user import User, UserRole
from app.models.project import Project
from app.models.report import Report, ReportVersion, AIAnalysisStatus, ReportType, WorkflowStatus
from app.schemas.report import ReportResponse, ReportVersionResponse, ReportCreate
from app.api.deps import get_current_user, require_role
from app.storage.storage_service import get_storage_service
from app.workers.conversion_worker import convert_docx_to_pdf_task
from app.workers.ai_analysis_worker import run_ai_analysis
from app.models.notification import NotificationType
from app.services.notification_service import notify
from app.api.v1.endpoints.projects import log_project_activity

router = APIRouter()

ALLOWED_MIME_TYPES = [
    "application/pdf"
]

def _to_report_response(report: Report) -> ReportResponse:
    rtype_val = getattr(report, "report_type", "PFE")
    rtype_str = rtype_val.value if hasattr(rtype_val, "value") else str(rtype_val).replace("ReportType.", "")
    return ReportResponse(
        id=str(report.id),
        project_id=str(report.project_id),
        title=getattr(report, "title", "Rapport principal") or "Rapport principal",
        report_type=rtype_str,
        description=getattr(report, "description", "") or "",
        current_version=report.current_version,
        versions=[
            ReportVersionResponse(
                version_number=v.version_number,
                original_file_name=v.original_file_name,
                original_mime_type=v.original_mime_type,
                file_size=v.file_size,
                uploaded_at=v.uploaded_at,
                ai_analysis_status=v.ai_analysis_status,
                workflow_status=getattr(v, "workflow_status", WorkflowStatus.SUBMITTED) or WorkflowStatus.SUBMITTED,
                uploaded_by=str(v.uploaded_by) if getattr(v, "uploaded_by", None) else None,
                uploaded_by_name=getattr(v, "uploaded_by_name", None),
                submission_notes=getattr(v, "submission_notes", None)
            ) for v in report.versions
        ],
        created_at=report.created_at,
        updated_at=getattr(report, "updated_at", None),
    )

async def _get_user_project(user: User, project_id: Optional[str] = None) -> Project:
    if project_id:
        p = await Project.get(PydanticObjectId(project_id))
        if p and (
            p.student_id == user.id
            or getattr(p, "co_student_id", None) == user.id
            or user.id in getattr(p, "student_ids", [])
            or p.encadrer_id == user.id
            or getattr(p, "academic_encadrer_id", None) == user.id
            or getattr(p, "enterprise_encadrer_id", None) == user.id
            or user.id in getattr(p, "encadrer_ids", [])
            or user.role == UserRole.ADMIN
        ):
            return p

    if user.role == UserRole.STUDENT:
        p = await Project.find_one({
            "$or": [
                {"student_id": user.id},
                {"co_student_id": user.id},
                {"student_ids": user.id}
            ]
        })
    else:
        p = await Project.find_one({
            "$or": [
                {"encadrer_id": user.id},
                {"academic_encadrer_id": user.id},
                {"enterprise_encadrer_id": user.id},
                {"encadrer_ids": user.id}
            ]
        })

    if not p:
        raise HTTPException(status_code=404, detail="Aucun projet PFE associé trouvé.")
    return p

# ── 1. List all reports for the user's project ─────────────────
@router.get("/", response_model=List[ReportResponse])
async def list_reports(
    project_id: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    project = await _get_user_project(current_user, project_id)
    reports = await Report.find(Report.project_id == project.id).sort("-created_at").to_list()
    return [_to_report_response(r) for r in reports]

# ── 2. Create a new report (with optional initial file) ────────
@router.post("/", response_model=ReportResponse, status_code=status.HTTP_201_CREATED)
async def create_report(
    background_tasks: BackgroundTasks,
    title: str = Form(...),
    report_type: str = Form("PFE"),
    description: Optional[str] = Form(""),
    file: Optional[UploadFile] = File(None),
    current_user: User = Depends(require_role([UserRole.STUDENT]))
):
    project = await _get_user_project(current_user)

    try:
        rtype = ReportType(report_type)
    except ValueError:
        rtype = ReportType.PFE

    report = Report(
        project_id=project.id,
        title=title.strip(),
        report_type=rtype,
        description=description.strip() if description else "",
        current_version=0,
        versions=[],
    )
    await report.insert()

    # If an initial file was uploaded with the report creation
    if file and file.filename:
        if file.content_type not in ALLOWED_MIME_TYPES and not file.filename.endswith(('.pdf', '.docx', '.doc')):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Format de fichier non supporté. Veuillez téléverser un document PDF ou DOCX."
            )

        storage = get_storage_service()
        content = await file.read()
        ext = file.filename.rsplit('.', 1)[-1]
        storage_key = f"reports/{project.id}/{report.id}/v1/report_v1.{ext}"

        await storage.upload_file(content, storage_key)

        pdf_key = storage_key
        if ext.lower() in ['docx', 'doc']:
            background_tasks.add_task(convert_docx_to_pdf_task, storage_key)

        uploader_name = f"{current_user.first_name} {current_user.last_name}".strip()
        version_entry = ReportVersion(
            version_number=1,
            original_file_name=file.filename,
            original_mime_type=file.content_type,
            raw_file_key=storage_key,
            pdf_file_key=pdf_key,
            file_size=len(content),
            ai_analysis_status=AIAnalysisStatus.PENDING,
            workflow_status=WorkflowStatus.SUBMITTED,
            uploaded_by=current_user.id,
            uploaded_by_name=uploader_name
        )
        report.versions.append(version_entry)
        report.current_version = 1
        report.updated_at = datetime.now(timezone.utc)
        await report.save()

        # Log project activity
        log_project_activity(
            project,
            current_user,
            "RAPPORT_DEPOSE",
            f"Dépôt de la version initiale (v1) de « {report.title} »"
        )
        await project.save()

        # Trigger AI analysis in background
        background_tasks.add_task(run_ai_analysis, str(report.id), 1)

        # Notify team partner if binome
        if getattr(project, "co_student_id", None):
            partner_id = project.co_student_id if project.student_id == current_user.id else project.student_id
            await notify(
                user_id=partner_id,
                notification_type=NotificationType.REPORT_UPLOADED,
                title="Nouveau rapport déposé par votre binôme",
                message=f"{uploader_name} a déposé la version 1 de « {report.title} ».",
                link=f"/reports/{report.id}/v1"
            )

        # Notify all supervisors (Academic & Enterprise)
        supervisor_ids = set()
        if project.encadrer_id:
            supervisor_ids.add(project.encadrer_id)
        if getattr(project, "academic_encadrer_id", None):
            supervisor_ids.add(project.academic_encadrer_id)
        if getattr(project, "enterprise_encadrer_id", None):
            supervisor_ids.add(project.enterprise_encadrer_id)
        for sid in getattr(project, "encadrer_ids", []) or []:
            supervisor_ids.add(sid)

        for sid in supervisor_ids:
            await notify(
                user_id=sid,
                notification_type=NotificationType.REPORT_UPLOADED,
                title="Nouveau Rapport à Évaluer",
                message=f"{uploader_name} a ajouté le rapport « {report.title} » (version 1).",
                link=f"/reports/{report.id}/v1"
            )

    return _to_report_response(report)

# ── 3. Upload a new version to a specific report ───────────────
@router.post("/{report_id}/upload", response_model=ReportResponse, status_code=status.HTTP_202_ACCEPTED)
async def upload_version_to_report(
    report_id: PydanticObjectId,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    submission_notes: Optional[str] = Form(None),
    current_user: User = Depends(require_role([UserRole.STUDENT]))
):
    if file.content_type not in ALLOWED_MIME_TYPES and not file.filename.endswith(('.pdf', '.docx', '.doc')):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Format de fichier non supporté. Veuillez téléverser un document PDF ou DOCX."
        )

    project = await _get_user_project(current_user)
    report = await Report.get(report_id)
    if not report or report.project_id != project.id:
        raise HTTPException(status_code=404, detail="Rapport non trouvé dans ce projet.")

    storage = get_storage_service()
    content = await file.read()

    next_version = report.current_version + 1
    ext = file.filename.rsplit('.', 1)[-1]
    storage_key = f"reports/{project.id}/{report.id}/v{next_version}/report_v{next_version}.{ext}"

    await storage.upload_file(content, storage_key)

    pdf_key = storage_key
    if ext.lower() in ['docx', 'doc']:
        background_tasks.add_task(convert_docx_to_pdf_task, storage_key)

    uploader_name = f"{current_user.first_name} {current_user.last_name}".strip()
    version_entry = ReportVersion(
        version_number=next_version,
        original_file_name=file.filename,
        original_mime_type=file.content_type,
        raw_file_key=storage_key,
        pdf_file_key=pdf_key,
        file_size=len(content),
        ai_analysis_status=AIAnalysisStatus.PENDING,
        workflow_status=WorkflowStatus.SUBMITTED,
        uploaded_by=current_user.id,
        uploaded_by_name=uploader_name,
        submission_notes=submission_notes
    )

    report.versions.append(version_entry)
    report.current_version = next_version
    report.updated_at = datetime.now(timezone.utc)
    await report.save()

    # Log project activity
    log_project_activity(
        project,
        current_user,
        "NOUVELLE_VERSION",
        f"Nouvelle version v{next_version} de « {report.title} » déposée par {uploader_name}"
    )
    await project.save()

    # Trigger AI analysis
    background_tasks.add_task(run_ai_analysis, str(report.id), next_version)

    # Notify teammate if binôme
    if getattr(project, "co_student_id", None):
        partner_id = project.co_student_id if project.student_id == current_user.id else project.student_id
        await notify(
            user_id=partner_id,
            notification_type=NotificationType.REPORT_UPLOADED,
            title="Nouvelle version déposée par votre binôme",
            message=f"{uploader_name} a déposé la version {next_version} de « {report.title} ».",
            link=f"/reports/{report.id}/v{next_version}"
        )

    # Notify all supervisors (Academic & Enterprise)
    supervisor_ids = set()
    if project.encadrer_id:
        supervisor_ids.add(project.encadrer_id)
    if getattr(project, "academic_encadrer_id", None):
        supervisor_ids.add(project.academic_encadrer_id)
    if getattr(project, "enterprise_encadrer_id", None):
        supervisor_ids.add(project.enterprise_encadrer_id)
    for sid in getattr(project, "encadrer_ids", []) or []:
        supervisor_ids.add(sid)

    for sid in supervisor_ids:
        await notify(
            user_id=sid,
            notification_type=NotificationType.REPORT_UPLOADED,
            title="Nouvelle Version de Rapport à Réviser",
            message=f"{uploader_name} a déposé la version {next_version} de « {report.title} ».",
            link=f"/reports/{report.id}/v{next_version}"
        )

    return _to_report_response(report)

# ── 4. Backward-compatible global upload route ──────────────────
@router.post("/upload", response_model=ReportResponse, status_code=status.HTTP_202_ACCEPTED)
async def upload_report_version(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    submission_notes: Optional[str] = Form(None),
    current_user: User = Depends(require_role([UserRole.STUDENT]))
):
    project = await _get_user_project(current_user)

    report = await Report.find(Report.project_id == project.id).sort("-updated_at").first_or_none()
    if not report:
        report = Report(
            project_id=project.id,
            title="Rapport principal",
            report_type=ReportType.PFE,
            current_version=0,
            versions=[]
        )
        await report.insert()

    return await upload_version_to_report(report.id, background_tasks, file, submission_notes, current_user)

# ── 5. Backward-compatible history route ────────────────────────
@router.get("/history", response_model=ReportResponse)
async def get_report_history(
    report_id: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    project = await _get_user_project(current_user)

    if report_id:
        report = await Report.get(PydanticObjectId(report_id))
    else:
        report = await Report.find(Report.project_id == project.id).sort("-updated_at").first_or_none()

    if not report:
        raise HTTPException(status_code=404, detail="Aucun rapport déposé pour le moment.")

    return _to_report_response(report)

# ── 6. Get single report details ───────────────────────────────
@router.get("/{report_id}", response_model=ReportResponse)
async def get_report(
    report_id: PydanticObjectId,
    current_user: User = Depends(get_current_user)
):
    report = await Report.get(report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Rapport non trouvé.")

    project = await Project.get(report.project_id)
    is_student = project and (
        project.student_id == current_user.id
        or getattr(project, "co_student_id", None) == current_user.id
        or current_user.id in getattr(project, "student_ids", [])
    )
    is_supervisor = project and (
        project.encadrer_id == current_user.id
        or getattr(project, "academic_encadrer_id", None) == current_user.id
        or getattr(project, "enterprise_encadrer_id", None) == current_user.id
        or current_user.id in getattr(project, "encadrer_ids", [])
    )
    if not project or (not is_student and not is_supervisor and current_user.role != UserRole.ADMIN):
        raise HTTPException(status_code=403, detail="Accès non autorisé à ce rapport.")

    return _to_report_response(report)

# ── 7. Download report file version ────────────────────────────
@router.get("/download/{version_number}")
async def download_report_version(
    version_number: int,
    report_id: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user)
):
    project = await _get_user_project(current_user)

    if report_id:
        report = await Report.get(PydanticObjectId(report_id))
    else:
        report = await Report.find(Report.project_id == project.id).sort("-updated_at").first_or_none()

    if not report:
        raise HTTPException(status_code=404, detail="Rapport non trouvé.")

    target_version = next((v for v in report.versions if v.version_number == version_number), None)
    if not target_version:
        raise HTTPException(status_code=404, detail=f"Version {version_number} non trouvée.")

    storage = get_storage_service()
    file_bytes = await storage.get_file_bytes(target_version.raw_file_key)

    return Response(
        content=file_bytes,
        media_type=target_version.original_mime_type,
        headers={"Content-Disposition": f'attachment; filename="{target_version.original_file_name}"'}
    )

# ── 8. Delete report ───────────────────────────────────────────
@router.delete("/{report_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_report(
    report_id: PydanticObjectId,
    current_user: User = Depends(require_role([UserRole.STUDENT, UserRole.ADMIN]))
):
    report = await Report.get(report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Rapport non trouvé.")

    project = await Project.get(report.project_id)
    is_student = project and (
        project.student_id == current_user.id
        or getattr(project, "co_student_id", None) == current_user.id
    )
    if not project or (not is_student and current_user.role != UserRole.ADMIN):
        raise HTTPException(status_code=403, detail="Opération non autorisée.")

    await report.delete()
    return None
