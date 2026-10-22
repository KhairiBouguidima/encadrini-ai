import secrets
import hashlib
from datetime import datetime, timedelta, timezone
from typing import List, Optional
from fastapi import APIRouter, HTTPException, status, Depends, Query
from beanie import PydanticObjectId

from app.models.user import User, UserRole
from app.models.project import (
    Project, Invitation, InvitationStatus, ProjectStatus,
    SupervisorRole, InvitationType, ProjectTask, ProjectActivity, TaskStatus
)
from app.schemas.project import (
    ProjectCreate, ProjectUpdate, ProjectResponse, EncadrerInfo, StudentInfo,
    InviteEncadrerRequest, InviteBinomeRequest, InvitationResponse,
    InvitationPreviewResponse, InvitationItemResponse,
    TaskCreate, TaskUpdate, TaskResponse, ActivityResponse
)
from app.api.deps import get_current_user, require_role
from app.models.notification import NotificationType
from app.services.notification_service import notify
from app.core.email import send_supervisor_invitation_email, build_invitation_link

router = APIRouter()

def log_project_activity(
    project: Project,
    user: Optional[User],
    action: str,
    details: str
):
    activity = ProjectActivity(
        user_id=user.id if user else None,
        user_name=f"{user.first_name} {user.last_name}" if user else "Système",
        user_role=user.role.value if user else "SYSTEM",
        action=action,
        details=details,
        created_at=datetime.now(timezone.utc)
    )
    if not hasattr(project, "activities") or project.activities is None:
        project.activities = []
    project.activities.append(activity)


async def _to_project_response(project: Project) -> ProjectResponse:
    # 1. Resolve Students (Creator + Co-Student)
    students: List[StudentInfo] = []
    student_name = None
    student_email = None
    co_student_name = None
    co_student_email = None
    co_student_faculty = None

    if project.student_id:
        st1 = await User.get(project.student_id)
        if st1:
            student_name = f"{st1.first_name} {st1.last_name}".strip()
            student_email = st1.email
            students.append(
                StudentInfo(
                    id=str(st1.id),
                    name=student_name,
                    email=st1.email,
                    faculty=getattr(st1, "faculty", "") or "",
                    is_owner=True
                )
            )

    if getattr(project, "co_student_id", None):
        st2 = await User.get(project.co_student_id)
        if st2:
            co_student_name = f"{st2.first_name} {st2.last_name}".strip()
            co_student_email = st2.email
            co_student_faculty = getattr(st2, "faculty", "") or ""
            students.append(
                StudentInfo(
                    id=str(st2.id),
                    name=co_student_name,
                    email=st2.email,
                    faculty=co_student_faculty,
                    is_owner=False
                )
            )

    # 2. Resolve Supervisors (Academic & Enterprise)
    academic_info: Optional[EncadrerInfo] = None
    enterprise_info: Optional[EncadrerInfo] = None

    if getattr(project, "academic_encadrer_id", None):
        ac = await User.get(project.academic_encadrer_id)
        if ac:
            academic_info = EncadrerInfo(
                id=str(ac.id),
                name=f"{ac.first_name} {ac.last_name}".strip(),
                email=ac.email,
                faculty=getattr(ac, "faculty", "") or "",
                role=SupervisorRole.ACADEMIC
            )

    if getattr(project, "enterprise_encadrer_id", None):
        en = await User.get(project.enterprise_encadrer_id)
        if en:
            enterprise_info = EncadrerInfo(
                id=str(en.id),
                name=f"{en.first_name} {en.last_name}".strip(),
                email=en.email,
                faculty=getattr(en, "faculty", "") or "",
                role=SupervisorRole.ENTERPRISE
            )

    raw_encadrer_ids = list(getattr(project, "encadrer_ids", []) or [])
    if project.encadrer_id and project.encadrer_id not in raw_encadrer_ids:
        raw_encadrer_ids.insert(0, project.encadrer_id)
    if project.academic_encadrer_id and project.academic_encadrer_id not in raw_encadrer_ids:
        raw_encadrer_ids.append(project.academic_encadrer_id)
    if project.enterprise_encadrer_id and project.enterprise_encadrer_id not in raw_encadrer_ids:
        raw_encadrer_ids.append(project.enterprise_encadrer_id)

    encadrers: List[EncadrerInfo] = []
    for eid in raw_encadrer_ids:
        enc = await User.get(eid)
        if enc:
            s_role = SupervisorRole.ENTERPRISE if project.enterprise_encadrer_id == enc.id else SupervisorRole.ACADEMIC
            encadrers.append(
                EncadrerInfo(
                    id=str(enc.id),
                    name=f"{enc.first_name} {enc.last_name}".strip(),
                    email=enc.email,
                    faculty=getattr(enc, "faculty", "") or "",
                    role=s_role
                )
            )

    primary_name = academic_info.name if academic_info else (encadrers[0].name if encadrers else None)
    primary_email = academic_info.email if academic_info else (encadrers[0].email if encadrers else None)
    primary_id = (
        str(project.academic_encadrer_id) if project.academic_encadrer_id
        else (str(project.encadrer_id) if project.encadrer_id else (encadrers[0].id if encadrers else None))
    )

    # 3. Tasks & Activities
    tasks_res: List[TaskResponse] = []
    for t in getattr(project, "tasks", []) or []:
        tasks_res.append(
            TaskResponse(
                id=t.id,
                title=t.title,
                description=t.description,
                assigned_to=str(t.assigned_to) if t.assigned_to else None,
                assigned_name=t.assigned_name,
                status=t.status.value if hasattr(t.status, "value") else str(t.status),
                due_date=t.due_date,
                created_at=t.created_at,
                completed_at=t.completed_at
            )
        )

    activities_res: List[ActivityResponse] = []
    for act in sorted(getattr(project, "activities", []) or [], key=lambda a: a.created_at, reverse=True):
        activities_res.append(
            ActivityResponse(
                id=act.id,
                user_id=str(act.user_id) if act.user_id else None,
                user_name=act.user_name,
                user_role=act.user_role,
                action=act.action,
                details=act.details,
                created_at=act.created_at
            )
        )

    student_id_list = [str(project.student_id)]
    if getattr(project, "co_student_id", None):
        student_id_list.append(str(project.co_student_id))

    return ProjectResponse(
        id=str(project.id),
        student_id=str(project.student_id),
        co_student_id=str(project.co_student_id) if project.co_student_id else None,
        student_ids=student_id_list,
        students=students,
        student_name=student_name,
        student_email=student_email,
        co_student_name=co_student_name,
        co_student_email=co_student_email,
        co_student_faculty=co_student_faculty,
        is_binome=bool(project.co_student_id),
        encadrer_id=primary_id,
        encadrer_ids=[str(e) for e in raw_encadrer_ids],
        encadrers=encadrers,
        academic_encadrer_id=str(project.academic_encadrer_id) if project.academic_encadrer_id else None,
        academic_encadrer=academic_info,
        enterprise_encadrer_id=str(project.enterprise_encadrer_id) if project.enterprise_encadrer_id else None,
        enterprise_encadrer=enterprise_info,
        encadrer_name=primary_name,
        encadrer_email=primary_email,
        title=project.title,
        description=project.description,
        status=project.status,
        progress=getattr(project, "progress", 0),
        deadline=getattr(project, "deadline", None),
        tags=getattr(project, "tags", []),
        academic_year=getattr(project, "academic_year", "2025-2026"),
        tasks=tasks_res,
        activities=activities_res,
        created_at=project.created_at,
        updated_at=getattr(project, "updated_at", None),
    )


