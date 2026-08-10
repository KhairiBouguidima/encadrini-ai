from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie
from app.core.config import settings
from app.models.user import User
from app.models.project import Project, Invitation
from app.models.report import Report
from app.models.annotation import Annotation
from app.models.ai_analysis import AIAnalysis

async def init_db():
    client = AsyncIOMotorClient(settings.MONGODB_URL)
    await init_beanie(
        database=client[settings.MONGODB_DB_NAME],
        document_models=[User, Project, Invitation, Report, Annotation, AIAnalysis]
    )
