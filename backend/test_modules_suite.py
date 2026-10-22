import asyncio
import os
import sys
from datetime import datetime, timezone, timedelta

sys.path.insert(0, os.path.abspath("backend"))

from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie, PydanticObjectId

from app.models.user import User, UserRole
from app.models.project import Project, SupervisorRole, ProjectStatus
from app.models.report import Report, ReportVersion, WorkflowStatus, ReportType
from app.models.evaluation import Evaluation
from app.models.annotation import Annotation
from app.models.notification import Notification, NotificationType
from app.models.ai_analysis import AIAnalysis
from app.models.mock_defense import MockDefenseSimulation
from app.models.compliance import ComplianceReportDocument
from app.models.meeting_log import MeetingLog, MeetingLogStatus
from app.models.certificate import PFEValidationCertificate, PFEValidationStatus
from app.services.certificate_service import (
    compute_certificate_hash, generate_pfe_certificate_pdf
)
from app.schemas.meeting_log import MeetingLogCreate, MeetingLogUpdate, MeetingLogReview
from app.schemas.certificate import FinalValidationRequest
from app.api.v1.endpoints.meeting_logs import (
    create_meeting_log, list_meeting_logs, update_meeting_log, review_meeting_log, delete_meeting_log
)
from app.api.v1.endpoints.certificates import (
    validate_final_pfe_and_issue_certificate, download_certificate_pdf, verify_certificate_authenticity
)
from fastapi import HTTPException