# ── Create Project ─────────────────────────────────────────────
@router.post("/", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_project(
    project_in: ProjectCreate,
    current_user: User = Depends(require_role([UserRole.STUDENT]))
):
    existing = await Project.find_one({
        "$or": [
            {"student_id": current_user.id},
            {"co_student_id": current_user.id},
            {"student_ids": current_user.id}
        ]
    })
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="L'étudiant participe déjà à un projet PFE actif."
        )

    project = Project(
        student_id=current_user.id,
        student_ids=[current_user.id],
        title=project_in.title,
        description=project_in.description,
        deadline=project_in.deadline,
        tags=project_in.tags or [],
        academic_year=project_in.academic_year or "2025-2026",
    )
    log_project_activity(
        project,
        current_user,
        "PROJET_CREE",
        f"Création du projet PFE : « {project.title} »"
    )
    await project.insert()

    return await _to_project_response(project)


# ── Get My Project ─────────────────────────────────────────────
@router.get("/me", response_model=ProjectResponse)
async def get_my_project(
    project_id: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user)
):
    if current_user.role == UserRole.STUDENT:
        project = await Project.find_one({
            "$or": [
                {"student_id": current_user.id},
                {"co_student_id": current_user.id},
                {"student_ids": current_user.id}
            ]
        })
    elif current_user.role == UserRole.ENCADRER:
        if project_id:
            try:
                p_oid = PydanticObjectId(project_id)
                project = await Project.get(p_oid)
                if not project or (
                    project.encadrer_id != current_user.id
                    and getattr(project, "academic_encadrer_id", None) != current_user.id
                    and getattr(project, "enterprise_encadrer_id", None) != current_user.id
                    and current_user.id not in getattr(project, "encadrer_ids", [])
                ):
                    project = None
            except Exception:
                project = None
        else:
            project = await Project.find_one({
                "$or": [
                    {"encadrer_id": current_user.id},
                    {"academic_encadrer_id": current_user.id},
                    {"enterprise_encadrer_id": current_user.id},
                    {"encadrer_ids": current_user.id}
                ]
            })
    else:
        raise HTTPException(status_code=400, detail="Admin should use admin endpoint.")

    if not project:
        raise HTTPException(status_code=404, detail="Projet introuvable.")

    return await _to_project_response(project)


# ── Get Supervised Projects (for Supervisor) ───────────────────
@router.get("/supervised", response_model=List[ProjectResponse])
async def get_supervised_projects(
    current_user: User = Depends(require_role([UserRole.ENCADRER]))
):
    projects = await Project.find({
        "$or": [
            {"encadrer_id": current_user.id},
            {"academic_encadrer_id": current_user.id},
            {"enterprise_encadrer_id": current_user.id},
            {"encadrer_ids": current_user.id}
        ]
    }).sort("-created_at").to_list()
    return [await _to_project_response(p) for p in projects]


# ── Update Project ─────────────────────────────────────────────
@router.patch("/me", response_model=ProjectResponse)
async def update_my_project(
    update_data: ProjectUpdate,
    current_user: User = Depends(get_current_user)
):
    if current_user.role == UserRole.STUDENT:
        project = await Project.find_one({
            "$or": [
                {"student_id": current_user.id},
                {"co_student_id": current_user.id},
                {"student_ids": current_user.id}
            ]
        })
    elif current_user.role == UserRole.ENCADRER:
        project = await Project.find_one({
            "$or": [
                {"encadrer_id": current_user.id},
                {"academic_encadrer_id": current_user.id},
                {"enterprise_encadrer_id": current_user.id},
                {"encadrer_ids": current_user.id}
            ]
        })
    else:
        raise HTTPException(status_code=403, detail="Non autorisé.")

    if not project:
        raise HTTPException(status_code=404, detail="Projet introuvable.")

    update_dict = update_data.model_dump(exclude_unset=True)
    for field, value in update_dict.items():
        setattr(project, field, value)

    project.updated_at = datetime.now(timezone.utc)
    log_project_activity(
        project,
        current_user,
        "PROJET_MODIFIE",
        "Mise à jour des informations du projet"
    )
    await project.save()

    return await _to_project_response(project)


