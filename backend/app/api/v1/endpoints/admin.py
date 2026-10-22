from datetime import datetime
from typing import Optional
from fastapi import APIRouter, HTTPException, status, Depends, Query
from beanie import PydanticObjectId

from app.core.security import get_password_hash
from app.models.user import User, UserRole
from app.models.project import Project
from app.models.report import Report
from app.models.annotation import Annotation
from app.models.ai_analysis import AIAnalysis
from app.api.deps import require_role
from app.schemas.admin import (
    AdminUserResponse,
    AdminUserCreate,
    AdminUserUpdate,
    AdminUserListResponse,
    AdminProjectResponse,
    AdminProjectListResponse,
    PlatformStats,
)

router = APIRouter()


# ── Helpers ──────────────────────────────────────────────────

def _user_to_response(u: User) -> AdminUserResponse:
    return AdminUserResponse(
        id=str(u.id),
        email=u.email,
        role=u.role.value,
        first_name=u.first_name,
        last_name=u.last_name,
        faculty=u.faculty,
        is_active=u.is_active,
        created_at=u.created_at,
    )


# ── 1. User Management ──────────────────────────────────────

@router.post("/users", response_model=AdminUserResponse, status_code=status.HTTP_201_CREATED)
async def create_user_by_admin(
    payload: AdminUserCreate,
    _admin: User = Depends(require_role([UserRole.ADMIN])),
):
    """Admin can directly create accounts (e.g. Encadreur, Admin, Etudiant)."""
    normalized_email = payload.email.strip().lower()
    existing = await User.find_one(User.email == normalized_email)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Un utilisateur avec cet email existe déjà.",
        )

    try:
        user_role = UserRole(payload.role)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Rôle invalide. Doit être parmi: {[r.value for r in UserRole]}",
        )

    user = User(
        email=normalized_email,
        password_hash=get_password_hash(payload.password),
        role=user_role,
        first_name=payload.first_name.strip(),
        last_name=payload.last_name.strip(),
        faculty=payload.faculty.strip() if payload.faculty else "",
        is_active=payload.is_active,
        email_confirmed_at=datetime.utcnow() if payload.is_active else None,
    )
    await user.insert()

    if user.role == UserRole.ENCADRER:
        try:
            from app.api.v1.endpoints.auth import check_and_link_pending_invitations
            await check_and_link_pending_invitations(user)
        except Exception:
            pass

    return _user_to_response(user)


