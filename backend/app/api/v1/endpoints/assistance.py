import logging
import os
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, HTTPException, status, Depends, UploadFile, File, Form
from fastapi.responses import Response
from beanie import PydanticObjectId

from app.core.security import get_password_hash
from app.models.user import User, UserRole
from app.models.assistance import (
    AssistanceRequest,
    AssistanceServiceType,
    AssistanceRequestStatus
)
from app.models.project import Project
from app.models.report import Report
from app.api.deps import get_current_user, require_role
from app.schemas.assistance import (
    TechnicianCreateRequest,
    TechnicianResponse,
    AssistanceRequestCreate,
    AssistanceRequestResponse,
    AssistanceAssignRequest,
    AssistanceDeliverRequest,
    AssistanceRateRequest
)
from app.storage.storage_service import get_storage_service

logger = logging.getLogger("uvicorn.error")

router = APIRouter()

SERVICE_CONFIG = {
    AssistanceServiceType.MISE_EN_PAGE_WORD: {
        "price": 35.0,
        "label": "Mise en page académique Word (Sommaire, Marges, Figures)",
    },
    AssistanceServiceType.TEMPLATE_LATEX: {
        "price": 45.0,
        "label": "Mise en page Template LaTeX officiel (BibTeX, Formules)",
    },
    AssistanceServiceType.CORRECTION_STYLE: {
        "price": 30.0,
        "label": "Relecture typographique & harmonisation du style académique",
    },
    AssistanceServiceType.PACK_COMPLET: {
        "price": 65.0,
        "label": "Pack Complet : Mise en page + Figures + Correction linguistique",
    },
}


def _tech_to_response(u: User) -> TechnicianResponse:
    return TechnicianResponse(
        id=str(u.id),
        first_name=u.first_name,
        last_name=u.last_name,
        email=u.email,
        phone_number=u.phone_number or "",
        specialties=getattr(u, "specialties", []) or ["Mise en page Word", "Normes universitaires"],
        is_active=u.is_active,
        is_trusted_technician=getattr(u, "is_trusted_technician", True),
        completed_assistance_count=getattr(u, "completed_assistance_count", 0) or 0,
        created_at=u.created_at,
    )


def _req_to_response(r: AssistanceRequest) -> AssistanceRequestResponse:
    return AssistanceRequestResponse(
        id=str(r.id),
        student_id=str(r.student_id),
        student_name=r.student_name,
        student_email=r.student_email,
        student_phone=r.student_phone,
        project_id=str(r.project_id) if r.project_id else None,
        project_title=r.project_title,
        report_id=str(r.report_id) if r.report_id else None,
        report_title=r.report_title,
        service_type=r.service_type,
        service_label=r.service_label,
        notes_from_student=r.notes_from_student,
        deadline_date=r.deadline_date,
        price_tnd=r.price_tnd,
        payment_status=r.payment_status,
        payment_provider=r.payment_provider,
        status=r.status,
        assigned_technician_id=str(r.assigned_technician_id) if r.assigned_technician_id else None,
        assigned_technician_name=r.assigned_technician_name,
        assigned_technician_email=r.assigned_technician_email,
        assigned_technician_phone=r.assigned_technician_phone,
        student_file_url=r.student_file_url,
        student_file_name=r.student_file_name,
        delivered_file_url=r.delivered_file_url,
        delivered_file_name=r.delivered_file_name,
        technician_notes=r.technician_notes,
        rating=r.rating,
        feedback=r.feedback,
        created_at=r.created_at,
        assigned_at=r.assigned_at,
        delivered_at=r.delivered_at,
        completed_at=r.completed_at,
    )


# ── 1. Admin Management Endpoints ─────────────────────────────────

@router.post("/admin/technicians", response_model=TechnicianResponse, status_code=status.HTTP_201_CREATED)
async def create_technician(
    payload: TechnicianCreateRequest,
    _admin: User = Depends(require_role([UserRole.ADMIN]))
):
    """Admin creates a new verified trusted technician account."""
    normalized_email = payload.email.strip().lower()
    existing = await User.find_one(User.email == normalized_email)
    if existing:
        raise HTTPException(status_code=400, detail="Un utilisateur avec cet email existe déjà.")

    user = User(
        email=normalized_email,
        password_hash=get_password_hash(payload.password),
        role=UserRole.TECHNICIAN,
        first_name=payload.first_name.strip(),
        last_name=payload.last_name.strip(),
        phone_number=payload.phone_number.strip(),
        specialties=payload.specialties or ["Mise en page Word", "Normes universitaires"],
        bio=payload.bio or "",
        is_active=True,
        is_trusted_technician=True,
        email_confirmed_at=datetime.now(timezone.utc),
    )
    await user.insert()
    logger.info(f"Admin created trusted technician: {user.email}")
    return _tech_to_response(user)


@router.get("/admin/technicians", response_model=List[TechnicianResponse])
async def list_technicians(_user: User = Depends(get_current_user)):
    """List all registered trusted technicians."""
    technicians = await User.find(User.role == UserRole.TECHNICIAN).to_list()
    return [_tech_to_response(t) for t in technicians]