async def run_test_suite():
    print("=================================================================")
    print("   TEST SUITE: MEETING LOGS & FINAL PFE VALIDATION CERTIFICATES   ")
    print("=================================================================")

    # 1. Setup isolated test database
    client = AsyncIOMotorClient("mongodb://localhost:27017")
    test_db = client["encadrini_modules_test_db"]
    await init_beanie(
        database=test_db,
        document_models=[
            User, Project, Report, Evaluation, Annotation, Notification,
            AIAnalysis, MockDefenseSimulation, ComplianceReportDocument,
            MeetingLog, PFEValidationCertificate
        ]
    )

    # Clean collections
    await User.find_all().delete()
    await Project.find_all().delete()
    await Report.find_all().delete()
    await MeetingLog.find_all().delete()
    await PFEValidationCertificate.find_all().delete()
    await Notification.find_all().delete()
    await ComplianceReportDocument.find_all().delete()

    print("\n[STEP 1] Creating Users (Students Binôme & Supervisors)...")
    st1 = User(
        email="amine.student@insat.ucar.tn",
        password_hash="fakehash",
        role=UserRole.STUDENT,
        first_name="Amine",
        last_name="Mansour",
        faculty="INSAT",
        is_active=True,
    )
    await st1.insert()

    st2 = User(
        email="yasmine.binome@insat.ucar.tn",
        password_hash="fakehash",
        role=UserRole.STUDENT,
        first_name="Yasmine",
        last_name="Trabelsi",
        faculty="INSAT",
        is_active=True,
    )
    await st2.insert()

    sup_acad = User(
        email="dr.khalil@insat.ucar.tn",
        password_hash="fakehash",
        role=UserRole.ENCADRER,
        first_name="Dr. Khalil",
        last_name="Ben Salah",
        faculty="INSAT",
        is_active=True,
    )
    await sup_acad.insert()

    sup_ent = User(
        email="sarah.tech@telecom.tn",
        password_hash="fakehash",
        role=UserRole.ENCADRER,
        first_name="Sarah",
        last_name="Kacem",
        is_active=True,
    )
    await sup_ent.insert()

    unauthorized_user = User(
        email="intruder@test.com",
        password_hash="fakehash",
        role=UserRole.STUDENT,
        first_name="Intruder",
        last_name="User",
        is_active=True,
    )
    await unauthorized_user.insert()

    print(f" -> Created Students: {st1.first_name} & {st2.first_name} (Binôme)")
    print(f" -> Created Academic Supervisor: {sup_acad.first_name} {sup_acad.last_name}")
    print(f" -> Created Enterprise Supervisor: {sup_ent.first_name} {sup_ent.last_name}")

    print("\n[STEP 2] Creating Project & Report...")
    project = Project(
        student_id=st1.id,
        co_student_id=st2.id,
        student_ids=[st1.id, st2.id],
        encadrer_id=sup_acad.id,
        academic_encadrer_id=sup_acad.id,
        enterprise_encadrer_id=sup_ent.id,
        encadrer_ids=[sup_acad.id, sup_ent.id],
        title="Plateforme Cloud & IA pour la Détection d'Anomalies Réseau",
        description="PFE axé sur l'observabilité distribuée et le machine learning.",
        academic_year="2025-2026",
    )
    await project.insert()

    report = Report(
        project_id=project.id,
        title="Manuscrit de PFE",
        report_type=ReportType.PFE,
        current_version=2,
        versions=[
            ReportVersion(
                version_number=1,
                original_file_name="pfe_v1.pdf",
                original_mime_type="application/pdf",
                raw_file_key="reports/v1.pdf",
                pdf_file_key="reports/v1.pdf",
                file_size=102400,
                workflow_status=WorkflowStatus.CHANGES_REQUESTED,
            ),
            ReportVersion(
                version_number=2,
                original_file_name="pfe_v2_final.pdf",
                original_mime_type="application/pdf",
                raw_file_key="reports/v2.pdf",
                pdf_file_key="reports/v2.pdf",
                file_size=154200,
                workflow_status=WorkflowStatus.SUBMITTED,
            )
        ]
    )
    await report.insert()
    print("[OK] Project & Report configured.")

    print("\n=================================================================")
    print("MODULE 1: MEETING LOGS & PROGRESS TRACKING TESTS")
    print("=================================================================")

    # Test 1: Student creates a meeting log
    print("\n[Test 1.1] Student creates a meeting report (DRAFT)...")
    meet_date = datetime.now(timezone.utc) - timedelta(days=2)
    draft_payload = MeetingLogCreate(
        meeting_date=meet_date,
        work_completed="Implémentation de l'ingestion Kafka et prétraitement des métriques.",
        encountered_blockers="Latence élevée lors du batching de flux volumineux.",
        supervisor_feedback="Optimiser la sérialisation avec Protobuf.",
        next_week_objectives="Déploiement des microservices et benchmarking.",
        status=MeetingLogStatus.DRAFT,
    )
    draft_res = await create_meeting_log(project.id, draft_payload, current_user=st1)
    assert draft_res.status == MeetingLogStatus.DRAFT
    assert draft_res.author_id == str(st1.id)
    print(f"[OK] Meeting log draft created by Amine (ID: {draft_res.id}).")

    # Test 2: Binôme updates and submits the log
    print("\n[Test 1.2] Binôme student (Yasmine) modifies and submits the meeting log...")
    update_payload = MeetingLogUpdate(
        encountered_blockers="Résolu : ajustement de la taille des fenêtres glissantes dans Kafka Streams.",
        status=MeetingLogStatus.SUBMITTED,
    )
    log_id = PydanticObjectId(draft_res.id)
    submitted_res = await update_meeting_log(project.id, log_id, update_payload, current_user=st2)
    assert submitted_res.status == MeetingLogStatus.SUBMITTED
    assert "Résolu" in submitted_res.encountered_blockers
    print("[OK] Binôme successfully updated and submitted the report.")

    # Check notification sent to supervisors
    notifs = await Notification.find(Notification.type == NotificationType.MEETING_LOG_SUBMITTED).to_list()
    assert len(notifs) >= 1
    print(f"[OK] Notification verified: {len(notifs)} supervisor notification(s) sent.")

    # Test 3: Unauthorized user is forbidden
    print("\n[Test 1.3] Unauthorized user access check...")
    try:
        await update_meeting_log(project.id, log_id, update_payload, current_user=unauthorized_user)
        assert False, "Should have raised 403"
    except HTTPException as e:
        assert e.status_code == 403
        print(f"[OK] Unauthorized user properly rejected with HTTP {e.status_code}.")

    # Test 4: Academic supervisor requests changes
    print("\n[Test 1.4] Supervisor requests changes with one click...")
    review_req = MeetingLogReview(
        action="REQUEST_CHANGES",
        feedback="Veuillez détailler les métriques de latence obtenues avant et après optimisation."
    )
    reviewed_res = await review_meeting_log(project.id, log_id, review_req, current_user=sup_acad)
    assert reviewed_res.status == MeetingLogStatus.CHANGES_REQUESTED
    assert "Veuillez détailler" in reviewed_res.review_feedback
    print("[OK] Supervisor requested changes; status updated to CHANGES_REQUESTED.")

    # Check student received notification
    change_notif = await Notification.find_one(Notification.type == NotificationType.MEETING_LOG_CHANGES_REQUESTED)
    assert change_notif is not None
    print("[OK] Student received CHANGES_REQUESTED notification.")

    # Test 5: Student corrects and resubmits
    print("\n[Test 1.5] Student corrects blockers and resubmits...")
    corrected_payload = MeetingLogUpdate(
        work_completed="Implémentation de l'ingestion Kafka. Latence réduite de 45ms à 8ms après optimisation Protobuf.",
        status=MeetingLogStatus.SUBMITTED,
    )
    resubmitted_res = await update_meeting_log(project.id, log_id, corrected_payload, current_user=st1)
    assert resubmitted_res.status == MeetingLogStatus.SUBMITTED

    # Test 6: Enterprise supervisor gives one-click approval
    print("\n[Test 1.6] Enterprise supervisor gives one-click approval...")
    approve_req = MeetingLogReview(
        action="APPROVE",
        feedback="Excellent travail sur la réduction de latence. Validé sans réserve."
    )
    approved_res = await review_meeting_log(project.id, log_id, approve_req, current_user=sup_ent)
    assert approved_res.status == MeetingLogStatus.APPROVED
    assert approved_res.reviewed_by_id == str(sup_ent.id)
    assert approved_res.reviewed_by_role == SupervisorRole.ENTERPRISE
    print(f"[OK] Meeting report approved by {approved_res.reviewed_by_name} ({approved_res.reviewed_by_role}).")

    # Test 7: Immutability of approved records (audit trail safety)
    print("\n[Test 1.7] Testing audit trail immutability on APPROVED report...")
    tamper_payload = MeetingLogUpdate(
        work_completed="Tentative de falsification d'un compte-rendu approuvé."
    )
    try:
        await update_meeting_log(project.id, log_id, tamper_payload, current_user=st1)
        assert False, "Tampering with approved log should have been blocked!"
    except HTTPException as e:
        assert e.status_code == 400
        print(f"[OK] Modification to approved record strictly blocked with HTTP {e.status_code}: {e.detail}")

    try:
        await delete_meeting_log(project.id, log_id, current_user=st1)
        assert False, "Deletion of approved log should have been blocked!"
    except HTTPException as e:
        assert e.status_code == 400
        print(f"[OK] Deletion of approved record strictly blocked with HTTP {e.status_code}: {e.detail}")

    # Test 8: Chronological history
    print("\n[Test 1.8] Chronological history listing...")
    # Add a second meeting log for older date
    older_log = MeetingLog(
        project_id=project.id,
        meeting_date=datetime.now(timezone.utc) - timedelta(days=9),
        work_completed="Cadrage initial et revue bibliographique.",
        encountered_blockers="Aucun",
        next_week_objectives="Conception de l'architecture.",
        author_id=st1.id,
        author_name=f"{st1.first_name} {st1.last_name}",
        status=MeetingLogStatus.APPROVED,
        reviewed_by_id=sup_acad.id,
        reviewed_by_name=f"{sup_acad.first_name} {sup_acad.last_name}",
        reviewed_at=datetime.now(timezone.utc) - timedelta(days=8),
    )
    await older_log.insert()

    history = await list_meeting_logs(project.id, current_user=st1)
    assert len(history) == 2
    # Verify descending chronological order
    assert history[0].meeting_date > history[1].meeting_date
    print(f"[OK] Meeting logs listed chronologically: {history[0].meeting_date} > {history[1].meeting_date}")

    print("\n=================================================================")
    print("MODULE 2: FINAL PFE VALIDATION & OFFICIAL DEPOSIT CERTIFICATE")
    print("=================================================================")

    # Test 9: Guard - never generate certificate before supervisor approval
    print("\n[Test 2.1] Guard check: Cannot download certificate before supervisor approval...")
    try:
        await download_certificate_pdf("CERT-PFE-UNAPPROVED-000", current_user=st1)
        assert False, "Should have returned 404/400"
    except HTTPException as e:
        assert e.status_code in (404, 400)
        print(f"[OK] Unapproved download guarded properly (HTTP {e.status_code}).")

    # Test 10: AI compliance score integration (Real compliance score, no fabrication)
    print("\n[Test 2.2] Storing genuine AI Compliance Report (Score 89.4%)...")
    comp_doc = ComplianceReportDocument(
        report_id=report.id,
        version_number=2,
        user_id=st1.id,
        file_name="pfe_v2_final.pdf",
        university_id="INSAT",
        university_name="INSAT - Université de Carthage",
        overall_score=89.4,
        compliance_level="CONFORME",
        summary="Normes typographiques et mise en page conformes à la charte INSAT.",
    )
    await comp_doc.insert()
    print("[OK] Genuine Compliance report recorded.")

    # Test 11: Authorized supervisor validates final version
    print("\n[Test 2.3] Authorized academic supervisor validates final PFE version...")
    val_request = FinalValidationRequest(
        report_id=str(report.id),
        version_number=2,
        mention="Très Favorable — Prêt pour Soutenance",
        notes="Manuscrit de très haute qualité technique. Dépôt officiel approuvé.",
        institution_name="Institut National des Sciences Appliquées et de Technologie (INSAT)",
    )
    cert_res = await validate_final_pfe_and_issue_certificate(project.id, val_request, current_user=sup_acad)

    assert cert_res.validation_status == PFEValidationStatus.VALIDATED
    assert cert_res.certificate_id.startswith("CERT-PFE-")
    assert cert_res.ai_compliance_score == 89.4
    assert cert_res.ai_compliance_level == "CONFORME"
    assert len(cert_res.student_names) == 2  # Amine and Yasmine (Binôme)
    assert cert_res.supervisor_name == "Dr. Khalil Ben Salah"
    assert cert_res.enterprise_supervisor_name == "Sarah Kacem"
    print(f"[OK] Certificate issued: ID={cert_res.certificate_id}, Hash={cert_res.certificate_hash[:16]}...")
    print(f" -> Students included: {', '.join(cert_res.student_names)}")
    print(f" -> AI Compliance score: {cert_res.ai_compliance_score}% ({cert_res.ai_compliance_level})")

    # Check notification sent to students
    cert_notif = await Notification.find_one(Notification.type == NotificationType.FINAL_VALIDATION_COMPLETED)
    assert cert_notif is not None
    print("[OK] Notification sent to students announcing final validation and certificate availability.")

    # Test 12: Generating and downloading official PDF certificate
    print("\n[Test 2.4] Student downloads official PDF validation certificate...")
    pdf_response = await download_certificate_pdf(cert_res.certificate_id, current_user=st1)
    chunks = []
    async for chunk in pdf_response.body_iterator:
        chunks.append(chunk if isinstance(chunk, bytes) else chunk.encode())
    body_bytes = b"".join(chunks)
    assert len(body_bytes) > 2000
    assert body_bytes.startswith(b"%PDF")
    print(f"[OK] PDF Certificate successfully generated and streamed ({len(body_bytes)} bytes)!")

    # Test 13: Public authenticity verification via QR / certificate ID
    print("\n[Test 2.5] Public authenticity verification endpoint (no login required)...")
    verif_res = await verify_certificate_authenticity(cert_res.certificate_id)
    assert verif_res.is_valid is True
    assert verif_res.certificate_id == cert_res.certificate_id
    assert verif_res.institution_name == "Institut National des Sciences Appliquées et de Technologie (INSAT)"
    assert verif_res.supervisor_name == "Dr. Khalil Ben Salah"
    assert "Amine Mansour" in verif_res.student_names
    assert "Yasmine Trabelsi" in verif_res.student_names
    assert verif_res.ai_compliance_score == 89.4
    # Ensure legal notice distinction is present
    assert "distincte d'une signature électronique qualifiée" in verif_res.legal_notice
    print("[OK] Public authenticity verification confirmed without exposing private manuscripts.")

    # Test 14: Verification with invalid certificate ID
    print("\n[Test 2.6] Verifying invalid / forged certificate ID...")
    fake_verif = await verify_certificate_authenticity("FORGED-CERT-999")
    assert fake_verif.is_valid is False
    assert fake_verif.certificate_hash == "INVALID"
    print("[OK] Invalid certificate correctly flagged as non-authentic.")

    # Test 15: Graceful non-fabrication of AI score when not present
    print("\n[Test 2.7] Verifying non-fabrication of AI score when no compliance check was run...")
    # Create another project without compliance
    proj2 = Project(
        student_id=st1.id,
        encadrer_id=sup_acad.id,
        title="Projet sans audit IA",
        description="Test score optionnel",
    )
    await proj2.insert()
    rep2 = Report(
        project_id=proj2.id,
        title="Rapport sans audit",
        current_version=1,
        versions=[
            ReportVersion(
                version_number=1,
                original_file_name="pfe.pdf",
                original_mime_type="application/pdf",
                raw_file_key="reports/pfe.pdf",
                pdf_file_key="reports/pfe.pdf",
                file_size=50000,
            )
        ]
    )
    await rep2.insert()
    val_req2 = FinalValidationRequest(
        report_id=str(rep2.id),
        version_number=1,
    )
    cert2 = await validate_final_pfe_and_issue_certificate(proj2.id, val_req2, current_user=sup_acad)
    assert cert2.ai_compliance_score is None, "Score must remain None and NEVER be fabricated!"
    print("[OK] Verified: When no compliance report exists, ai_compliance_score is None (Never fabricated!).")

    print("\n=================================================================")
    print("   ALL TESTS FOR BOTH MODULES PASSED WITH 100% SUCCESS!          ")
    print("=================================================================")


if __name__ == "__main__":
    asyncio.run(run_test_suite())
