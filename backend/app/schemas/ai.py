from typing import List, Optional, Dict, Any
from pydantic import BaseModel

class AIAnalysisResponse(BaseModel):
    status: str
    report_id: str
    version_number: int
    scores: Optional[Dict[str, float]] = None
    missing_sections: List[str] = []
    corrections: List[Dict[str, Any]] = []
    generated_content: Optional[Dict[str, Any]] = None