# ── BINÔME: Invite Teammate ────────────────────────────────────
@router.post("/binome/invite", response_model=InvitationResponse)
async def invite_binome(
    invite_in: InviteBinomeRequest,
    current_user: User = Depends(require_role([UserRole.STUDENT]))
):
    project = await Project.find_one({
        "$or": [
            {"student_id": current_user.id},
            {"co_student_id": current_user.id},
            {"student_ids": current_user.id}
        ]
    })
    if not project:
        project = Project(
            student_id=current_user.id,
            student_ids=[current_user.id],
            title=f"Projet PFE - {current_user.first_name} {current_user.last_name}",
            description="Projet de fin d'études académique"
        )
        await project.insert()

    if getattr(project, "co_student_id", None):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ce projet a déjà un binôme assigné. La taille maximale d'une équipe est de 2 étudiants."
        )

    normalized_email = invite_in.email.strip().lower()
    if normalized_email == current_user.email.lower():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Vous ne pouvez pas vous inviter vous-même comme binôme."
        )

    # Check candidate student account if registered
    candidate = await User.find_one(User.email == normalized_email)
    if candidate:
        if candidate.role != UserRole.STUDENT:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="L'adresse email indiquée n'appartient pas à un compte étudiant."
            )
        candidate_project = await Project.find_one({
            "$or": [
                {"student_id": candidate.id},
                {"co_student_id": candidate.id},
                {"student_ids": candidate.id}
            ]
        })
        if candidate_project:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"{candidate.first_name} {candidate.last_name} fait déjà partie d'un autre projet PFE actif."
            )

    raw_token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)

    existing_inv = await Invitation.find_one(
        Invitation.project_id == project.id,
        Invitation.encadrer_email == normalized_email,
        Invitation.status == InvitationStatus.PENDING,
    )

    if existing_inv:
        existing_inv.token_hash = token_hash
        existing_inv.expires_at = expires_at
        existing_inv.invitation_type = InvitationType.BINOME
        existing_inv.recipient_email = normalized_email
        await existing_inv.save()
        invitation = existing_inv
    else:
        invitation = Invitation(
            project_id=project.id,
            student_id=current_user.id,
            encadrer_email=normalized_email,
            recipient_email=normalized_email,
            invitation_type=InvitationType.BINOME,
            supervisor_role=None,
            token_hash=token_hash,
            status=InvitationStatus.PENDING,
            expires_at=expires_at
        )
        await invitation.insert()

    student_name = f"{current_user.first_name} {current_user.last_name}".strip()

    if candidate:
        await notify(
            user_id=candidate.id,
            notification_type=NotificationType.BINOME_INVITATION_RECEIVED,
            title="Invitation à former un Binôme PFE",
            message=f"{student_name} vous a invité(e) à faire équipe en binôme sur son projet : « {project.title} ».",
            link=f"/?invitation_token={raw_token}"
        )

    log_project_activity(
        project,
        current_user,
        "BINOME_INVITE",
        f"Invitation envoyée à {normalized_email} pour former un binôme"
    )
    await project.save()

    invitation_link = build_invitation_link(raw_token)

    return InvitationResponse(
        id=str(invitation.id),
        project_id=str(invitation.project_id),
        student_id=str(invitation.student_id),
        invitation_type=InvitationType.BINOME,
        supervisor_role=None,
        recipient_email=normalized_email,
        encadrer_email=normalized_email,
        status=invitation.status,
        invitation_link=invitation_link,
        email_sent=True,
        expires_at=invitation.expires_at,
        created_at=invitation.created_at,
    )


# ── BINÔME: Remove Teammate ────────────────────────────────────
@router.delete("/binome", response_model=ProjectResponse)
async def remove_binome(
    current_user: User = Depends(require_role([UserRole.STUDENT]))
):
    project = await Project.find_one({
        "$or": [
            {"student_id": current_user.id},
            {"co_student_id": current_user.id},
            {"student_ids": current_user.id}
        ]
    })
    if not project:
        raise HTTPException(status_code=404, detail="Projet introuvable.")

    if not getattr(project, "co_student_id", None):
        raise HTTPException(status_code=400, detail="Ce projet n'a aucun binôme associé.")

    old_co_student_id = project.co_student_id
    project.co_student_id = None
    project.student_ids = [project.student_id]
    project.updated_at = datetime.now(timezone.utc)

    log_project_activity(
        project,
        current_user,
        "BINOME_RETIRE",
        "Le binôme a été dissocié du projet"
    )
    await project.save()

    # Notify old partner
    if old_co_student_id and old_co_student_id != current_user.id:
        await notify(
            user_id=old_co_student_id,
            notification_type=NotificationType.BINOME_REMOVED,
            title="Association de binôme terminée",
            message=f"{current_user.first_name} {current_user.last_name} a mis fin à l'association en binôme pour le projet « {project.title} ».",
            link="/dashboard"
        )
    elif old_co_student_id == current_user.id and project.student_id:
        await notify(
            user_id=project.student_id,
            notification_type=NotificationType.BINOME_REMOVED,
            title="Départ du binôme",
            message=f"{current_user.first_name} {current_user.last_name} a quitté le binôme pour le projet « {project.title} ».",
            link="/dashboard"
        )

    return await _to_project_response(project)


# ── BINÔME: Pending Invitations for Logged Student ─────────────
@router.get("/invitations/pending/binome", response_model=List[InvitationPreviewResponse])
async def list_pending_binome_invitations(
    current_user: User = Depends(require_role([UserRole.STUDENT]))
):
    norm_email = current_user.email.strip().lower()
    invitations = await Invitation.find(
        Invitation.encadrer_email == norm_email,
        Invitation.invitation_type == InvitationType.BINOME,
        Invitation.status == InvitationStatus.PENDING,
        Invitation.expires_at > datetime.now(timezone.utc)
    ).sort("-created_at").to_list()

    results: List[InvitationPreviewResponse] = []
    for inv in invitations:
        student = await User.get(inv.student_id)
        proj = await Project.get(inv.project_id)
        if student and proj:
            results.append(
                InvitationPreviewResponse(
                    token=None,
                    invitation_id=str(inv.id),
                    project_id=str(proj.id),
                    student_id=str(student.id),
                    student_name=f"{student.first_name} {student.last_name}".strip(),
                    project_title=proj.title,
                    project_description=proj.description,
                    invitation_type=InvitationType.BINOME,
                    supervisor_role=None,
                    encadrer_email=inv.encadrer_email,
                    recipient_email=inv.recipient_email or inv.encadrer_email,
                    status=inv.status,
                    expires_at=inv.expires_at,
                    created_at=inv.created_at,
                )
            )
    return results