@router.get("/users", response_model=AdminUserListResponse)
async def list_users(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    role: Optional[str] = None,
    search: Optional[str] = None,
    _admin: User = Depends(require_role([UserRole.ADMIN])),
):
    """Paginated user listing with optional role/search filter."""
    query = {}
    if role:
        query["role"] = role
    if search:
        # Case-insensitive search on email, first_name, last_name
        query["$or"] = [
            {"email": {"$regex": search, "$options": "i"}},
            {"first_name": {"$regex": search, "$options": "i"}},
            {"last_name": {"$regex": search, "$options": "i"}},
        ]

    total = await User.find(query).count()
    skip = (page - 1) * page_size
    users = await User.find(query).skip(skip).limit(page_size).to_list()

    return AdminUserListResponse(
        users=[_user_to_response(u) for u in users],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/users/{user_id}", response_model=AdminUserResponse)
async def get_user(
    user_id: PydanticObjectId,
    _admin: User = Depends(require_role([UserRole.ADMIN])),
):
    user = await User.get(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    return _user_to_response(user)


@router.patch("/users/{user_id}", response_model=AdminUserResponse)
async def update_user(
    user_id: PydanticObjectId,
    payload: AdminUserUpdate,
    _admin: User = Depends(require_role([UserRole.ADMIN])),
):
    """Admin can toggle active status, change role, or update faculty."""
    user = await User.get(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    if payload.is_active is not None:
        user.is_active = payload.is_active
    if payload.role is not None:
        try:
            user.role = UserRole(payload.role)
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid role. Must be one of: {[r.value for r in UserRole]}",
            )
    if payload.faculty is not None:
        user.faculty = payload.faculty

    await user.save()
    return _user_to_response(user)


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: PydanticObjectId,
    admin: User = Depends(require_role([UserRole.ADMIN])),
):
    """Soft-delete a user by deactivating them (preserves data integrity)."""
    if str(user_id) == str(admin.id):
        raise HTTPException(status_code=400, detail="Cannot delete your own admin account.")

    user = await User.get(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    user.is_active = False
    await user.save()
    return None


# ── 2. Project Oversight ────────────────────────────────────

@router.get("/projects", response_model=AdminProjectListResponse)
async def list_projects(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    _admin: User = Depends(require_role([UserRole.ADMIN])),
):
    """Admin overview of all PFE projects with student/supervisor emails."""
    query = {}
    if search:
        query["title"] = {"$regex": search, "$options": "i"}

    total = await Project.find(query).count()
    skip = (page - 1) * page_size
    projects = await Project.find(query).skip(skip).limit(page_size).to_list()

    results = []
    for p in projects:
        # Resolve student emails
        student = await User.get(p.student_id) if p.student_id else None
        co_student = await User.get(p.co_student_id) if getattr(p, "co_student_id", None) else None

        # Resolve supervisor emails
        ac_user = await User.get(p.academic_encadrer_id) if getattr(p, "academic_encadrer_id", None) else None
        en_user = await User.get(p.enterprise_encadrer_id) if getattr(p, "enterprise_encadrer_id", None) else None

        enc_emails = []
        if ac_user:
            enc_emails.append(f"{ac_user.email} (Académique)")
        if en_user:
            enc_emails.append(f"{en_user.email} (Entreprise)")
        if not ac_user and not en_user:
            if p.encadrer_id:
                enc = await User.get(p.encadrer_id)
                if enc:
                    enc_emails.append(enc.email)
            for eid in getattr(p, "encadrer_ids", []) or []:
                if eid != p.encadrer_id:
                    enc = await User.get(eid)
                    if enc and enc.email not in enc_emails:
                        enc_emails.append(enc.email)

        encadrer_email_str = ", ".join(enc_emails) if enc_emails else None

        # Count report versions & latest workflow status
        report = await Report.find_one(Report.project_id == p.id)
        report_count = len(report.versions) if report else 0
        latest_v = report.current_version if report else None
        latest_status = None
        if report and report.versions:
            latest_v_obj = next((v for v in report.versions if v.version_number == latest_v), None)
            if latest_v_obj:
                latest_status = latest_v_obj.workflow_status.value if hasattr(latest_v_obj.workflow_status, "value") else str(latest_v_obj.workflow_status)

        results.append(
            AdminProjectResponse(
                id=str(p.id),
                title=p.title,
                student_email=student.email if student else None,
                co_student_email=co_student.email if co_student else None,
                encadrer_email=encadrer_email_str,
                academic_encadrer_email=ac_user.email if ac_user else None,
                enterprise_encadrer_email=en_user.email if en_user else None,
                is_binome=bool(p.co_student_id),
                report_count=report_count,
                latest_version=latest_v,
                workflow_status=latest_status,
                created_at=p.created_at,
            )
        )

    return AdminProjectListResponse(
        projects=results,
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post("/projects/{project_id}/assign-supervisor")
async def admin_assign_supervisor(
    project_id: PydanticObjectId,
    supervisor_email: str = Query(...),
    role: str = Query("ACADEMIC"),
    _admin: User = Depends(require_role([UserRole.ADMIN])),
):
    """Admin assigns an academic or enterprise supervisor to a project."""
    project = await Project.get(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Projet non trouvé.")

    normalized_email = supervisor_email.strip().lower()
    sup_user = await User.find_one(User.email == normalized_email)
    if not sup_user or sup_user.role != UserRole.ENCADRER:
        raise HTTPException(status_code=400, detail="Aucun compte encadreur actif trouvé avec cette adresse.")

    from app.models.project import SupervisorRole
    from app.api.v1.endpoints.projects import log_project_activity
    from app.models.notification import NotificationType
    from app.services.notification_service import notify
    from datetime import timezone

    is_enterprise = (role.upper() == "ENTERPRISE")
    if is_enterprise:
        project.enterprise_encadrer_id = sup_user.id
    else:
        project.academic_encadrer_id = sup_user.id
        if not project.encadrer_id:
            project.encadrer_id = sup_user.id

    if not hasattr(project, "encadrer_ids") or project.encadrer_ids is None:
        project.encadrer_ids = []
    if sup_user.id not in project.encadrer_ids:
        project.encadrer_ids.append(sup_user.id)

    role_label = "Encadreur Entreprise" if is_enterprise else "Encadreur Académique"
    log_project_activity(
        project,
        _admin,
        "ASSIGNATION_ADMIN",
        f"L'administrateur a assigné {sup_user.first_name} {sup_user.last_name} comme {role_label}"
    )
    project.updated_at = datetime.now(timezone.utc)
    await project.save()

    # Notify supervisor
    await notify(
        user_id=sup_user.id,
        notification_type=NotificationType.INVITATION_ACCEPTED,
        title="Nouveau projet assigné par l'administrateur",
        message=f"Vous avez été assigné(e) en tant qu'{role_label} sur le projet : « {project.title} ».",
        link="/supervisor/reviewer"
    )

    return {"status": "SUCCESS", "message": f"{sup_user.first_name} {sup_user.last_name} a été assigné(e) en tant qu'{role_label}."}


@router.post("/projects/{project_id}/assign-binome")
async def admin_assign_binome(
    project_id: PydanticObjectId,
    student_email: str = Query(...),
    _admin: User = Depends(require_role([UserRole.ADMIN])),
):
    """Admin assigns a second student (binôme) directly to a project."""
    project = await Project.get(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Projet non trouvé.")

    normalized_email = student_email.strip().lower()
    student_user = await User.find_one(User.email == normalized_email)
    if not student_user or student_user.role != UserRole.STUDENT:
        raise HTTPException(status_code=400, detail="Aucun compte étudiant trouvé avec cette adresse.")

    from app.api.v1.endpoints.projects import log_project_activity
    from app.models.notification import NotificationType
    from app.services.notification_service import notify
    from datetime import timezone

    project.co_student_id = student_user.id
    if not hasattr(project, "student_ids") or project.student_ids is None:
        project.student_ids = [project.student_id]
    if student_user.id not in project.student_ids:
        project.student_ids.append(student_user.id)

    log_project_activity(
        project,
        _admin,
        "BINOME_ADMIN",
        f"L'administrateur a rattaché {student_user.first_name} {student_user.last_name} en binôme"
    )
    project.updated_at = datetime.now(timezone.utc)
    await project.save()

    # Notify students
    await notify(
        user_id=student_user.id,
        notification_type=NotificationType.BINOME_INVITATION_ACCEPTED,
        title="Rattachement à un projet PFE",
        message=f"L'administration vous a rattaché(e) en binôme au projet : « {project.title} ».",
        link="/dashboard"
    )
    if project.student_id:
        await notify(
            user_id=project.student_id,
            notification_type=NotificationType.BINOME_INVITATION_ACCEPTED,
            title="Binôme assigné par l'administration",
            message=f"{student_user.first_name} {student_user.last_name} a été rattaché(e) comme binôme sur votre projet.",
            link="/dashboard"
        )

    return {"status": "SUCCESS", "message": f"{student_user.first_name} {student_user.last_name} rattaché(e) en binôme."}


# ── 3. Platform Statistics ──────────────────────────────────

@router.get("/stats", response_model=PlatformStats)
async def get_platform_stats(
    _admin: User = Depends(require_role([UserRole.ADMIN])),
):
    """Aggregated platform-wide usage statistics."""
    total_users = await User.find_all().count()
    total_students = await User.find(User.role == UserRole.STUDENT).count()
    total_encadrers = await User.find(User.role == UserRole.ENCADRER).count()
    total_admins = await User.find(User.role == UserRole.ADMIN).count()
    active_users = await User.find(User.is_active == True).count()

    total_projects = await Project.find_all().count()

    all_reports = await Report.find_all().to_list()
    total_reports = len(all_reports)
    total_report_versions = sum(len(r.versions) for r in all_reports)

    total_annotations = await Annotation.find_all().count()
    total_ai_analyses = await AIAnalysis.find_all().count()

    # Compute average AI quality score
    avg_quality = None
    if total_ai_analyses > 0:
        pipeline = [
            {"$group": {"_id": None, "avg_quality": {"$avg": "$scores.overall_quality"}}}
        ]
        result = await AIAnalysis.aggregate(pipeline).to_list()
        if result:
            avg_quality = round(result[0]["avg_quality"], 2)

    return PlatformStats(
        total_users=total_users,
        total_students=total_students,
        total_encadrers=total_encadrers,
        total_admins=total_admins,
        active_users=active_users,
        total_projects=total_projects,
        total_reports=total_reports,
        total_report_versions=total_report_versions,
        total_annotations=total_annotations,
        total_ai_analyses=total_ai_analyses,
        ai_analysis_avg_quality=avg_quality,
    )
