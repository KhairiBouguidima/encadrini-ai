from datetime import datetime
from typing import Optional
from beanie import Document, PydanticObjectId, Indexed
from pydantic import Field

class Annotation(Document):
    report_id: Indexed(PydanticObjectId)
    version_number: int
    page_number: int
    author_id: PydanticObjectId
    content: str
    selected_text: Optional[str] = None
    x: Optional[float] = None
    y: Optional[float] = None
    width: Optional[float] = None
    height: Optional[float] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None

    class Settings:
        name = "annotations"
