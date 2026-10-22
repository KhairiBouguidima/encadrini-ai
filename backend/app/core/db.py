from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie
from app.core.config import settings
from app.models.user import User
from app.models.project import Project, Invitation
from app.models.report import Report
from app.models.annotation import Annotation
from app.models.evaluation import Evaluation
from app.models.ai_analysis import AIAnalysis
from app.models.notification import Notification
from app.models.mock_defense import MockDefenseSimulation
from app.models.compliance import ComplianceReportDocument
from app.models.meeting_log import MeetingLog
from app.models.certificate import PFEValidationCertificate

async def init_db():
    client = AsyncIOMotorClient(settings.MONGODB_URL)
    db = client[settings.MONGODB_DB_NAME]
    
    # Safe migration: ensure reports.project_id is not uniquely constrained
    try:
        indexes = await db["reports"].index_information()
        if "project_id_1" in indexes and indexes["project_id_1"].get("unique"):
            await db["reports"].drop_index("project_id_1")
    except Exception as e:
        print(f"[db-migration] Index check note: {e}")

    await init_beanie(
        database=db,
        document_models=[
            User, Project, Invitation, Report, Annotation, 
            Evaluation, AIAnalysis, Notification, MockDefenseSimulation,
            ComplianceReportDocument, MeetingLog, PFEValidationCertificate
        ]
    )