# ── BINÔME: Accept Binôme Invitation by ID ──────────────────────
@router.post("/invitations/binome/{invitation_id}/accept", response_model=ProjectResponse)
async def accept_binome_invitation(
    invitation_id: str,
    current_user: User = Depends(require_role([UserRole.STUDENT]))
):
    try:
        inv_oid = PydanticObjectId(invitation_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Identifiant d'invitation invalide.")

    invitation = await Invitation.get(inv_oid)
    if not invitation or invitation.encadrer_email.lower() != current_user.email.lower():
        raise HTTPException(status_code=404, detail="Invitation introuvable ou non destinée à cet étudiant.")

    if invitation.status != InvitationStatus.PENDING:
        raise HTTPException(status_code=400, detail="Cette invitation n'est plus en attente.")

    if invitation.expires_at < datetime.now(timezone.utc):
        invitation.status = InvitationStatus.EXPIRED
        await invitation.save()
        raise HTTPException(status_code=400, detail="Cette invitation a expiré.")

    # Check candidate doesn't already have an active project
    existing_proj = await Project.find_one({
        "$or": [
            {"student_id": current_user.id},
            {"co_student_id": current_user.id},
            {"student_ids": current_user.id}
        ]
    })
    if existing_proj and existing_proj.id != invitation.project_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Vous appartenez déjà à un autre projet PFE actif. Quittez-le avant de rejoindre un binôme."
        )

    project = await Project.get(invitation.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Le projet associé n'existe plus.")

    if getattr(project, "co_student_id", None) and project.co_student_id != current_user.id:
        raise HTTPException(status_code=400, detail="Ce projet a déjà un second binôme.")

    # Connect student
    project.co_student_id = current_user.id
    if not hasattr(project, "student_ids") or project.student_ids is None:
        project.student_ids = [project.student_id]
    if current_user.id not in project.student_ids:
        project.student_ids.append(current_user.id)

    log_project_activity(
        project,
        current_user,
        "BINOME_REJOINT",
        f"{current_user.first_name} {current_user.last_name} a rejoint le projet en binôme"
    )
    project.updated_at = datetime.now(timezone.utc)
    await project.save()

    invitation.status = InvitationStatus.ACCEPTED
    await invitation.save()

    partner_name = f"{current_user.first_name} {current_user.last_name}".strip()
    await notify(
        user_id=project.student_id,
        notification_type=NotificationType.BINOME_INVITATION_ACCEPTED,
        title="Binôme rejoint avec succès !",
        message=f"{partner_name} a accepté votre invitation et forme désormais un binôme avec vous sur « {project.title} ».",
        link="/dashboard"
    )

    return await _to_project_response(project)


# ── BINÔME: Decline Binôme Invitation by ID ────────────────────
@router.post("/invitations/binome/{invitation_id}/decline")
async def decline_binome_invitation(
    invitation_id: str,
    current_user: User = Depends(require_role([UserRole.STUDENT]))
):
    try:
        inv_oid = PydanticObjectId(invitation_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Identifiant d'invitation invalide.")

    invitation = await Invitation.get(inv_oid)
    if not invitation or invitation.encadrer_email.lower() != current_user.email.lower():
        raise HTTPException(status_code=404, detail="Invitation introuvable.")

    invitation.status = InvitationStatus.DECLINED
    await invitation.save()

    project = await Project.get(invitation.project_id)
    if project:
        partner_name = f"{current_user.first_name} {current_user.last_name}".strip()
        await notify(
            user_id=project.student_id,
            notification_type=NotificationType.BINOME_INVITATION_DECLINED,
            title="Invitation de binôme déclinée",
            message=f"{partner_name} a décliné l'invitation à former un binôme sur le projet « {project.title} ».",
            link="/dashboard"
        )

    return {"status": "DECLINED", "message": "Invitation refusée."}


# ── SUPERVISOR: Invite Supervisor (Academic / Enterprise) ──────
@router.post("/invite", response_model=InvitationResponse)
async def invite_encadrer(
    invite_in: InviteEncadrerRequest,
    current_user: User = Depends(require_role([UserRole.STUDENT]))
):
    project = await Project.find_one({
        "$or": [
            {"student_id": current_user.id},
            {"co_student_id": current_user.id},
            {"student_ids": current_user.id}
        ]
    })
    if not project:
        project = Project(
            student_id=current_user.id,
            student_ids=[current_user.id],
            title=f"Projet PFE - {current_user.first_name} {current_user.last_name}",
            description="Projet de fin d'études académique"
        )
        await project.insert()

    normalized_email = invite_in.encadrer_email.strip().lower()
    sup_role = invite_in.role or SupervisorRole.ACADEMIC

    existing_encadrer = await User.find_one(
        User.email == normalized_email,
        User.role == UserRole.ENCADRER
    )

    current_encadrer_ids = list(getattr(project, "encadrer_ids", []) or [])
    if project.encadrer_id and project.encadrer_id not in current_encadrer_ids:
        current_encadrer_ids.append(project.encadrer_id)

    if existing_encadrer and existing_encadrer.id in current_encadrer_ids:
        role_label = "académique" if sup_role == SupervisorRole.ACADEMIC else "entreprise"
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{existing_encadrer.first_name} {existing_encadrer.last_name} ({normalized_email}) encadre déjà ce projet."
        )

    # Check if a supervisor of this specific role is already assigned
    if sup_role == SupervisorRole.ACADEMIC and getattr(project, "academic_encadrer_id", None):
        ac_user = await User.get(project.academic_encadrer_id)
        ac_name = f"{ac_user.first_name} {ac_user.last_name}" if ac_user else "Un encadreur"
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{ac_name} est déjà assigné comme encadreur académique. Retirez-le avant d'inviter un remplaçant."
        )
    elif sup_role == SupervisorRole.ENTERPRISE and getattr(project, "enterprise_encadrer_id", None):
        en_user = await User.get(project.enterprise_encadrer_id)
        en_name = f"{en_user.first_name} {en_user.last_name}" if en_user else "Un tuteur"
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{en_name} est déjà assigné comme encadreur d'entreprise. Retirez-le avant d'inviter un remplaçant."
        )

    raw_token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)

    existing_inv = await Invitation.find_one(
        Invitation.project_id == project.id,
        Invitation.encadrer_email == normalized_email,
        Invitation.status == InvitationStatus.PENDING,
    )

    if existing_inv:
        existing_inv.token_hash = token_hash
        existing_inv.expires_at = expires_at
        existing_inv.invitation_type = InvitationType.SUPERVISOR
        existing_inv.supervisor_role = sup_role
        await existing_inv.save()
        invitation = existing_inv
    else:
        invitation = Invitation(
            project_id=project.id,
            student_id=current_user.id,
            encadrer_email=normalized_email,
            recipient_email=normalized_email,
            invitation_type=InvitationType.SUPERVISOR,
            supervisor_role=sup_role,
            token_hash=token_hash,
            status=InvitationStatus.PENDING,
            expires_at=expires_at
        )
        await invitation.insert()

    student_name = f"{current_user.first_name} {current_user.last_name}".strip()
    role_title = "Encadreur Académique" if sup_role == SupervisorRole.ACADEMIC else "Encadreur Entreprise"

    if existing_encadrer:
        await notify(
            user_id=existing_encadrer.id,
            notification_type=NotificationType.INVITATION_RECEIVED,
            title=f"Nouvelle invitation : {role_title}",
            message=f"{student_name} vous a invité(e) en tant qu'{role_title} pour son projet : « {project.title} ».",
            link=f"/?invitation_token={raw_token}"
        )

    send_supervisor_invitation_email(
        normalized_email,
        student_name,
        f"{project.title} ({role_title})",
        raw_token,
    )

    log_project_activity(
        project,
        current_user,
        "SUPERVISEUR_INVITE",
        f"Invitation envoyée à {normalized_email} pour le rôle {role_title}"
    )
    await project.save()

    invitation_link = build_invitation_link(raw_token)

    return InvitationResponse(
        id=str(invitation.id),
        project_id=str(invitation.project_id),
        student_id=str(invitation.student_id),
        invitation_type=InvitationType.SUPERVISOR,
        supervisor_role=sup_role,
        recipient_email=normalized_email,
        encadrer_email=normalized_email,
        status=invitation.status,
        invitation_link=invitation_link,
        email_sent=True,
        expires_at=invitation.expires_at,
        created_at=invitation.created_at,
    )