@router.get("/admin/requests", response_model=List[AssistanceRequestResponse])
async def list_all_requests_admin(_admin: User = Depends(require_role([UserRole.ADMIN]))):
    """Admin views all report assistance requests across the platform."""
    requests = await AssistanceRequest.find().sort(-AssistanceRequest.created_at).to_list()
    return [_req_to_response(r) for r in requests]


@router.post("/admin/requests/{request_id}/assign", response_model=AssistanceRequestResponse)
async def assign_technician(
    request_id: str,
    payload: AssistanceAssignRequest,
    _admin: User = Depends(require_role([UserRole.ADMIN]))
):
    """Admin assigns or reassigns a trusted technician to a request."""
    try:
        req_id = PydanticObjectId(request_id)
        tech_id = PydanticObjectId(payload.technician_id)
    except Exception:
        raise HTTPException(status_code=400, detail="ID invalide.")

    req = await AssistanceRequest.get(req_id)
    if not req:
        raise HTTPException(status_code=404, detail="Demande introuvable.")

    tech = await User.get(tech_id)
    if not tech or tech.role != UserRole.TECHNICIAN:
        raise HTTPException(status_code=400, detail="Technicien invalide.")

    req.assigned_technician_id = tech.id
    req.assigned_technician_name = f"{tech.first_name} {tech.last_name}".strip()
    req.assigned_technician_email = tech.email
    req.assigned_technician_phone = tech.phone_number
    req.assigned_at = datetime.now(timezone.utc)
    if req.status == AssistanceRequestStatus.PENDING_ASSIGNMENT:
        req.status = AssistanceRequestStatus.IN_PROGRESS

    await req.save()
    logger.info(f"Assigned request {req.id} to technician {tech.email}")
    return _req_to_response(req)


# ── 2. Student Endpoints ──────────────────────────────────────────

@router.post("/requests", response_model=AssistanceRequestResponse, status_code=status.HTTP_201_CREATED)
async def create_assistance_request(
    payload: AssistanceRequestCreate,
    current_user: User = Depends(get_current_user)
):
    """Student submits a request for formatting / assistance with a standard price."""
    conf = SERVICE_CONFIG.get(payload.service_type, SERVICE_CONFIG[AssistanceServiceType.MISE_EN_PAGE_WORD])
    price_tnd = conf["price"]
    service_label = conf["label"]

    project_title = None
    project_oid = None
    if payload.project_id:
        try:
            project_oid = PydanticObjectId(payload.project_id)
            proj = await Project.get(project_oid)
            if proj:
                project_title = proj.title
        except Exception:
            pass

    report_oid = None
    if payload.report_id:
        try:
            report_oid = PydanticObjectId(payload.report_id)
        except Exception:
            pass

    # Automatically find an active technician to assign, or leave in PENDING_ASSIGNMENT
    first_tech = await User.find_one(User.role == UserRole.TECHNICIAN, User.is_active == True)

    req = AssistanceRequest(
        student_id=current_user.id,
        student_name=f"{current_user.first_name} {current_user.last_name}".strip(),
        student_email=current_user.email,
        student_phone=current_user.phone_number or "",
        project_id=project_oid,
        project_title=project_title,
        report_id=report_oid,
        report_title=payload.report_title or "Rapport de PFE",
        service_type=payload.service_type,
        service_label=service_label,
        notes_from_student=payload.notes_from_student or "",
        deadline_date=payload.deadline_date,
        price_tnd=price_tnd,
        payment_status="PAID",
        payment_provider=payload.payment_provider or "KONNECT",
        status=AssistanceRequestStatus.IN_PROGRESS if first_tech else AssistanceRequestStatus.PENDING_ASSIGNMENT,
        assigned_technician_id=first_tech.id if first_tech else None,
        assigned_technician_name=f"{first_tech.first_name} {first_tech.last_name}".strip() if first_tech else None,
        assigned_technician_email=first_tech.email if first_tech else None,
        assigned_technician_phone=first_tech.phone_number if first_tech else None,
        assigned_at=datetime.now(timezone.utc) if first_tech else None,
        student_file_url=payload.student_file_url,
        student_file_name=payload.student_file_name or "Rapport_Etudiant.docx",
    )
    await req.insert()
    logger.info(f"Student {current_user.email} created assistance request {req.id} ({service_label})")
    return _req_to_response(req)


@router.get("/requests", response_model=List[AssistanceRequestResponse])
async def list_student_requests(current_user: User = Depends(get_current_user)):
    """List requests created by the current student."""
    requests = await AssistanceRequest.find(
        AssistanceRequest.student_id == current_user.id
    ).sort(-AssistanceRequest.created_at).to_list()
    return [_req_to_response(r) for r in requests]


