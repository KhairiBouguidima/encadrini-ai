from typing import List
from fastapi import APIRouter, HTTPException, status, Depends
from beanie import PydanticObjectId

from app.models.user import User, UserRole
from app.models.project import Project
from app.models.report import Report
from app.models.annotation import Annotation
from app.schemas.annotation import AnnotationCreate, AnnotationResponse
from app.api.deps import get_current_user, require_role

router = APIRouter()

@router.post("/reports/{report_id}", response_model=AnnotationResponse, status_code=status.HTTP_201_CREATED)
async def create_annotation(
    report_id: PydanticObjectId,
    annotation_in: AnnotationCreate,
    current_user: User = Depends(require_role([UserRole.ENCADRER]))
):
    report = await Report.get(report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found.")

    project = await Project.get(report.project_id)
    if not project or project.encadrer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to annotate this report.")

    if not any(v.version_number == annotation_in.version_number for v in report.versions):
        raise HTTPException(status_code=400, detail=f"Version {annotation_in.version_number} does not exist.")

    annotation = Annotation(
        report_id=report_id,
        version_number=annotation_in.version_number,
        page_number=annotation_in.page_number,
        author_id=current_user.id,
        content=annotation_in.content
    )
    await annotation.insert()

    return AnnotationResponse(
        id=str(annotation.id),
        report_id=str(annotation.report_id),
        version_number=annotation.version_number,
        page_number=annotation.page_number,
        author_id=str(annotation.author_id),
        content=annotation.content,
        created_at=annotation.created_at
    )

@router.get("/reports/{report_id}/version/{version_number}", response_model=List[AnnotationResponse])
async def get_version_annotations(
    report_id: PydanticObjectId,
    version_number: int,
    current_user: User = Depends(get_current_user)
):
    report = await Report.get(report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found.")

    project = await Project.get(report.project_id)
    if not project or (project.student_id != current_user.id and project.encadrer_id != current_user.id and current_user.role != UserRole.ADMIN):
        raise HTTPException(status_code=403, detail="Access denied to report annotations.")

    annotations = await Annotation.find(
        Annotation.report_id == report_id,
        Annotation.version_number == version_number
    ).sort(+Annotation.page_number, +Annotation.created_at).to_list()

    return [
        AnnotationResponse(
            id=str(a.id),
            report_id=str(a.report_id),
            version_number=a.version_number,
            page_number=a.page_number,
            author_id=str(a.author_id),
            content=a.content,
            created_at=a.created_at
        ) for a in annotations
    ]
