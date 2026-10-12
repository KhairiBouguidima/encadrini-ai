import secrets
import hashlib
from datetime import datetime, timedelta, timezone
from typing import List, Optional
from fastapi import APIRouter, HTTPException, status, Depends
from beanie import PydanticObjectId

from app.models.user import User, UserRole
from app.models.project import Project, Invitation, InvitationStatus, ProjectStatus
from app.schemas.project import (
    ProjectCreate, ProjectUpdate, ProjectResponse, 
    InviteEncadrerRequest, InvitationResponse, InvitationPreviewResponse
)
from app.api.deps import get_current_user, require_role
from app.models.notification import NotificationType
from app.services.notification_service import notify
from app.core.email import send_supervisor_invitation_email, build_invitation_link

router = APIRouter()

async def _to_project_response(project: Project) -> ProjectResponse:
    student_name = None
    student_email = None
    encadrer_name = None
    encadrer_email = None

    if project.student_id:
        student = await User.get(project.student_id)
        if student:
            student_name = f"{student.first_name} {student.last_name}"
            student_email = student.email

    if project.encadrer_id:
        encadrer = await User.get(project.encadrer_id)
        if encadrer:
            encadrer_name = f"{encadrer.first_name} {encadrer.last_name}"
            encadrer_email = encadrer.email

    return ProjectResponse(
        id=str(project.id),
        student_id=str(project.student_id),
        encadrer_id=str(project.encadrer_id) if project.encadrer_id else None,
        encadrer_ids=[str(e) for e in getattr(project, "encadrer_ids", [])],
        encadrer_name=encadrer_name,
        encadrer_email=encadrer_email,
        student_name=student_name,
        student_email=student_email,
        title=project.title,
        description=project.description,
        status=project.status,
        progress=getattr(project, "progress", 0),
        deadline=getattr(project, "deadline", None),
        tags=getattr(project, "tags", []),
        academic_year=getattr(project, "academic_year", "2025-2026"),
        created_at=project.created_at,
        updated_at=getattr(project, "updated_at", None),
    )

@router.post("/", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_project(
    project_in: ProjectCreate,
    current_user: User = Depends(require_role([UserRole.STUDENT]))
):
    existing = await Project.find_one(Project.student_id == current_user.id)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Student already has an active PFE project."
        )
    
    project = Project(
        student_id=current_user.id,
        title=project_in.title,
        description=project_in.description,
        deadline=project_in.deadline,
        tags=project_in.tags or [],
        academic_year=project_in.academic_year or "2025-2026",
    )
    await project.insert()
    
    return await _to_project_response(project)

@router.get("/me", response_model=ProjectResponse)
async def get_my_project(current_user: User = Depends(get_current_user)):
    if current_user.role == UserRole.STUDENT:
        project = await Project.find_one(Project.student_id == current_user.id)
    elif current_user.role == UserRole.ENCADRER:
        project = await Project.find_one(Project.encadrer_id == current_user.id)
        if not project:
            project = await Project.find_one({"encadrer_ids": current_user.id})
    else:
        raise HTTPException(status_code=400, detail="Admin should use admin endpoint.")
        
    if not project:
        raise HTTPException(status_code=404, detail="Project not found.")
        
    return await _to_project_response(project)

@router.patch("/me", response_model=ProjectResponse)
async def update_my_project(
    update_data: ProjectUpdate,
    current_user: User = Depends(get_current_user)
):
    if current_user.role == UserRole.STUDENT:
        project = await Project.find_one(Project.student_id == current_user.id)
    elif current_user.role == UserRole.ENCADRER:
        project = await Project.find_one(Project.encadrer_id == current_user.id)
        if not project:
            project = await Project.find_one({"encadrer_ids": current_user.id})
    else:
        raise HTTPException(status_code=403, detail="Not authorized.")

    if not project:
        raise HTTPException(status_code=404, detail="Project not found.")

    update_dict = update_data.model_dump(exclude_unset=True)
    for field, value in update_dict.items():
        setattr(project, field, value)
    
    project.updated_at = datetime.now(timezone.utc)
    await project.save()

    return await _to_project_response(project)

