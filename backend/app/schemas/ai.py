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

class ChatMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str

class ChatRequest(BaseModel):
    report_id: str
    version_number: int
    messages: List[ChatMessage]

class ChatResponse(BaseModel):
    reply: str

class CheckAIRequest(BaseModel):
    text: str

class CheckAIResponse(BaseModel):
    ai_score: float        # 0.0 to 100.0 percentage
    label: str             # "Faible", "Modéré", "Élevé"
    rewritten: Optional[str] = None
