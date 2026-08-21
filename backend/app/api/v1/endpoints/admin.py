from typing import Optional
from fastapi import APIRouter, HTTPException, status, Depends, Query
from beanie import PydanticObjectId

from app.models.user import User, UserRole
from app.models.project import Project
from app.models.report import Report
from app.models.annotation import Annotation
from app.models.ai_analysis import AIAnalysis
from app.api.deps import require_role
from app.schemas.admin import (
    AdminUserResponse,
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
        # Resolve emails
        student = await User.get(p.student_id) if p.student_id else None
        encadrer = await User.get(p.encadrer_id) if p.encadrer_id else None

        # Count report versions
        report = await Report.find_one(Report.project_id == p.id)
        report_count = len(report.versions) if report else 0
        latest_v = report.current_version if report else None

        results.append(
            AdminProjectResponse(
                id=str(p.id),
                title=p.title,
                student_email=student.email if student else None,
                encadrer_email=encadrer.email if encadrer else None,
                report_count=report_count,
                latest_version=latest_v,
                created_at=p.created_at,
            )
        )

    return AdminProjectListResponse(
        projects=results,
        total=total,
        page=page,
        page_size=page_size,
    )


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
