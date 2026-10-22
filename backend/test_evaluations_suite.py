import asyncio
import os
import sys
from datetime import datetime

# Setup path
sys.path.insert(0, os.path.abspath("."))

from app.models.evaluation import ApprovalStatus, Evaluation
from app.schemas.evaluation import EvaluationCreate, EvaluationUpdate, EvaluationResponse
from app.models.annotation import Annotation
from app.schemas.annotation import AnnotationResponse


async def test_schemas():
    print("--- 1. Testing Evaluation Validation ---")
    # Valid evaluation
    ev = EvaluationCreate(
        report_id="60c72b2f9b1d8b2bad000001",
        version_number=1,
        grade=17.5,
        feedback="Excellent travail sur la méthodologie.",
        approval_status=ApprovalStatus.APPROVED_FOR_DEFENSE,
    )
    assert ev.grade == 17.5
    assert ev.approval_status == ApprovalStatus.APPROVED_FOR_DEFENSE
    print("[OK] Valid evaluation created successfully.")

    # Invalid grade > 20
    try:
        EvaluationCreate(
            report_id="60c72b2f9b1d8b2bad000001",
            version_number=1,
            grade=21.0,
        )
        assert False, "Should have failed with grade > 20"
    except ValueError as e:
        print("[OK] Grade > 20 correctly rejected:", e)

    # Invalid grade < 0
    try:
        EvaluationCreate(
            report_id="60c72b2f9b1d8b2bad000001",
            version_number=1,
            grade=-1.0,
        )
        assert False, "Should have failed with grade < 0"
    except ValueError as e:
        print("[OK] Grade < 0 correctly rejected:", e)

    # Test Annotation Response with author info
    print("\n--- 2. Testing Annotation Response Author Fields ---")
    ann_resp = AnnotationResponse(
        id="ann_123",
        report_id="rep_123",
        version_number=1,
        page_number=3,
        author_id="usr_456",
        author_name="Dr. Moncef Ben Salem",
        author_role="Encadreur",
        content="Préciser l'architecture MVC.",
        created_at=datetime.utcnow(),
    )
    assert ann_resp.author_name == "Dr. Moncef Ben Salem"
    assert ann_resp.author_role == "Encadreur"
    print("[OK] Annotation response includes real author name and role.")

    print("\n--- 3. Testing PDF ReportLab Flowable Generation ---")
    from reportlab.lib.pagesizes import A4
    from reportlab.platypus import SimpleDocTemplate, Paragraph
    from reportlab.lib.styles import getSampleStyleSheet
    import io

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4)
    styles = getSampleStyleSheet()
    doc.build([Paragraph("Test Evaluation Export", styles['Normal'])])
    assert len(buf.getvalue()) > 100
    print("[OK] In-memory ReportLab PDF generated successfully with length:", len(buf.getvalue()))

    print("\nALL VERIFICATION TESTS PASSED SUCCESSFULLY!")


if __name__ == "__main__":
    asyncio.run(test_schemas())