# ── List Project Invitations (Student view) ────────────────────
@router.get("/invitations", response_model=List[InvitationItemResponse])
async def list_project_invitations(
    current_user: User = Depends(require_role([UserRole.STUDENT]))
):
    project = await Project.find_one({
        "$or": [
            {"student_id": current_user.id},
            {"co_student_id": current_user.id},
            {"student_ids": current_user.id}
        ]
    })
    if not project:
        return []

    invitations = await Invitation.find(Invitation.project_id == project.id).sort("-created_at").to_list()
    student_name = f"{current_user.first_name} {current_user.last_name}".strip()

    return [
        InvitationItemResponse(
            id=str(inv.id),
            project_id=str(inv.project_id),
            student_id=str(inv.student_id),
            student_name=student_name,
            invitation_type=getattr(inv, "invitation_type", InvitationType.SUPERVISOR) or InvitationType.SUPERVISOR,
            supervisor_role=getattr(inv, "supervisor_role", None),
            recipient_email=inv.recipient_email or inv.encadrer_email,
            encadrer_email=inv.encadrer_email,
            status=inv.status,
            invitation_link=None,
            expires_at=inv.expires_at,
            created_at=inv.created_at,
        )
        for inv in invitations
    ]


# ── Cancel Invitation ──────────────────────────────────────────
@router.delete("/invitations/{invitation_id}")
async def cancel_invitation(
    invitation_id: str,
    current_user: User = Depends(require_role([UserRole.STUDENT]))
):
    try:
        inv_oid = PydanticObjectId(invitation_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Identifiant d'invitation invalide.")

    invitation = await Invitation.get(inv_oid)
    if not invitation:
        raise HTTPException(status_code=404, detail="Invitation introuvable.")

    # Allow cancellation if user is in project
    project = await Project.get(invitation.project_id)
    if not project or (
        project.student_id != current_user.id
        and getattr(project, "co_student_id", None) != current_user.id
    ):
        raise HTTPException(status_code=403, detail="Non autorisé à annuler cette invitation.")

    await invitation.delete()
    return {"status": "DELETED", "message": "Invitation annulée avec succès."}


# ── Remove Supervisor ──────────────────────────────────────────
@router.delete("/encadrers/{encadrer_id}", response_model=ProjectResponse)
async def remove_encadrer(
    encadrer_id: str,
    current_user: User = Depends(require_role([UserRole.STUDENT]))
):
    project = await Project.find_one({
        "$or": [
            {"student_id": current_user.id},
            {"co_student_id": current_user.id},
            {"student_ids": current_user.id}
        ]
    })
    if not project:
        raise HTTPException(status_code=404, detail="Projet introuvable.")

    try:
        enc_oid = PydanticObjectId(encadrer_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Identifiant encadreur invalide.")

    current_enc_ids = list(getattr(project, "encadrer_ids", []) or [])
    if enc_oid in current_enc_ids:
        current_enc_ids.remove(enc_oid)
    project.encadrer_ids = current_enc_ids

    if getattr(project, "academic_encadrer_id", None) == enc_oid:
        project.academic_encadrer_id = None
    if getattr(project, "enterprise_encadrer_id", None) == enc_oid:
        project.enterprise_encadrer_id = None
    if project.encadrer_id == enc_oid:
        project.encadrer_id = project.academic_encadrer_id or (current_enc_ids[0] if current_enc_ids else None)

    project.updated_at = datetime.now(timezone.utc)
    log_project_activity(
        project,
        current_user,
        "SUPERVISEUR_RETIRE",
        f"Retrait de la supervision pour l'encadreur {encadrer_id}"
    )
    await project.save()

    enc_user = await User.get(enc_oid)
    if enc_user:
        await notify(
            user_id=enc_oid,
            notification_type=NotificationType.INVITATION_REJECTED,
            title="Supervision terminée",
            message=f"{current_user.first_name} {current_user.last_name} a retiré votre assignation pour le projet : « {project.title} ».",
            link="/supervisor/reviewer"
        )

    return await _to_project_response(project)


# ── Pending Invitations for Supervisor ─────────────────────────
@router.get("/invitations/pending", response_model=List[InvitationPreviewResponse])
async def list_pending_invitations_for_supervisor(
    current_user: User = Depends(require_role([UserRole.ENCADRER]))
):
    norm_email = current_user.email.strip().lower()
    invitations = await Invitation.find(
        Invitation.encadrer_email == norm_email,
        Invitation.status == InvitationStatus.PENDING,
        Invitation.expires_at > datetime.now(timezone.utc)
    ).sort("-created_at").to_list()

    results: List[InvitationPreviewResponse] = []
    for inv in invitations:
        student = await User.get(inv.student_id)
        proj = await Project.get(inv.project_id)
        if student and proj:
            results.append(
                InvitationPreviewResponse(
                    token=None,
                    invitation_id=str(inv.id),
                    project_id=str(proj.id),
                    student_id=str(student.id),
                    student_name=f"{student.first_name} {student.last_name}".strip(),
                    project_title=proj.title,
                    project_description=proj.description,
                    invitation_type=getattr(inv, "invitation_type", InvitationType.SUPERVISOR) or InvitationType.SUPERVISOR,
                    supervisor_role=getattr(inv, "supervisor_role", SupervisorRole.ACADEMIC),
                    encadrer_email=inv.encadrer_email,
                    recipient_email=inv.recipient_email or inv.encadrer_email,
                    status=inv.status,
                    expires_at=inv.expires_at,
                    created_at=inv.created_at,
                )
            )
    return results


# ── Supervisor Accept by ID ────────────────────────────────────
@router.post("/invitations/{invitation_id}/accept", response_model=ProjectResponse)
async def accept_invitation_by_id(
    invitation_id: str,
    current_user: User = Depends(require_role([UserRole.ENCADRER]))
):
    try:
        inv_oid = PydanticObjectId(invitation_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Identifiant d'invitation invalide.")

    invitation = await Invitation.get(inv_oid)
    if not invitation or invitation.encadrer_email.lower() != current_user.email.lower():
        raise HTTPException(status_code=404, detail="Invitation introuvable ou non destinée à cet encadreur.")

    if invitation.status == InvitationStatus.ACCEPTED:
        proj = await Project.get(invitation.project_id)
        if proj:
            return await _to_project_response(proj)
        raise HTTPException(status_code=404, detail="Projet introuvable.")

    if invitation.status != InvitationStatus.PENDING:
        raise HTTPException(status_code=400, detail="Cette invitation n'est plus en attente.")

    if invitation.expires_at < datetime.now(timezone.utc):
        invitation.status = InvitationStatus.EXPIRED
        await invitation.save()
        raise HTTPException(status_code=400, detail="Cette invitation a expiré.")

    project = await Project.get(invitation.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Le projet associé n'existe plus.")

    # Connect supervisor with specific role
    sup_role = getattr(invitation, "supervisor_role", SupervisorRole.ACADEMIC) or SupervisorRole.ACADEMIC
    if sup_role == SupervisorRole.ENTERPRISE:
        project.enterprise_encadrer_id = current_user.id
    else:
        project.academic_encadrer_id = current_user.id
        if not project.encadrer_id:
            project.encadrer_id = current_user.id

    if not hasattr(project, "encadrer_ids") or project.encadrer_ids is None:
        project.encadrer_ids = []
    if current_user.id not in project.encadrer_ids:
        project.encadrer_ids.append(current_user.id)

    role_label = "Encadreur Académique" if sup_role == SupervisorRole.ACADEMIC else "Encadreur Entreprise"
    log_project_activity(
        project,
        current_user,
        "SUPERVISEUR_ASSIGNE",
        f"{current_user.first_name} {current_user.last_name} a rejoint le projet en tant qu'{role_label}"
    )
    project.updated_at = datetime.now(timezone.utc)
    await project.save()

    invitation.status = InvitationStatus.ACCEPTED
    await invitation.save()

    supervisor_name = f"{current_user.first_name} {current_user.last_name}".strip()
    # Notify both students (creator and binome)
    student_ids_to_notify = [project.student_id]
    if getattr(project, "co_student_id", None):
        student_ids_to_notify.append(project.co_student_id)

    for sid in student_ids_to_notify:
        await notify(
            user_id=sid,
            notification_type=NotificationType.INVITATION_ACCEPTED,
            title="Encadreur connecté !",
            message=f"{supervisor_name} a accepté d'encadrer votre projet « {project.title} » ({role_label}).",
            link="/dashboard"
        )

    await notify(
        user_id=current_user.id,
        notification_type=NotificationType.INVITATION_ACCEPTED,
        title="Projet ajouté à vos encadrements",
        message=f"Vous êtes assigné(e) en tant qu'{role_label} sur le projet : « {project.title} ».",
        link="/supervisor/reviewer"
    )

    return await _to_project_response(project)


# ── Supervisor Decline by ID ───────────────────────────────────
@router.post("/invitations/{invitation_id}/decline")
async def decline_invitation_by_id(
    invitation_id: str,
    current_user: User = Depends(require_role([UserRole.ENCADRER]))
):
    try:
        inv_oid = PydanticObjectId(invitation_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Identifiant d'invitation invalide.")

    invitation = await Invitation.get(inv_oid)
    if not invitation or invitation.encadrer_email.lower() != current_user.email.lower():
        raise HTTPException(status_code=404, detail="Invitation introuvable.")

    if invitation.status != InvitationStatus.PENDING:
        raise HTTPException(status_code=400, detail="Cette invitation a déjà été traitée.")

    invitation.status = InvitationStatus.DECLINED
    await invitation.save()

    project = await Project.get(invitation.project_id)
    if project:
        supervisor_name = f"{current_user.first_name} {current_user.last_name}".strip()
        await notify(
            user_id=project.student_id,
            notification_type=NotificationType.INVITATION_REJECTED,
            title="Invitation refusée",
            message=f"{supervisor_name} a décliné l'invitation à encadrer le projet « {project.title} ».",
            link="/dashboard"
        )

    return {"status": "DECLINED", "message": "Invitation refusée."}


# ── Preview Invitation by Token ────────────────────────────────
@router.get("/invitations/preview", response_model=InvitationPreviewResponse)
async def preview_invitation(token: str):
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    invitation = await Invitation.find_one(Invitation.token_hash == token_hash)
    if not invitation:
        raise HTTPException(status_code=404, detail="Invitation introuvable.")

    if invitation.expires_at < datetime.now(timezone.utc):
        invitation.status = InvitationStatus.EXPIRED
        await invitation.save()
        raise HTTPException(status_code=400, detail="Cette invitation a expiré.")

    student = await User.get(invitation.student_id)
    project = await Project.get(invitation.project_id)

    if not student or not project:
        raise HTTPException(status_code=404, detail="Le projet ou l'étudiant n'existe plus.")

    student_name = f"{student.first_name} {student.last_name}".strip()

    return InvitationPreviewResponse(
        token=token,
        invitation_id=str(invitation.id),
        project_id=str(project.id),
        student_id=str(student.id),
        student_name=student_name,
        project_title=project.title,
        project_description=project.description,
        invitation_type=getattr(invitation, "invitation_type", InvitationType.SUPERVISOR) or InvitationType.SUPERVISOR,
        supervisor_role=getattr(invitation, "supervisor_role", None),
        encadrer_email=invitation.encadrer_email,
        recipient_email=invitation.recipient_email or invitation.encadrer_email,
        status=invitation.status,
        expires_at=invitation.expires_at,
        created_at=invitation.created_at,
    )


# ── General Accept by Token (Both Student Binôme & Supervisor) ──
@router.post("/invitations/accept", response_model=ProjectResponse)
async def accept_invitation(
    token: str,
    current_user: User = Depends(get_current_user)
):
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    invitation = await Invitation.find_one(Invitation.token_hash == token_hash)

    if not invitation:
        raise HTTPException(status_code=400, detail="Jeton d'invitation invalide ou introuvable.")

    if invitation.status == InvitationStatus.ACCEPTED:
        project = await Project.get(invitation.project_id)
        if project:
            return await _to_project_response(project)
        raise HTTPException(status_code=404, detail="Projet introuvable.")

    if invitation.status != InvitationStatus.PENDING:
        raise HTTPException(status_code=400, detail="Cette invitation n'est plus en attente.")

    if invitation.expires_at < datetime.now(timezone.utc):
        invitation.status = InvitationStatus.EXPIRED
        await invitation.save()
        raise HTTPException(status_code=400, detail="Cette invitation a expiré.")

    project = await Project.get(invitation.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Le projet associé n'existe plus.")

    inv_type = getattr(invitation, "invitation_type", InvitationType.SUPERVISOR)

    # 1. Handle Binôme Acceptance
    if inv_type == InvitationType.BINOME:
        if current_user.role != UserRole.STUDENT:
            raise HTTPException(status_code=403, detail="Seul un compte étudiant peut accepter cette invitation de binôme.")

        existing_proj = await Project.find_one({
            "$or": [
                {"student_id": current_user.id},
                {"co_student_id": current_user.id},
                {"student_ids": current_user.id}
            ]
        })
        if existing_proj and existing_proj.id != project.id:
            raise HTTPException(status_code=400, detail="Vous appartenez déjà à un autre projet PFE.")

        project.co_student_id = current_user.id
        if not hasattr(project, "student_ids") or project.student_ids is None:
            project.student_ids = [project.student_id]
        if current_user.id not in project.student_ids:
            project.student_ids.append(current_user.id)

        log_project_activity(
            project,
            current_user,
            "BINOME_REJOINT",
            f"{current_user.first_name} {current_user.last_name} a rejoint le binôme"
        )
        project.updated_at = datetime.now(timezone.utc)
        await project.save()

        invitation.status = InvitationStatus.ACCEPTED
        await invitation.save()

        partner_name = f"{current_user.first_name} {current_user.last_name}".strip()
        await notify(
            user_id=project.student_id,
            notification_type=NotificationType.BINOME_INVITATION_ACCEPTED,
            title="Binôme connecté !",
            message=f"{partner_name} a accepté votre invitation sur le projet « {project.title} ».",
            link="/dashboard"
        )
        return await _to_project_response(project)

    # 2. Handle Supervisor Acceptance
    if current_user.role != UserRole.ENCADRER:
        raise HTTPException(status_code=403, detail="Seul un compte encadreur peut accepter cette invitation.")

    sup_role = getattr(invitation, "supervisor_role", SupervisorRole.ACADEMIC) or SupervisorRole.ACADEMIC
    if sup_role == SupervisorRole.ENTERPRISE:
        project.enterprise_encadrer_id = current_user.id
    else:
        project.academic_encadrer_id = current_user.id
        if not project.encadrer_id:
            project.encadrer_id = current_user.id

    if not hasattr(project, "encadrer_ids") or project.encadrer_ids is None:
        project.encadrer_ids = []
    if current_user.id not in project.encadrer_ids:
        project.encadrer_ids.append(current_user.id)

    role_label = "Encadreur Académique" if sup_role == SupervisorRole.ACADEMIC else "Encadreur Entreprise"
    log_project_activity(
        project,
        current_user,
        "SUPERVISEUR_ASSIGNE",
        f"{current_user.first_name} {current_user.last_name} est désormais {role_label}"
    )
    project.updated_at = datetime.now(timezone.utc)
    await project.save()

    invitation.status = InvitationStatus.ACCEPTED
    await invitation.save()

    supervisor_name = f"{current_user.first_name} {current_user.last_name}".strip()
    student_ids_to_notify = [project.student_id]
    if getattr(project, "co_student_id", None):
        student_ids_to_notify.append(project.co_student_id)

    for sid in student_ids_to_notify:
        await notify(
            user_id=sid,
            notification_type=NotificationType.INVITATION_ACCEPTED,
            title="Encadreur connecté !",
            message=f"{supervisor_name} a accepté d'encadrer votre projet « {project.title} » ({role_label}).",
            link="/dashboard"
        )

    await notify(
        user_id=current_user.id,
        notification_type=NotificationType.INVITATION_ACCEPTED,
        title="Projet ajouté à vos encadrements",
        message=f"Vous êtes connecté(e) au projet « {project.title} » en tant qu'{role_label}.",
        link="/supervisor/reviewer"
    )

    return await _to_project_response(project)


# ── General Decline by Token ───────────────────────────────────
@router.post("/invitations/decline")
async def decline_invitation(
    token: str,
    current_user: User = Depends(get_current_user)
):
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    invitation = await Invitation.find_one(Invitation.token_hash == token_hash)
    if not invitation or invitation.status != InvitationStatus.PENDING:
        raise HTTPException(status_code=400, detail="Invitation invalide ou déjà traitée.")

    invitation.status = InvitationStatus.DECLINED
    await invitation.save()

    project = await Project.get(invitation.project_id)
    if project:
        user_name = f"{current_user.first_name} {current_user.last_name}".strip()
        inv_type = getattr(invitation, "invitation_type", InvitationType.SUPERVISOR)
        notif_type = (
            NotificationType.BINOME_INVITATION_DECLINED if inv_type == InvitationType.BINOME
            else NotificationType.INVITATION_REJECTED
        )
        await notify(
            user_id=project.student_id,
            notification_type=notif_type,
            title="Invitation refusée",
            message=f"{user_name} a décliné l'invitation pour le projet « {project.title} ».",
            link="/dashboard"
        )
    return {"status": "DECLINED", "message": "Invitation refusée avec succès."}


# ── SHARED TASKS MANAGEMENT ────────────────────────────────────
@router.post("/tasks", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
async def create_task(
    payload: TaskCreate,
    current_user: User = Depends(get_current_user)
):
    project = await Project.find_one({
        "$or": [
            {"student_id": current_user.id},
            {"co_student_id": current_user.id},
            {"student_ids": current_user.id},
            {"encadrer_id": current_user.id},
            {"academic_encadrer_id": current_user.id},
            {"enterprise_encadrer_id": current_user.id},
            {"encadrer_ids": current_user.id}
        ]
    })
    if not project:
        raise HTTPException(status_code=404, detail="Projet non trouvé.")

    assigned_oid = None
    assigned_name = None
    if payload.assigned_to:
        try:
            assigned_oid = PydanticObjectId(payload.assigned_to)
            assigned_user = await User.get(assigned_oid)
            if assigned_user:
                assigned_name = f"{assigned_user.first_name} {assigned_user.last_name}".strip()
        except Exception:
            pass

    task = ProjectTask(
        title=payload.title.strip(),
        description=payload.description.strip() if payload.description else "",
        assigned_to=assigned_oid,
        assigned_name=assigned_name,
        status=TaskStatus.TODO,
        due_date=payload.due_date,
        created_by=current_user.id,
        created_at=datetime.now(timezone.utc)
    )

    if not hasattr(project, "tasks") or project.tasks is None:
        project.tasks = []
    project.tasks.append(task)

    log_project_activity(
        project,
        current_user,
        "TACHE_CREEE",
        f"Nouvelle tâche ajoutée : « {task.title} »"
    )
    project.updated_at = datetime.now(timezone.utc)
    await project.save()

    if assigned_oid and assigned_oid != current_user.id:
        await notify(
            user_id=assigned_oid,
            notification_type=NotificationType.TASK_ASSIGNED,
            title="Nouvelle tâche assignée",
            message=f"{current_user.first_name} vous a assigné la tâche : « {task.title} ».",
            link="/dashboard"
        )

    return TaskResponse(
        id=task.id,
        title=task.title,
        description=task.description,
        assigned_to=str(task.assigned_to) if task.assigned_to else None,
        assigned_name=task.assigned_name,
        status=task.status.value,
        due_date=task.due_date,
        created_at=task.created_at,
        completed_at=task.completed_at
    )


@router.patch("/tasks/{task_id}", response_model=TaskResponse)
async def update_task(
    task_id: str,
    payload: TaskUpdate,
    current_user: User = Depends(get_current_user)
):
    project = await Project.find_one({
        "$or": [
            {"student_id": current_user.id},
            {"co_student_id": current_user.id},
            {"student_ids": current_user.id},
            {"encadrer_id": current_user.id},
            {"academic_encadrer_id": current_user.id},
            {"enterprise_encadrer_id": current_user.id},
            {"encadrer_ids": current_user.id}
        ]
    })
    if not project:
        raise HTTPException(status_code=404, detail="Projet non trouvé.")

    tasks = getattr(project, "tasks", []) or []
    target_task = next((t for t in tasks if t.id == task_id), None)
    if not target_task:
        raise HTTPException(status_code=404, detail="Tâche introuvable.")

    if payload.title is not None:
        target_task.title = payload.title.strip()
    if payload.description is not None:
        target_task.description = payload.description.strip()
    if payload.due_date is not None:
        target_task.due_date = payload.due_date
    if payload.assigned_to is not None:
        try:
            assigned_oid = PydanticObjectId(payload.assigned_to)
            assigned_user = await User.get(assigned_oid)
            if assigned_user:
                target_task.assigned_to = assigned_oid
                target_task.assigned_name = f"{assigned_user.first_name} {assigned_user.last_name}".strip()
        except Exception:
            pass

    if payload.status is not None:
        target_task.status = payload.status
        if payload.status == TaskStatus.DONE:
            target_task.completed_at = datetime.now(timezone.utc)
            log_project_activity(
                project,
                current_user,
                "TACHE_TERMINEE",
                f"Tâche terminée : « {target_task.title} »"
            )
        else:
            target_task.completed_at = None

    project.updated_at = datetime.now(timezone.utc)
    await project.save()

    return TaskResponse(
        id=target_task.id,
        title=target_task.title,
        description=target_task.description,
        assigned_to=str(target_task.assigned_to) if target_task.assigned_to else None,
        assigned_name=target_task.assigned_name,
        status=target_task.status.value,
        due_date=target_task.due_date,
        created_at=target_task.created_at,
        completed_at=target_task.completed_at
    )


@router.delete("/tasks/{task_id}")
async def delete_task(
    task_id: str,
    current_user: User = Depends(get_current_user)
):
    project = await Project.find_one({
        "$or": [
            {"student_id": current_user.id},
            {"co_student_id": current_user.id},
            {"student_ids": current_user.id},
            {"encadrer_id": current_user.id},
            {"academic_encadrer_id": current_user.id},
            {"enterprise_encadrer_id": current_user.id},
            {"encadrer_ids": current_user.id}
        ]
    })
    if not project:
        raise HTTPException(status_code=404, detail="Projet non trouvé.")

    tasks = getattr(project, "tasks", []) or []
    project.tasks = [t for t in tasks if t.id != task_id]
    project.updated_at = datetime.now(timezone.utc)
    await project.save()

    return {"status": "DELETED", "message": "Tâche supprimée."}
