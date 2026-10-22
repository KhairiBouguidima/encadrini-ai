from datetime import datetime
from enum import Enum
from typing import List, Optional, Dict, Any
from beanie import Document, PydanticObjectId, Indexed
from pydantic import BaseModel, Field


class IssueSeverity(str, Enum):
    ERROR = "ERROR"
    WARNING = "WARNING"
    INFO = "INFO"


class IssueCategory(str, Enum):
    TYPOGRAPHY = "TYPOGRAPHY"
    MARGINS_SPACING = "MARGINS_SPACING"
    HEADINGS = "HEADINGS"
    FIGURES_TABLES = "FIGURES_TABLES"
    TOC_PAGINATION = "TOC_PAGINATION"
    STRUCTURE_SEMANTIC = "STRUCTURE_SEMANTIC"


class ComplianceIssue(BaseModel):
    id: str
    category: IssueCategory
    severity: IssueSeverity
    title: str
    message: str
    pages: List[int] = Field(default_factory=list)
    suggestion: str
    expected: Optional[str] = None
    found: Optional[str] = None
    fixable_by_smart_fix: bool = False


class ComplianceCategoryScore(BaseModel):
    score: float
    status: str  # "PASS", "WARNING", "FAIL"
    total_checks: int
    passed_checks: int
    issues_count: int


class ComplianceReportDocument(Document):
    report_id: Optional[Indexed(PydanticObjectId)] = None
    version_number: Optional[int] = None
    user_id: Indexed(PydanticObjectId)
    file_name: str
    university_id: str
    university_name: str
    overall_score: float
    compliance_level: str  # "CONFORME", "CONFORME_AVEC_RESERVES", "NON_CONFORME"
    summary: str
    category_scores: Dict[str, ComplianceCategoryScore] = Field(default_factory=dict)
    issues: List[ComplianceIssue] = Field(default_factory=list)
    stats: Dict[str, Any] = Field(default_factory=dict)
    custom_rules: Optional[Dict[str, Any]] = None
    docx_fixed_file_key: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "compliance_reports"
