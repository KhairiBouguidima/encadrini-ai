from datetime import datetime
from pydantic import BaseModel

class AnnotationCreate(BaseModel):
    version_number: int
    page_number: int
    content: str

class AnnotationResponse(BaseModel):
    id: str
    report_id: str
    version_number: int
    page_number: int
    author_id: str
    content: str
    created_at: datetime
