from typing import List, Optional
from fastapi import APIRouter, HTTPException, status, Depends
from beanie import PydanticObjectId

from app.models.user import User, UserRole
from app.models.project import Project
from app.models.report import Report
from app.models.ai_analysis import AIAnalysis
from app.api.deps import get_current_user
from app.schemas.ai import AIAnalysisResponse

router = APIRouter()

@router.get("/reports/{report_id}/version/{version_number}", response_model=AIAnalysisResponse)
async def get_ai_analysis(
    report_id: PydanticObjectId,
    version_number: int,
    current_user: User = Depends(get_current_user)
):
    """Fetch the AI analysis results for a specific report version."""
    report = await Report.get(report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found.")

    # IDOR guard: verify the requesting user owns or supervises this project
    project = await Project.get(report.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found.")

    if (
        project.student_id != current_user.id
        and project.encadrer_id != current_user.id
        and current_user.role != UserRole.ADMIN
    ):
        raise HTTPException(status_code=403, detail="Access denied.")

    # Check version exists
    version = next((v for v in report.versions if v.version_number == version_number), None)
    if not version:
        raise HTTPException(status_code=404, detail=f"Version {version_number} not found.")

    analysis = await AIAnalysis.find_one(
        AIAnalysis.report_id == report.id,
        AIAnalysis.version_number == version_number
    )
    if not analysis:
        return AIAnalysisResponse(
            status=version.ai_analysis_status.value,
            report_id=str(report.id),
            version_number=version_number,
            scores=None,
            missing_sections=[],
            corrections=[],
            generated_content=None,
        )

    return AIAnalysisResponse(
        status=version.ai_analysis_status.value,
        report_id=str(report.id),
        version_number=version_number,
        scores={
            "linguistic": analysis.scores.linguistic,
            "structural": analysis.scores.structural,
            "coherence": analysis.scores.coherence,
            "overall_quality": analysis.scores.overall_quality,
        },
        missing_sections=analysis.missing_sections,
        corrections=[
            {
                "page": c.page,
                "original": c.original,
                "suggestion": c.suggestion,
                "explanation": c.explanation,
            } for c in analysis.corrections
        ],
        generated_content={
            "summary": analysis.generated_content.summary,
            "abstract": analysis.generated_content.abstract,
            "keywords": analysis.generated_content.keywords,
            "jury_questions": analysis.generated_content.jury_questions,
        }
    )
