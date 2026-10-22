from typing import List, Dict, Optional
from fastapi import APIRouter, HTTPException, status, Depends
from beanie import PydanticObjectId
from datetime import datetime

from app.models.user import User, UserRole
from app.models.project import Project, SupervisorRole
from app.models.report import Report
from app.models.annotation import Annotation
from app.schemas.annotation import AnnotationCreate, AnnotationUpdate, AnnotationResponse
from app.api.deps import get_current_user, require_role
from app.models.notification import NotificationType
from app.services.notification_service import notify

router = APIRouter()


def _to_response(a: Annotation, author_name: Optional[str] = None, author_role: Optional[str] = None) -> AnnotationResponse:
    return AnnotationResponse(
        id=str(a.id),
        report_id=str(a.report_id),
        version_number=a.version_number,
        page_number=a.page_number,
        author_id=str(a.author_id),
        author_name=author_name,
        author_role=author_role,
        content=a.content,
        selected_text=a.selected_text,
        x=a.x,
        y=a.y,
        width=a.width,
        height=a.height,
        created_at=a.created_at,
        updated_at=a.updated_at,
    )


@router.post("/reports/{report_id}", response_model=AnnotationResponse, status_code=status.HTTP_201_CREATED)
async def create_annotation(
    report_id: PydanticObjectId,
    annotation_in: AnnotationCreate,
    current_user: User = Depends(require_role([UserRole.ENCADRER]))
):
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
    if not project or not is_supervisor:
        raise HTTPException(status_code=403, detail="Non autorisé à annoter ce rapport.")

    if not any(v.version_number == annotation_in.version_number for v in report.versions):
        raise HTTPException(status_code=400, detail=f"Version {annotation_in.version_number} n'existe pas.")

    annotation = Annotation(
        report_id=report_id,
        version_number=annotation_in.version_number,
        page_number=annotation_in.page_number,
        author_id=current_user.id,
        content=annotation_in.content,
        selected_text=annotation_in.selected_text,
        x=annotation_in.x,
        y=annotation_in.y,
        width=annotation_in.width,
        height=annotation_in.height,
    )
    await annotation.insert()

    # Determine author role label
    is_academic = (getattr(project, "academic_encadrer_id", None) == current_user.id or project.encadrer_id == current_user.id)
    author_role = "Encadreur Académique" if is_academic else "Encadreur Entreprise"

    # Notify students (creator & binome)
    students_to_notify = [project.student_id]
    if getattr(project, "co_student_id", None):
        students_to_notify.append(project.co_student_id)

    for sid in students_to_notify:
        await notify(
            user_id=sid,
            notification_type=NotificationType.ANNOTATION_ADDED,
            title="Nouvelle Annotation",
            message=f"{current_user.first_name} {current_user.last_name} ({author_role}) a commenté la page {annotation.page_number}.",
            link=f"/reports/{report.id}/v{annotation.version_number}?page={annotation.page_number}"
        )

    full_name = f"{current_user.first_name} {current_user.last_name}".strip() or current_user.email
    return _to_response(annotation, author_name=full_name, author_role=author_role)


@router.get("/reports/{report_id}/version/{version_number}", response_model=List[AnnotationResponse])
async def get_version_annotations(
    report_id: PydanticObjectId,
    version_number: int,
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
        raise HTTPException(status_code=403, detail="Accès refusé aux annotations du rapport.")

    annotations = await Annotation.find(
        Annotation.report_id == report_id,
        Annotation.version_number == version_number
    ).sort(+Annotation.page_number, +Annotation.created_at).to_list()

    # Batch fetch authors
    author_ids = list({a.author_id for a in annotations})
    users = await User.find({"_id": {"$in": author_ids}}).to_list()
    user_map: Dict[str, User] = {str(u.id): u for u in users}

    result = []
    for a in annotations:
        u = user_map.get(str(a.author_id))
        author_name = f"{u.first_name} {u.last_name}".strip() if u else "Encadreur"
        is_academic = (
            getattr(project, "academic_encadrer_id", None) == a.author_id
            or project.encadrer_id == a.author_id
        )
        author_role = "Encadreur Académique" if is_academic else "Encadreur Entreprise"
        result.append(_to_response(a, author_name=author_name, author_role=author_role))

    return result


@router.patch("/{annotation_id}", response_model=AnnotationResponse)
async def update_annotation(
    annotation_id: PydanticObjectId,
    payload: AnnotationUpdate,
    current_user: User = Depends(require_role([UserRole.ENCADRER]))
):
    annotation = await Annotation.get(annotation_id)
    if not annotation:
        raise HTTPException(status_code=404, detail="Annotation non trouvée.")
    if annotation.author_id != current_user.id and current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Vous ne pouvez modifier que vos propres annotations.")
    annotation.content = payload.content
    annotation.updated_at = datetime.utcnow()
    await annotation.save()
    full_name = f"{current_user.first_name} {current_user.last_name}".strip() or current_user.email
    return _to_response(annotation, author_name=full_name, author_role="Encadreur")


@router.delete("/{annotation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_annotation(
    annotation_id: PydanticObjectId,
    current_user: User = Depends(require_role([UserRole.ENCADRER]))
):
    annotation = await Annotation.get(annotation_id)
    if not annotation:
        raise HTTPException(status_code=404, detail="Annotation non trouvée.")
    if annotation.author_id != current_user.id and current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Vous ne pouvez supprimer que vos propres annotations.")
    await annotation.delete()