@router.post("/requests/{request_id}/rate", response_model=AssistanceRequestResponse)
async def rate_assistance(
    request_id: str,
    payload: AssistanceRateRequest,
    current_user: User = Depends(get_current_user)
):
    """Student rates the completed work delivered by the technician."""
    try:
        req_id = PydanticObjectId(request_id)
    except Exception:
        raise HTTPException(status_code=400, detail="ID invalide.")

    req = await AssistanceRequest.get(req_id)
    if not req or req.student_id != current_user.id:
        raise HTTPException(status_code=404, detail="Demande introuvable.")

    req.rating = payload.rating
    req.feedback = payload.feedback
    req.status = AssistanceRequestStatus.COMPLETED
    req.completed_at = datetime.now(timezone.utc)
    await req.save()

    # Increment technician's completed count
    if req.assigned_technician_id:
        tech = await User.get(req.assigned_technician_id)
        if tech:
            tech.completed_assistance_count = (getattr(tech, "completed_assistance_count", 0) or 0) + 1
            await tech.save()

    return _req_to_response(req)


# ── 3. Technician Endpoints ───────────────────────────────────────

@router.get("/technician/tasks", response_model=List[AssistanceRequestResponse])
async def list_technician_tasks(current_user: User = Depends(get_current_user)):
    """Technician views tasks assigned to them."""
    if current_user.role not in (UserRole.TECHNICIAN, UserRole.ADMIN):
        raise HTTPException(status_code=403, detail="Accès réservé aux techniciens.")

    query = AssistanceRequest.assigned_technician_id == current_user.id
    if current_user.role == UserRole.ADMIN:
        tasks = await AssistanceRequest.find().sort(-AssistanceRequest.created_at).to_list()
    else:
        tasks = await AssistanceRequest.find(query).sort(-AssistanceRequest.created_at).to_list()

    return [_req_to_response(t) for t in tasks]


@router.post("/technician/tasks/{request_id}/deliver", response_model=AssistanceRequestResponse)
async def deliver_formatted_report(
    request_id: str,
    file: UploadFile = File(...),
    technician_notes: Optional[str] = Form(""),
    current_user: User = Depends(get_current_user)
):
    """Technician uploads the completed formatted file and notes."""
    if current_user.role not in (UserRole.TECHNICIAN, UserRole.ADMIN):
        raise HTTPException(status_code=403, detail="Accès réservé aux techniciens.")

    try:
        req_id = PydanticObjectId(request_id)
    except Exception:
        raise HTTPException(status_code=400, detail="ID invalide.")

    req = await AssistanceRequest.get(req_id)
    if not req:
        raise HTTPException(status_code=404, detail="Demande introuvable.")

    if current_user.role != UserRole.ADMIN and req.assigned_technician_id != current_user.id:
        raise HTTPException(status_code=403, detail="Vous n'êtes pas assigné à cette demande.")

    storage = get_storage_service()
    content = await file.read()
    filename = file.filename or "Rapport_Mise_en_Page_Final.docx"
    destination_key = f"assistance/{str(req.id)}/delivered_{filename}"
    await storage.upload_file(content, destination_key)

    req.delivered_file_url = destination_key
    req.delivered_file_name = filename
    req.technician_notes = technician_notes
    req.status = AssistanceRequestStatus.DELIVERED
    req.delivered_at = datetime.now(timezone.utc)
    await req.save()

    logger.info(f"Technician {current_user.email} delivered formatted file for request {req.id}")
    return _req_to_response(req)


@router.get("/download/{request_id}/{file_type}")
async def download_assistance_file(
    request_id: str,
    file_type: str,  # "student" or "delivered"
    current_user: User = Depends(get_current_user)
):
    """Download either the student's initial report or the delivered formatted report."""
    try:
        req_id = PydanticObjectId(request_id)
    except Exception:
        raise HTTPException(status_code=400, detail="ID invalide.")

    req = await AssistanceRequest.get(req_id)
    if not req:
        raise HTTPException(status_code=404, detail="Demande introuvable.")

    # Authorization: Student who created it, assigned technician, or Admin
    is_owner = req.student_id == current_user.id
    is_assigned = req.assigned_technician_id == current_user.id
    is_admin = current_user.role == UserRole.ADMIN
    if not (is_owner or is_assigned or is_admin):
        raise HTTPException(status_code=403, detail="Accès interdit à ce fichier.")

    storage_key = req.student_file_url if file_type == "student" else req.delivered_file_url
    filename = req.student_file_name if file_type == "student" else req.delivered_file_name

    if not storage_key:
        raise HTTPException(status_code=404, detail="Fichier non encore disponible.")

    storage = get_storage_service()
    try:
        content = await storage.get_file_bytes(storage_key)
    except Exception:
        raise HTTPException(status_code=404, detail="Fichier physique introuvable sur le serveur.")

    media_type = "application/octet-stream"
    if filename.endswith(".docx"):
        media_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    elif filename.endswith(".pdf"):
        media_type = "application/pdf"
    elif filename.endswith(".zip") or filename.endswith(".tar.gz"):
        media_type = "application/zip"

    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )
