from pydantic import BaseModel, EmailStr
from typing import List, Optional
from datetime import datetime


# --- User Management Schemas ---

class AdminUserResponse(BaseModel):
    id: str
    email: str
    role: str
    first_name: str
    last_name: str
    faculty: str
    is_active: bool
    created_at: datetime


class AdminUserCreate(BaseModel):
    email: EmailStr
    password: str
    role: str = "ENCADRER"
    first_name: str
    last_name: str
    faculty: Optional[str] = ""
    is_active: bool = True


class AdminUserUpdate(BaseModel):
    """Admin can toggle active status, role, and faculty."""
    is_active: Optional[bool] = None
    role: Optional[str] = None
    faculty: Optional[str] = None


class AdminUserListResponse(BaseModel):
    users: List[AdminUserResponse]
    total: int
    page: int
    page_size: int


# --- Project Oversight Schemas ---

class AdminProjectResponse(BaseModel):
    id: str
    title: str
    student_email: Optional[str] = None
    co_student_email: Optional[str] = None
    encadrer_email: Optional[str] = None
    academic_encadrer_email: Optional[str] = None
    enterprise_encadrer_email: Optional[str] = None
    is_binome: bool = False
    report_count: int = 0
    latest_version: Optional[int] = None
    workflow_status: Optional[str] = None
    created_at: datetime


class AdminAssignSupervisorRequest(BaseModel):
    supervisor_email: EmailStr
    role: str = "ACADEMIC"  # "ACADEMIC" or "ENTERPRISE"


class AdminAssignBinomeRequest(BaseModel):
    student_email: EmailStr


class AdminProjectListResponse(BaseModel):
    projects: List[AdminProjectResponse]
    total: int
    page: int
    page_size: int


# --- Platform Statistics Schemas ---

class PlatformStats(BaseModel):
    total_users: int
    total_students: int
    total_encadrers: int
    total_admins: int
    active_users: int
    total_projects: int
    total_reports: int
    total_report_versions: int
    total_annotations: int
    total_ai_analyses: int
    ai_analysis_avg_quality: Optional[float] = None
