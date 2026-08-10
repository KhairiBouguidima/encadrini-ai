import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie, PydanticObjectId
from app.models.user import User
from app.models.project import Project, Invitation
from app.models.report import Report, ReportVersion, AIAnalysisStatus
from app.models.annotation import Annotation
from app.models.ai_analysis import AIAnalysis, AnalysisScores, CorrectionIssue, GeneratedContent
from app.core.security import get_password_hash, verify_password
from app.ai.ai_provider import get_ai_provider
from app.workers.ai_analysis_worker import _compute_score


async def full_pipeline_test():
    client = AsyncIOMotorClient("mongodb://localhost:27017")
    await init_beanie(
        database=client["encadrini_test_db"],
        document_models=[User, Project, Invitation, Report, Annotation, AIAnalysis],
    )

    # 1. Argon2 password test
    pwd = "Argon2TestPassword!2026"
    h = get_password_hash(pwd)
    assert h.startswith("$argon2")
    assert verify_password(pwd, h)
    assert not verify_password("wrong", h)
    print("1. Argon2id hashing: OK")

    # 2. AI Provider mock analysis
    provider = get_ai_provider()
    result = await provider.analyze_report("Sample PFE report text for testing.")
    assert "scores" in result
    assert "generated_content" in result
    ling = result["scores"]["linguistic"]
    struct = result["scores"]["structural"]
    coher = result["scores"]["coherence"]
    print(f"2. AI Provider mock analysis: OK  (L={ling}, S={struct}, C={coher})")

    # 3. Deterministic score computation
    score = _compute_score(86.0, 78.0, 84.0)
    expected = round(0.30 * 86.0 + 0.35 * 78.0 + 0.35 * 84.0, 2)
    assert score == expected, f"{score} != {expected}"
    print(f"3. Score computation: {score} == {expected}: OK")

    # 4. AI Analysis persistence
    await AIAnalysis.find_all().delete()
    analysis = AIAnalysis(
        report_id=PydanticObjectId(),
        version_number=1,
        scores=AnalysisScores(
            linguistic=86, structural=78, coherence=84, overall_quality=score
        ),
        missing_sections=["Etat de l art"],
        corrections=[
            CorrectionIssue(
                page=2, original="consiste", suggestion="consiste", explanation="Accord"
            )
        ],
        generated_content=GeneratedContent(
            summary="Resume test",
            abstract="Abstract test",
            keywords=["FastAPI", "React"],
            jury_questions=["Question test?"],
        ),
    )
    await analysis.insert()
    fetched = await AIAnalysis.get(analysis.id)
    assert fetched.scores.overall_quality == score
    assert len(fetched.generated_content.jury_questions) == 1
    print("4. AI Analysis persistence & retrieval: OK")

    print()
    print("=== ALL PIPELINE TESTS PASSED ===")


asyncio.run(full_pipeline_test())
