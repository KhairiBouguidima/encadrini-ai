from datetime import datetime
from beanie import Document, PydanticObjectId, Indexed
from pydantic import Field

class Annotation(Document):
    report_id: Indexed(PydanticObjectId)
    version_number: int
    page_number: int
    author_id: PydanticObjectId
    content: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "annotations"
