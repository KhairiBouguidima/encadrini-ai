from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from app.models.compliance import IssueSeverity, IssueCategory, ComplianceIssue, ComplianceCategoryScore


class UniversityProfileSchema(BaseModel):
    id: str
    name: str
    full_name: str
    description: str
    badge_color: str
    body_font_families: List[str]
    body_font_size: float
    body_font_size_tolerance: float = 0.5
    line_spacing: float = 1.5
    margins_cm: Dict[str, float]
    alignment: str = "JUSTIFY"
    heading1_size: float = 16.0
    heading2_size: float = 14.0
    heading3_size: float = 12.0
    figure_caption_pattern: str
    figure_caption_example: str
    table_caption_pattern: str
    table_caption_example: str
    page_numbering_preliminary: str = "ROMAN"
    page_numbering_body: str = "ARABIC"
    required_sections: List[str]


class ComplianceCheckRequest(BaseModel):
    report_id: Optional[str] = None
    version_number: Optional[int] = None
    university_id: str
    custom_rules: Optional[Dict[str, Any]] = None


class ComplianceCheckResponse(BaseModel):
    id: str
    report_id: Optional[str] = None
    version_number: Optional[int] = None
    file_name: str
    university_id: str
    university_name: str
    overall_score: float
    compliance_level: str
    summary: str
    category_scores: Dict[str, ComplianceCategoryScore]
    issues: List[ComplianceIssue]
    stats: Dict[str, Any]
    can_smart_fix_docx: bool = False
    created_at: str


class CustomCharterParseResponse(BaseModel):
    success: bool
    extracted_profile: UniversityProfileSchema
    raw_guidelines_summary: str
    detected_rules: List[str]


class SmartFixResponse(BaseModel):
    success: bool
    message: str
    file_name: str
    download_url: str
    total_fixes_applied: int
    fixes_summary: List[str]
