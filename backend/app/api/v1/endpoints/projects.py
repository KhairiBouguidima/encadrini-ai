import secrets
import hashlib
from datetime import datetime, timedelta, timezone
from typing import List
from fastapi import APIRouter, HTTPException, status, Depends
from beanie import PydanticObjectId

from app.models.user import User, UserRole
from app.models.project import Project, Invitation, InvitationStatus, ProjectStatus
from app.schemas.project import ProjectCreate, ProjectResponse, InviteEncadrerRequest, InvitationResponse
from app.api.deps import get_current_user, require_role

router = APIRouter()

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
        description=project_in.description
    )
    await project.insert()
    
    return ProjectResponse(
        id=str(project.id),
        student_id=str(project.student_id),
        encadrer_id=str(project.encadrer_id) if project.encadrer_id else None,
        title=project.title,
        description=project.description,
        status=project.status,
        created_at=project.created_at
    )

@router.get("/me", response_model=ProjectResponse)
async def get_my_project(current_user: User = Depends(get_current_user)):
    if current_user.role == UserRole.STUDENT:
        project = await Project.find_one(Project.student_id == current_user.id)
    elif current_user.role == UserRole.ENCADRER:
        project = await Project.find_one(Project.encadrer_id == current_user.id)
    else:
        raise HTTPException(status_code=400, detail="Admin should use admin endpoint.")
        
    if not project:
        raise HTTPException(status_code=404, detail="Project not found.")
        
    return ProjectResponse(
        id=str(project.id),
        student_id=str(project.student_id),
        encadrer_id=str(project.encadrer_id) if project.encadrer_id else None,
        title=project.title,
        description=project.description,
        status=project.status,
        created_at=project.created_at
    )

@router.post("/invite", response_model=InvitationResponse)
async def invite_encadrer(
    invite_in: InviteEncadrerRequest,
    current_user: User = Depends(require_role([UserRole.STUDENT]))
):
    project = await Project.find_one(Project.student_id == current_user.id)
    if not project:
        raise HTTPException(status_code=404, detail="Create a project first before inviting a supervisor.")
        
    raw_token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    
    invitation = Invitation(
        project_id=project.id,
        student_id=current_user.id,
        encadrer_email=invite_in.encadrer_email,
        token_hash=token_hash,
        expires_at=expires_at
    )
    await invitation.insert()
    
    invitation_link = f"http://localhost:5173/invitations/accept?token={raw_token}"
    
    return InvitationResponse(
        id=str(invitation.id),
        project_id=str(invitation.project_id),
        student_id=str(invitation.student_id),
        encadrer_email=invitation.encadrer_email,
        status=invitation.status,
        invitation_link=invitation_link,
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
    await project.save()
    
    invitation.status = InvitationStatus.ACCEPTED
    await invitation.save()
    
    return ProjectResponse(
        id=str(project.id),
        student_id=str(project.student_id),
        encadrer_id=str(project.encadrer_id),
        title=project.title,
        description=project.description,
        status=project.status,
        created_at=project.created_at
    )
