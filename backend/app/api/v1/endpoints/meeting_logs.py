from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, HTTPException, status, Depends, Query
from beanie import PydanticObjectId

from app.models.user import User, UserRole
from app.models.project import Project, SupervisorRole
from app.models.meeting_log import MeetingLog, MeetingLogStatus
from app.models.notification import NotificationType
from app.schemas.meeting_log import (
    MeetingLogCreate, MeetingLogUpdate, MeetingLogReview, MeetingLogResponse
)
from app.api.deps import get_current_user
from app.services.notification_service import notify
from app.api.v1.endpoints.projects import log_project_activity

router = APIRouter()


def _is_project_student(project: Project, user: User) -> bool:
    if user.id == project.student_id or user.id == project.co_student_id:
        return True
    if user.id in getattr(project, "student_ids", []):
        return True
    return False


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


def _get_supervisor_role(project: Project, user: User) -> SupervisorRole:
    if user.id == getattr(project, "enterprise_encadrer_id", None):
        return SupervisorRole.ENTERPRISE
    return SupervisorRole.ACADEMIC


async def _check_project_access(project_id: PydanticObjectId, current_user: User) -> Project:
    project = await Project.get(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Projet non trouvé.")

    if current_user.role == UserRole.ADMIN:
        return project

    is_student = _is_project_student(project, current_user)
    is_sup = _is_project_supervisor(project, current_user)

    if not is_student and not is_sup:
        raise HTTPException(
            status_code=403,
            detail="Accès refusé. Vous devez être membre ou encadreur de ce projet."
        )
    return project


def _to_response(log: MeetingLog) -> MeetingLogResponse:
    return MeetingLogResponse(
        id=str(log.id),
        project_id=str(log.project_id),
        meeting_date=log.meeting_date,
        work_completed=log.work_completed,
        encountered_blockers=log.encountered_blockers,
        supervisor_feedback=log.supervisor_feedback or "",
        next_week_objectives=log.next_week_objectives,
        author_id=str(log.author_id),
        author_name=log.author_name,
        author_role=log.author_role,
        status=log.status,
        reviewed_by_id=str(log.reviewed_by_id) if log.reviewed_by_id else None,
        reviewed_by_name=log.reviewed_by_name,
        reviewed_by_role=log.reviewed_by_role,
        reviewed_at=log.reviewed_at,
        review_feedback=log.review_feedback,
        created_at=log.created_at,
        updated_at=log.updated_at,
    )


@router.post("/projects/{project_id}/meeting-logs", response_model=MeetingLogResponse, status_code=status.HTTP_201_CREATED)
async def create_meeting_log(
    project_id: PydanticObjectId,
    payload: MeetingLogCreate,
    current_user: User = Depends(get_current_user),
):
    """
    Allow students (primary or binôme) to create a meeting log report.
    Can be created as DRAFT or SUBMITTED.
    """
    project = await _check_project_access(project_id, current_user)

    if current_user.role != UserRole.ADMIN and not _is_project_student(project, current_user):
        raise HTTPException(
            status_code=403,
            detail="Seuls les étudiants affectés à ce projet (ou binôme) peuvent créer un compte-rendu de réunion."
        )

    author_name = f"{current_user.first_name} {current_user.last_name}".strip()
    log = MeetingLog(
        project_id=project.id,
        meeting_date=payload.meeting_date,
        work_completed=payload.work_completed,
        encountered_blockers=payload.encountered_blockers,
        supervisor_feedback=payload.supervisor_feedback or "",
        next_week_objectives=payload.next_week_objectives,
        author_id=current_user.id,
        author_name=author_name,
        author_role="STUDENT",
        status=payload.status,
    )
    await log.insert()

    # If submitted directly, notify supervisors and log activity
    if log.status == MeetingLogStatus.SUBMITTED:
        await _notify_supervisors_on_submission(project, log, author_name)
        log_project_activity(
            project,
            current_user,
            "MEETING_LOG_SUBMITTED",
            f"Compte-rendu de réunion du {log.meeting_date.strftime('%d/%m/%Y')} soumis par {author_name}."
        )
        await project.save()

    return _to_response(log)


@router.get("/projects/{project_id}/meeting-logs", response_model=List[MeetingLogResponse])
async def list_meeting_logs(
    project_id: PydanticObjectId,
    status_filter: Optional[MeetingLogStatus] = None,
    current_user: User = Depends(get_current_user),
):
    """
    List all meeting logs for a project chronologically.
    Maintains a read-only historical timeline for approved logs and ongoing draft/review logs.
    """
    project = await _check_project_access(project_id, current_user)

    query = [MeetingLog.project_id == project.id]
    if status_filter and isinstance(status_filter, (MeetingLogStatus, str)):
        query.append(MeetingLog.status == status_filter)

    # Sort chronologically by meeting date descending
    logs = await MeetingLog.find(*query).sort("-meeting_date").to_list()
    return [_to_response(l) for l in logs]


@router.get("/projects/{project_id}/meeting-logs/{log_id}", response_model=MeetingLogResponse)
async def get_meeting_log(
    project_id: PydanticObjectId,
    log_id: PydanticObjectId,
    current_user: User = Depends(get_current_user),
):
    await _check_project_access(project_id, current_user)
    log = await MeetingLog.get(log_id)
    if not log or log.project_id != project_id:
        raise HTTPException(status_code=404, detail="Compte-rendu de réunion non trouvé.")
    return _to_response(log)


@router.put("/projects/{project_id}/meeting-logs/{log_id}", response_model=MeetingLogResponse)
async def update_meeting_log(
    project_id: PydanticObjectId,
    log_id: PydanticObjectId,
    payload: MeetingLogUpdate,
    current_user: User = Depends(get_current_user),
):
    """
    Update a meeting log report.
    CRITICAL: Modifications to APPROVED records are strictly forbidden to ensure audit trail integrity.
    """
    project = await _check_project_access(project_id, current_user)
    log = await MeetingLog.get(log_id)
    if not log or log.project_id != project_id:
        raise HTTPException(status_code=404, detail="Compte-rendu de réunion non trouvé.")

    # Check immutability of approved records
    if log.status == MeetingLogStatus.APPROVED:
        raise HTTPException(
            status_code=400,
            detail="Ce compte-rendu a été validé et approuvé. Il est archivé en lecture seule et ne peut plus être modifié."
        )

    # Permission check: must be student in project
    if current_user.role != UserRole.ADMIN and not _is_project_student(project, current_user):
        raise HTTPException(status_code=403, detail="Non autorisé à modifier ce compte-rendu.")

    if payload.meeting_date is not None:
        log.meeting_date = payload.meeting_date
    if payload.work_completed is not None:
        log.work_completed = payload.work_completed
    if payload.encountered_blockers is not None:
        log.encountered_blockers = payload.encountered_blockers
    if payload.supervisor_feedback is not None:
        log.supervisor_feedback = payload.supervisor_feedback
    if payload.next_week_objectives is not None:
        log.next_week_objectives = payload.next_week_objectives

    was_draft_or_changes = log.status in (MeetingLogStatus.DRAFT, MeetingLogStatus.CHANGES_REQUESTED)
    if payload.status is not None:
        log.status = payload.status

    log.updated_at = datetime.now(timezone.utc)
    await log.save()

    # If transitioned to SUBMITTED
    if log.status == MeetingLogStatus.SUBMITTED and was_draft_or_changes:
        user_name = f"{current_user.first_name} {current_user.last_name}".strip()
        await _notify_supervisors_on_submission(project, log, user_name)
        log_project_activity(
            project,
            current_user,
            "MEETING_LOG_RESUBMITTED",
            f"Compte-rendu du {log.meeting_date.strftime('%d/%m/%Y')} soumis pour révision."
        )
        await project.save()

    return _to_response(log)


@router.post("/projects/{project_id}/meeting-logs/{log_id}/submit", response_model=MeetingLogResponse)
async def submit_meeting_log(
    project_id: PydanticObjectId,
    log_id: PydanticObjectId,
    current_user: User = Depends(get_current_user),
):
    """
    Submit a draft or corrected meeting log for supervisor review.
    """
    project = await _check_project_access(project_id, current_user)
    log = await MeetingLog.get(log_id)
    if not log or log.project_id != project_id:
        raise HTTPException(status_code=404, detail="Compte-rendu non trouvé.")

    if log.status == MeetingLogStatus.APPROVED:
        raise HTTPException(status_code=400, detail="Ce compte-rendu est déjà approuvé.")

    if current_user.role != UserRole.ADMIN and not _is_project_student(project, current_user):
        raise HTTPException(status_code=403, detail="Seul un étudiant du projet peut soumettre le compte-rendu.")

    log.status = MeetingLogStatus.SUBMITTED
    log.updated_at = datetime.now(timezone.utc)
    await log.save()

    user_name = f"{current_user.first_name} {current_user.last_name}".strip()
    await _notify_supervisors_on_submission(project, log, user_name)
    log_project_activity(
        project,
        current_user,
        "MEETING_LOG_SUBMITTED",
        f"Compte-rendu du {log.meeting_date.strftime('%d/%m/%Y')} soumis pour révision par {user_name}."
    )
    await project.save()

    return _to_response(log)


@router.post("/projects/{project_id}/meeting-logs/{log_id}/review", response_model=MeetingLogResponse)
async def review_meeting_log(
    project_id: PydanticObjectId,
    log_id: PydanticObjectId,
    payload: MeetingLogReview,
    current_user: User = Depends(get_current_user),
):
    """
    One-click review for academic and company supervisors:
    - action = "APPROVE" -> Approves the report, locks it into immutable history.
    - action = "REQUEST_CHANGES" -> Requests corrections from students.
    """
    project = await _check_project_access(project_id, current_user)
    log = await MeetingLog.get(log_id)
    if not log or log.project_id != project_id:
        raise HTTPException(status_code=404, detail="Compte-rendu non trouvé.")

    # Permissions: must be supervisor or admin
    if current_user.role != UserRole.ADMIN and not _is_project_supervisor(project, current_user):
        raise HTTPException(
            status_code=403,
            detail="Seuls les encadreurs académiques ou professionnels assignés peuvent valider ce compte-rendu."
        )

    # Immutability check
    if log.status == MeetingLogStatus.APPROVED:
        raise HTTPException(status_code=400, detail="Ce compte-rendu est déjà approuvé et verrouillé.")

    action = payload.action.upper().strip()
    sup_name = f"{current_user.first_name} {current_user.last_name}".strip()
    sup_role = _get_supervisor_role(project, current_user)

    log.reviewed_by_id = current_user.id
    log.reviewed_by_name = sup_name
    log.reviewed_by_role = sup_role
    log.reviewed_at = datetime.now(timezone.utc)
    log.review_feedback = payload.feedback or ""
    log.updated_at = datetime.now(timezone.utc)

    students_to_notify = [project.student_id]
    if project.co_student_id:
        students_to_notify.append(project.co_student_id)
    for sid in getattr(project, "student_ids", []):
        if sid not in students_to_notify:
            students_to_notify.append(sid)

    date_str = log.meeting_date.strftime("%d/%m/%Y")

    if action == "APPROVE":
        log.status = MeetingLogStatus.APPROVED
        await log.save()

        # Notify students
        for sid in students_to_notify:
            await notify(
                user_id=sid,
                notification_type=NotificationType.MEETING_LOG_APPROVED,
                title="Compte-rendu de réunion validé",
                message=f"Votre encadreur {sup_name} a approuvé le compte-rendu du {date_str}.",
                link=f"/projects/{project.id}?tab=meetings",
            )

        log_project_activity(
            project,
            current_user,
            "MEETING_LOG_APPROVED",
            f"Compte-rendu du {date_str} approuvé par {sup_name} ({sup_role.value})."
        )
        await project.save()

    elif action in ("REQUEST_CHANGES", "CHANGES_REQUESTED"):
        log.status = MeetingLogStatus.CHANGES_REQUESTED
        await log.save()

        # Notify students
        fb_snippet = f" : « {payload.feedback[:60]}... »" if payload.feedback else "."
        for sid in students_to_notify:
            await notify(
                user_id=sid,
                notification_type=NotificationType.MEETING_LOG_CHANGES_REQUESTED,
                title="Corrections demandées sur le compte-rendu",
                message=f"L'encadreur {sup_name} a demandé des modifications sur le compte-rendu du {date_str}{fb_snippet}",
                link=f"/projects/{project.id}?tab=meetings",
            )

        log_project_activity(
            project,
            current_user,
            "MEETING_LOG_CHANGES_REQUESTED",
            f"Corrections requises sur le compte-rendu du {date_str} par {sup_name}."
        )
        await project.save()

    else:
        raise HTTPException(
            status_code=400,
            detail="Action de révision invalide. Utilisez 'APPROVE' ou 'REQUEST_CHANGES'."
        )

    return _to_response(log)


@router.delete("/projects/{project_id}/meeting-logs/{log_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_meeting_log(
    project_id: PydanticObjectId,
    log_id: PydanticObjectId,
    current_user: User = Depends(get_current_user),
):
    project = await _check_project_access(project_id, current_user)
    log = await MeetingLog.get(log_id)
    if not log or log.project_id != project_id:
        raise HTTPException(status_code=404, detail="Compte-rendu non trouvé.")

    # Only DRAFT can be deleted
    if log.status == MeetingLogStatus.APPROVED:
        raise HTTPException(status_code=400, detail="Impossible de supprimer un compte-rendu validé et approuvé.")

    if current_user.role != UserRole.ADMIN and log.author_id != current_user.id:
        raise HTTPException(status_code=403, detail="Seul l'auteur peut supprimer ce brouillon de compte-rendu.")

    await log.delete()


async def _notify_supervisors_on_submission(project: Project, log: MeetingLog, author_name: str):
    """Notify all project supervisors when a meeting log is submitted."""
    supervisor_ids = set()
    if project.encadrer_id:
        supervisor_ids.add(project.encadrer_id)
    if getattr(project, "academic_encadrer_id", None):
        supervisor_ids.add(project.academic_encadrer_id)
    if getattr(project, "enterprise_encadrer_id", None):
        supervisor_ids.add(project.enterprise_encadrer_id)
    for eid in getattr(project, "encadrer_ids", []):
        supervisor_ids.add(eid)

    date_str = log.meeting_date.strftime("%d/%m/%Y")
    for sup_id in supervisor_ids:
        await notify(
            user_id=sup_id,
            notification_type=NotificationType.MEETING_LOG_SUBMITTED,
            title="Nouveau compte-rendu de réunion soumis",
            message=f"{author_name} a soumis un compte-rendu de réunion pour le {date_str} en attente de validation.",
            link=f"/projects/{project.id}?tab=meetings",
        )
