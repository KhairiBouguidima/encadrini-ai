from datetime import datetime
from typing import Optional
from pydantic import BaseModel

class AnnotationCreate(BaseModel):
    version_number: int
    page_number: int
    content: str
    selected_text: Optional[str] = None
    x: Optional[float] = None
    y: Optional[float] = None
    width: Optional[float] = None
    height: Optional[float] = None

class AnnotationUpdate(BaseModel):
    content: str

class AnnotationResponse(BaseModel):
    id: str
    report_id: str
    version_number: int
    page_number: int
    author_id: str
    author_name: Optional[str] = None
    author_role: Optional[str] = None
    content: str
    selected_text: Optional[str] = None
    x: Optional[float] = None
    y: Optional[float] = None
    width: Optional[float] = None
    height: Optional[float] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