@router.post("/invite", response_model=InvitationResponse)
async def invite_encadrer(
    invite_in: InviteEncadrerRequest,
    current_user: User = Depends(require_role([UserRole.STUDENT]))
):
    project = await Project.find_one(Project.student_id == current_user.id)
    if not project:
        project = Project(
            student_id=current_user.id,
            title=f"Projet PFE - {current_user.first_name} {current_user.last_name}",
            description="Projet de fin d'études académique"
        )
        await project.insert()
        
    normalized_email = invite_in.encadrer_email.strip().lower()
    
    # Check if supervisor with this email already exists
    existing_encadrer = await User.find_one(
        User.email == normalized_email,
        User.role == UserRole.ENCADRER
    )

    raw_token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    
    inv_status = InvitationStatus.PENDING

    if existing_encadrer:
        project.encadrer_id = existing_encadrer.id
        if not hasattr(project, "encadrer_ids") or project.encadrer_ids is None:
            project.encadrer_ids = []
        if existing_encadrer.id not in project.encadrer_ids:
            project.encadrer_ids.append(existing_encadrer.id)
        project.updated_at = datetime.now(timezone.utc)
        await project.save()
        inv_status = InvitationStatus.ACCEPTED

    invitation = Invitation(
        project_id=project.id,
        student_id=current_user.id,
        encadrer_email=normalized_email,
        token_hash=token_hash,
        status=inv_status,
        expires_at=expires_at
    )
    await invitation.insert()
    
    student_name = f"{current_user.first_name} {current_user.last_name}"

    if existing_encadrer:
        encadrer_name = f"{existing_encadrer.first_name} {existing_encadrer.last_name}"
        # Notify the supervisor
        await notify(
            user_id=existing_encadrer.id,
            notification_type=NotificationType.INVITATION_ACCEPTED,
            title="Nouveau projet à encadrer",
            message=f"{student_name} vous a désigné comme encadreur pour son projet : « {project.title} ».",
            link="/supervisor/reviewer"
        )
        # Notify the student
        await notify(
            user_id=current_user.id,
            notification_type=NotificationType.INVITATION_ACCEPTED,
            title="Encadreur connecté avec succès",
            message=f"Votre projet a été connecté avec succès à l'encadreur {encadrer_name} ({normalized_email}).",
            link="/projects/me"
        )

    email_sent = send_supervisor_invitation_email(
        normalized_email,
        student_name,
        project.title,
        raw_token,
    )

    invitation_link = build_invitation_link(raw_token)
    
    return InvitationResponse(
        id=str(invitation.id),
        project_id=str(invitation.project_id),
        student_id=str(invitation.student_id),
        encadrer_email=invitation.encadrer_email,
        status=invitation.status,
        invitation_link=invitation_link,
        email_sent=email_sent,
        expires_at=invitation.expires_at
    )

@router.get("/invitations/preview", response_model=InvitationPreviewResponse)
async def preview_invitation(token: str):
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    invitation = await Invitation.find_one(Invitation.token_hash == token_hash)
    if not invitation:
        raise HTTPException(status_code=404, detail="Invitation not found.")
    
    if invitation.expires_at < datetime.now(timezone.utc):
        invitation.status = InvitationStatus.EXPIRED
        await invitation.save()
        raise HTTPException(status_code=400, detail="Invitation has expired.")
        
    student = await User.get(invitation.student_id)
    project = await Project.get(invitation.project_id)
    
    if not student or not project:
        raise HTTPException(status_code=404, detail="Project or student no longer exists.")
        
    student_name = f"{student.first_name} {student.last_name}"
    
    return InvitationPreviewResponse(
        token=token,
        project_id=str(project.id),
        student_id=str(student.id),
        student_name=student_name,
        project_title=project.title,
        project_description=project.description,
        encadrer_email=invitation.encadrer_email,
        status=invitation.status,
        expires_at=invitation.expires_at
    )

@router.post("/invitations/accept", response_model=ProjectResponse)
async def accept_invitation(
    token: str,
    current_user: User = Depends(require_role([UserRole.ENCADRER]))
):
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    invitation = await Invitation.find_one(Invitation.token_hash == token_hash)
    
    if not invitation or invitation.status != InvitationStatus.PENDING:
        raise HTTPException(status_code=400, detail="Invalid or expired invitation token.")
        
    if invitation.expires_at < datetime.now(timezone.utc):
        invitation.status = InvitationStatus.EXPIRED
        await invitation.save()
        raise HTTPException(status_code=400, detail="Invitation has expired.")
        
    project = await Project.get(invitation.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Associated project no longer exists.")
        
    project.encadrer_id = current_user.id
    if not hasattr(project, "encadrer_ids") or project.encadrer_ids is None:
        project.encadrer_ids = []
    if current_user.id not in project.encadrer_ids:
        project.encadrer_ids.append(current_user.id)
    project.updated_at = datetime.now(timezone.utc)
    await project.save()
    
    invitation.status = InvitationStatus.ACCEPTED
    await invitation.save()
    
    # Notify the student
    await notify(
        user_id=project.student_id,
        notification_type=NotificationType.INVITATION_ACCEPTED,
        title="Supervisor Accepted",
        message=f"{current_user.first_name} {current_user.last_name} a accepté d'encadrer votre projet.",
        link=f"/projects/me"
    )
    
    return await _to_project_response(project)

