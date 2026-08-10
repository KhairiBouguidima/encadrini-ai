from fastapi import APIRouter, HTTPException, status, Depends, UploadFile, File, BackgroundTasks
from fastapi.responses import Response
from beanie import PydanticObjectId

from app.models.user import User, UserRole
from app.models.project import Project
from app.models.report import Report, ReportVersion, AIAnalysisStatus
from app.schemas.report import ReportResponse, ReportVersionResponse
from app.api.deps import get_current_user, require_role
from app.storage.storage_service import get_storage_service
from app.workers.conversion_worker import convert_docx_to_pdf_task
from app.workers.ai_analysis_worker import run_ai_analysis

router = APIRouter()

ALLOWED_MIME_TYPES = [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/msword"
]

@router.post("/upload", response_model=ReportResponse, status_code=status.HTTP_202_ACCEPTED)
async def upload_report_version(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    current_user: User = Depends(require_role([UserRole.STUDENT]))
):
    if file.content_type not in ALLOWED_MIME_TYPES and not file.filename.endswith(('.pdf', '.docx', '.doc')):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported file format. Please upload a PDF or DOCX document."
        )

    project = await Project.find_one(Project.student_id == current_user.id)
    if not project:
        raise HTTPException(status_code=404, detail="Create a PFE project before uploading reports.")

    storage = get_storage_service()
    content = await file.read()
    
    report = await Report.find_one(Report.project_id == project.id)
    if not report:
        report = Report(project_id=project.id, current_version=0, versions=[])
        await report.insert()

    next_version = report.current_version + 1
    ext = file.filename.rsplit('.', 1)[-1]
    storage_key = f"reports/{project.id}/v{next_version}/report_v{next_version}.{ext}"
    
    await storage.upload_file(content, storage_key)
    
    pdf_key = storage_key
    if ext.lower() in ['docx', 'doc']:
        background_tasks.add_task(convert_docx_to_pdf_task, storage_key)

    version_entry = ReportVersion(
        version_number=next_version,
        original_file_name=file.filename,
        original_mime_type=file.content_type,
        raw_file_key=storage_key,
        pdf_file_key=pdf_key,
        file_size=len(content),
        ai_analysis_status=AIAnalysisStatus.PENDING
    )

    report.versions.append(version_entry)
    report.current_version = next_version
    await report.save()

    # Trigger async AI analysis in background
    background_tasks.add_task(run_ai_analysis, str(report.id), next_version)

    return ReportResponse(
        id=str(report.id),
        project_id=str(report.project_id),
        current_version=report.current_version,
        versions=[
            ReportVersionResponse(
                version_number=v.version_number,
                original_file_name=v.original_file_name,
                original_mime_type=v.original_mime_type,
                file_size=v.file_size,
                uploaded_at=v.uploaded_at,
                ai_analysis_status=v.ai_analysis_status
            ) for v in report.versions
        ],
        created_at=report.created_at
    )

@router.get("/history", response_model=ReportResponse)
async def get_report_history(current_user: User = Depends(get_current_user)):
    if current_user.role == UserRole.STUDENT:
        project = await Project.find_one(Project.student_id == current_user.id)
    else:
        project = await Project.find_one(Project.encadrer_id == current_user.id)

    if not project:
        raise HTTPException(status_code=404, detail="No associated project found.")

    report = await Report.find_one(Report.project_id == project.id)
    if not report:
        raise HTTPException(status_code=404, detail="No reports uploaded yet.")

    return ReportResponse(
        id=str(report.id),
        project_id=str(report.project_id),
        current_version=report.current_version,
        versions=[
            ReportVersionResponse(
                version_number=v.version_number,
                original_file_name=v.original_file_name,
                original_mime_type=v.original_mime_type,
                file_size=v.file_size,
                uploaded_at=v.uploaded_at,
                ai_analysis_status=v.ai_analysis_status
            ) for v in report.versions
        ],
        created_at=report.created_at
    )

@router.get("/download/{version_number}")
async def download_report_version(
    version_number: int,
    current_user: User = Depends(get_current_user)
):
    if current_user.role == UserRole.STUDENT:
        project = await Project.find_one(Project.student_id == current_user.id)
    else:
        project = await Project.find_one(Project.encadrer_id == current_user.id)

    if not project:
        raise HTTPException(status_code=404, detail="No associated project found.")

    report = await Report.find_one(Report.project_id == project.id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found.")

    target_version = next((v for v in report.versions if v.version_number == version_number), None)
    if not target_version:
        raise HTTPException(status_code=404, detail=f"Version {version_number} not found.")

    storage = get_storage_service()
    file_bytes = await storage.get_file_bytes(target_version.raw_file_key)

    return Response(
        content=file_bytes,
        media_type=target_version.original_mime_type,
        headers={"Content-Disposition": f'attachment; filename="{target_version.original_file_name}"'}
    )
