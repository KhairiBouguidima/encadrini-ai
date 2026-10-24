import logging
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

logger = logging.getLogger("uvicorn.error")

def get_masked_url(url: str) -> str:
    try:
        from urllib.parse import urlparse
        parsed = urlparse(url)
        if parsed.password:
            netloc = parsed.netloc.replace(parsed.password, "******")
            return parsed._replace(netloc=netloc).geturl()
        return url
    except Exception:
        return "mongodb://***"

async def init_db():
    masked_url = get_masked_url(settings.MONGODB_URL)
    logger.info(f"Connecting to MongoDB at: {masked_url} (db: '{settings.MONGODB_DB_NAME}')")

    if "localhost" in settings.MONGODB_URL or "127.0.0.1" in settings.MONGODB_URL:
        logger.warning(
            "⚠️ MONGODB_URL is pointing to localhost! If deploying on Render, "
            "make sure to configure MONGODB_URL in your Render Environment Variables."
        )

    client = AsyncIOMotorClient(
        settings.MONGODB_URL,
        serverSelectionTimeoutMS=10000
    )

    try:
        # Check connection ping with timeout to fail fast with a helpful log
        await client.admin.command('ping')
        logger.info("✅ MongoDB connected successfully!")
    except Exception as e:
        logger.error(
            f"\n{'='*60}\n"
            f"❌ FAILED TO CONNECT TO MONGODB: {e}\n"
            f"Target URL: {masked_url}\n"
            f"Common Render issues:\n"
            f"1. Did you set MONGODB_URL in Render Dashboard -> Environment Variables?\n"
            f"2. MongoDB Atlas Network Access: You MUST add '0.0.0.0/0' (Allow Access from Anywhere) in MongoDB Atlas Network Access tab, because Render IPs are dynamic.\n"
            f"3. Password special characters: encode characters like '@' as '%40' in the URI.\n"
            f"{'='*60}"
        )
        raise e

    db = client[settings.MONGODB_DB_NAME]
    
    # Safe migration: ensure reports.project_id is not uniquely constrained
    try:
        indexes = await db["reports"].index_information()
        if "project_id_1" in indexes and indexes["project_id_1"].get("unique"):
            await db["reports"].drop_index("project_id_1")
    except Exception as e:
        logger.info(f"[db-migration] Index check note: {e}")

    await init_beanie(
        database=db,
        document_models=[
            User, Project, Invitation, Report, Annotation, 
            Evaluation, AIAnalysis, Notification, MockDefenseSimulation,
            ComplianceReportDocument, MeetingLog, PFEValidationCertificate
        ]
    )
    logger.info("✅ Beanie ODM initialized successfully!")
