import asyncio
import os
import sys
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.abspath("backend"))

from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie, PydanticObjectId

from app.models.user import User, UserRole
from app.models.project import Project, Invitation, InvitationStatus, InvitationType, SupervisorRole, TaskStatus, ProjectTask
from app.models.report import Report, ReportVersion, WorkflowStatus, ReportType, AIAnalysisStatus
from app.models.evaluation import Evaluation, ApprovalStatus
from app.models.annotation import Annotation
from app.models.notification import Notification, NotificationType
from app.models.ai_analysis import AIAnalysis
from app.models.mock_defense import MockDefenseSimulation
from app.api.v1.endpoints.evaluations import compute_dual_validation
from app.api.v1.endpoints.projects import _to_project_response, log_project_activity

async def run_binome_and_dual_validation_tests():
    print("=================================================================")
    print("   TEST SUITE: BINÔMES & MULTI-ENCADREURS + DUAL VALIDATION")
    print("=================================================================")

    # Setup isolated test database
    client = AsyncIOMotorClient("mongodb://localhost:27017")
    db = client["encadrini_binome_test_db"]
    await init_beanie(
        database=db,
        document_models=[
            User, Project, Invitation, Report, Annotation,
            Evaluation, Notification, AIAnalysis, MockDefenseSimulation
        ]
    )

    # Clean test collections
    await User.find_all().delete()
    await Project.find_all().delete()
    await Invitation.find_all().delete()
    await Report.find_all().delete()
    await Evaluation.find_all().delete()
    await Annotation.find_all().delete()
    await Notification.find_all().delete()

    print("\n[STEP 1] Setting up Users...")
    # 2 Students (Binôme)
    student1 = User(
        email="karim@student.tn",
        password_hash="hash1",
        role=UserRole.STUDENT,
        first_name="Karim",
        last_name="Boumediene",
        faculty="INSAT",
        is_active=True
    )
    await student1.insert()

    student2 = User(
        email="sarah@student.tn",
        password_hash="hash2",
        role=UserRole.STUDENT,
        first_name="Sarah",
        last_name="Ben Ali",
        faculty="INSAT",
        is_active=True
    )
    await student2.insert()

    # Academic Supervisor (Professor)
    prof_academic = User(
        email="prof.moncef@univ.tn",
        password_hash="hash3",
        role=UserRole.ENCADRER,
        first_name="Moncef",
        last_name="Ben Salem",
        faculty="Département Informatique (INSAT)",
        is_active=True
    )
    await prof_academic.insert()

    # Enterprise Supervisor (Mentor)
    mentor_enterprise = User(
        email="mentor.leila@techcorp.com",
        password_hash="hash4",
        role=UserRole.ENCADRER,
        first_name="Leila",
        last_name="Trabelsi",
        faculty="TechCorp R&D Lab",
        is_active=True
    )
    await mentor_enterprise.insert()

    print(f" -> Created: Student 1 ({student1.email}), Student 2 ({student2.email})")
    print(f" -> Created: Academic Supervisor ({prof_academic.email})")
    print(f" -> Created: Enterprise Supervisor ({mentor_enterprise.email})")

    # -------------------------------------------------------------
    print("\n[STEP 2] Project Creation & Binôme Collaboration...")
    project = Project(
        student_id=student1.id,
        student_ids=[student1.id],
        title="Plateforme Cloud & IA pour la Santé",
        description="Système distribué de diagnostic assisté par ordinateur",
        deadline=datetime.now(timezone.utc) + timedelta(days=90),
        academic_year="2025-2026"
    )
    log_project_activity(project, student1, "PROJET_CREE", "Création initiale par Karim")
    await project.insert()
    assert project.id is not None
    assert project.co_student_id is None
    print("[OK] Project created by Student 1 (Karim).")

    # Binôme Invitation
    binome_invitation = Invitation(
        project_id=project.id,
        student_id=student1.id,
        encadrer_email=student2.email,
        recipient_email=student2.email,
        invitation_type=InvitationType.BINOME,
        token_hash="binome_token_123",
        status=InvitationStatus.PENDING,
        expires_at=datetime.now(timezone.utc) + timedelta(days=7)
    )
    await binome_invitation.insert()
    print("[OK] Binôme invitation created for Student 2 (Sarah).")

    # Accept Binôme Invitation
    project.co_student_id = student2.id
    project.student_ids.append(student2.id)
    binome_invitation.status = InvitationStatus.ACCEPTED
    await binome_invitation.save()
    log_project_activity(project, student2, "BINOME_REJOINT", "Sarah a accepté l'invitation et rejoint le binôme")
    await project.save()

    proj_resp = await _to_project_response(project)
    assert proj_resp.is_binome is True
    assert len(proj_resp.students) == 2
    assert proj_resp.students[0].name == "Karim Boumediene"
    assert proj_resp.students[1].name == "Sarah Ben Ali"
    print(f"[OK] Binôme confirmed: {proj_resp.students[0].name} & {proj_resp.students[1].name} are collaborating.")

    # -------------------------------------------------------------
    print("\n[STEP 3] Assigning Both Supervisors (Academic & Enterprise)...")
    # Academic Supervisor
    project.academic_encadrer_id = prof_academic.id
    project.encadrer_id = prof_academic.id
    project.encadrer_ids.append(prof_academic.id)

    # Enterprise Supervisor
    project.enterprise_encadrer_id = mentor_enterprise.id
    project.encadrer_ids.append(mentor_enterprise.id)

    log_project_activity(project, prof_academic, "SUPERVISEUR_ASSIGNE", "Dr. Moncef assigné comme Encadreur Académique")
    log_project_activity(project, mentor_enterprise, "SUPERVISEUR_ASSIGNE", "Mme Leila assignée comme Encadrante Entreprise")
    await project.save()

    proj_resp = await _to_project_response(project)
    assert proj_resp.academic_encadrer is not None
    assert proj_resp.academic_encadrer.email == prof_academic.email
    assert proj_resp.enterprise_encadrer is not None
    assert proj_resp.enterprise_encadrer.email == mentor_enterprise.email
    print(f"[OK] Academic Supervisor: {proj_resp.academic_encadrer.name} ({proj_resp.academic_encadrer.role.value})")
    print(f"[OK] Enterprise Supervisor: {proj_resp.enterprise_encadrer.name} ({proj_resp.enterprise_encadrer.role.value})")

    # -------------------------------------------------------------
    print("\n[STEP 4] Shared Tasks & Activity Timeline...")
    task1 = ProjectTask(
        title="Rédiger le chapitre 2 : Architecture microservices",
        assigned_to=student2.id,
        assigned_name="Sarah Ben Ali",
        status=TaskStatus.TODO,
        created_by=student1.id
    )
    task2 = ProjectTask(
        title="Déploiement Docker sur l'infrastructure entreprise",
        assigned_to=student1.id,
        assigned_name="Karim Boumediene",
        status=TaskStatus.IN_PROGRESS,
        created_by=mentor_enterprise.id
    )
    project.tasks.extend([task1, task2])
    await project.save()

    proj_resp = await _to_project_response(project)
    assert len(proj_resp.tasks) == 2
    assert len(proj_resp.activities) >= 4
    print(f"[OK] Shared Tasks verified ({len(proj_resp.tasks)} tasks). Activities logged: {len(proj_resp.activities)} events.")

    # -------------------------------------------------------------
    print("\n[STEP 5] Dual Validation Workflow: Version 1 Submission...")
    report = Report(
        project_id=project.id,
        title="Rapport de PFE - Conception & Déploiement",
        report_type=ReportType.PFE,
        current_version=1,
        versions=[
            ReportVersion(
                version_number=1,
                original_file_name="PFE_Rapport_v1.pdf",
                original_mime_type="application/pdf",
                raw_file_key="reports/test/v1.pdf",
                pdf_file_key="reports/test/v1.pdf",
                file_size=1024000,
                ai_analysis_status=AIAnalysisStatus.COMPLETED,
                workflow_status=WorkflowStatus.SUBMITTED,
                uploaded_by=student1.id,
                uploaded_by_name="Karim Boumediene"
            )
        ]
    )
    await report.insert()

    # Initial dual status check
    dual_status_v1 = await compute_dual_validation(report, 1, project)
    assert dual_status_v1.workflow_status == "SUBMITTED"
    assert dual_status_v1.is_fully_approved is False
    print(f"[OK] Version 1 status: {dual_status_v1.workflow_status} (Both reviews pending).")

    # Academic Supervisor reviews & approves v1
    eval_academic_v1 = Evaluation(
        report_id=report.id,
        version_number=1,
        encadrer_id=prof_academic.id,
        supervisor_role=SupervisorRole.ACADEMIC,
        grade=16.0,
        feedback="Très bonne rigueur académique et structure claire.",
        approval_status=ApprovalStatus.APPROVED_FOR_DEFENSE
    )
    await eval_academic_v1.insert()

    dual_status_v1_mid = await compute_dual_validation(report, 1, project)
    assert dual_status_v1_mid.workflow_status == "UNDER_REVIEW"
    assert dual_status_v1_mid.academic_approved is True
    assert dual_status_v1_mid.enterprise_approved is False
    assert dual_status_v1_mid.is_fully_approved is False
    print(f"[OK] Mid-review: Academic Approved, but Enterprise is pending -> Overall: {dual_status_v1_mid.workflow_status}.")

    # Enterprise Supervisor reviews & requests corrections on v1
    eval_enterprise_v1 = Evaluation(
        report_id=report.id,
        version_number=1,
        encadrer_id=mentor_enterprise.id,
        supervisor_role=SupervisorRole.ENTERPRISE,
        grade=11.5,
        feedback="Veuillez détailler les métriques de latence des benchmarks et sécuriser les endpoints d'API.",
        approval_status=ApprovalStatus.CORRECTIONS_REQUIRED
    )
    await eval_enterprise_v1.insert()

    dual_status_v1_end = await compute_dual_validation(report, 1, project)
    assert dual_status_v1_end.workflow_status == "CHANGES_REQUESTED"
    assert dual_status_v1_end.requires_changes is True
    assert dual_status_v1_end.is_fully_approved is False
    print(f"[OK] Enterprise requested corrections -> Overall Version 1 status: {dual_status_v1_end.workflow_status}!")

    # -------------------------------------------------------------
    print("\n[STEP 6] Resubmission & Independent Validation on Version 2...")
    # Student 2 (Sarah, teammate) uploads Version 2 with requested fixes
    v2_entry = ReportVersion(
        version_number=2,
        original_file_name="PFE_Rapport_v2_Corrige.pdf",
        original_mime_type="application/pdf",
        raw_file_key="reports/test/v2.pdf",
        pdf_file_key="reports/test/v2.pdf",
        file_size=1050000,
        ai_analysis_status=AIAnalysisStatus.COMPLETED,
        workflow_status=WorkflowStatus.SUBMITTED,
        uploaded_by=student2.id,
        uploaded_by_name="Sarah Ben Ali",
        submission_notes="Corrections des benchmarks et ajout des schémas de sécurisation API."
    )
    report.versions.append(v2_entry)
    report.current_version = 2
    await report.save()

    # CRITICAL CHECK: Does Version 2 inherit old version 1 approvals? NO!
    dual_status_v2 = await compute_dual_validation(report, 2, project)
    assert dual_status_v2.workflow_status == "SUBMITTED"
    assert dual_status_v2.academic_evaluation is None
    assert dual_status_v2.enterprise_evaluation is None
    assert dual_status_v2.is_fully_approved is False
    print("[OK] Crucial rule verified: Version 2 is clean SUBMITTED. Never inherited v1 approvals!")

    # Old Version 1 history preserved?
    dual_status_v1_check = await compute_dual_validation(report, 1, project)
    assert dual_status_v1_check.workflow_status == "CHANGES_REQUESTED"
    print("[OK] Version 1 history and previous reviews are completely preserved.")

    # Now both supervisors review Version 2
    # 1. Academic Supervisor approves v2
    eval_academic_v2 = Evaluation(
        report_id=report.id,
        version_number=2,
        encadrer_id=prof_academic.id,
        supervisor_role=SupervisorRole.ACADEMIC,
        grade=17.5,
        feedback="Excellent manuscrit final, corrections parfaitement intégrées.",
        approval_status=ApprovalStatus.APPROVED_FOR_DEFENSE
    )
    await eval_academic_v2.insert()

    # 2. Enterprise Supervisor approves v2
    eval_enterprise_v2 = Evaluation(
        report_id=report.id,
        version_number=2,
        encadrer_id=mentor_enterprise.id,
        supervisor_role=SupervisorRole.ENTERPRISE,
        grade=18.0,
        feedback="Benchmarks validés sur notre cluster de production. Félicitations à Karim et Sarah.",
        approval_status=ApprovalStatus.APPROVED_FOR_DEFENSE
    )
    await eval_enterprise_v2.insert()

    # Final Dual Validation calculation for Version 2
    dual_status_v2_final = await compute_dual_validation(report, 2, project)
    assert dual_status_v2_final.workflow_status == "APPROVED"
    assert dual_status_v2_final.academic_approved is True
    assert dual_status_v2_final.enterprise_approved is True
    assert dual_status_v2_final.is_fully_approved is True
    assert dual_status_v2_final.requires_changes is False
    print(f"[OK] Version 2 FINAL DUAL VALIDATION: {dual_status_v2_final.workflow_status} (is_fully_approved=True)!")

    # -------------------------------------------------------------
    print("\n[STEP 7] Generating Official Double Validation PDF...")
    from fastapi.responses import StreamingResponse
    # Test ReportLab PDF flow inside evaluations endpoint
    from app.api.v1.endpoints.evaluations import export_evaluation_pdf
    pdf_resp = await export_evaluation_pdf(report.id, 2, current_user=prof_academic)
    assert isinstance(pdf_resp, StreamingResponse)
    assert "attachment" in pdf_resp.headers["Content-Disposition"]
    print(f"[OK] In-memory PDF export generated successfully: {pdf_resp.headers['Content-Disposition']}.")

    print("\n=================================================================")
    print("   ALL BINÔMES & MULTI-ENCADREURS TESTS PASSED WITH 100% SUCCESS!")
    print("=================================================================\n")

if __name__ == "__main__":
    asyncio.run(run_binome_and_dual_validation_tests())
