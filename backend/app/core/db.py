# Database initialisation utilities.
"""
Improved DB module with a singleton AsyncIOMotorClient, proper shutdown handling,
and clear logging. This resolves connection‑pool exhaustion caused by the previous
implementation which instantiated a new client on every call (including inside
background workers).
"""

import logging
from typing import Optional

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
from app.models.payment import PaymentTransaction
from app.models.assistance import AssistanceRequest

logger = logging.getLogger("uvicorn.error")

_client: Optional[AsyncIOMotorClient] = None


def get_masked_url(url: str) -> str:
    """Return a URL with password masked for safe logging."""
    try:
        from urllib.parse import urlparse
        parsed = urlparse(url)
        if parsed.password:
            netloc = parsed.netloc.replace(parsed.password, "******")
            return parsed._replace(netloc=netloc).geturl()
        return url
    except Exception:
        return "mongodb://***"


def get_client() -> AsyncIOMotorClient:
    """Return a cached ``AsyncIOMotorClient`` instance.

    The client is created lazily on first call using the settings defined in
    ``app.core.config``.  Multiple calls will return the same instance, which is
    safe to share across async contexts.
    """
    global _client
    if _client is None:
        masked_url = get_masked_url(settings.MONGODB_URL)
        logger.info(
            f"Connecting to MongoDB at: {masked_url} (db: '{settings.MONGODB_DB_NAME}')"
        )
        _client = AsyncIOMotorClient(
            settings.MONGODB_URL, serverSelectionTimeoutMS=10_000
        )
    return _client


async def close_client() -> None:
    """Close the global client – called on FastAPI shutdown."""
    global _client
    if _client is not None:
        _client.close()
        _client = None


async def init_db() -> None:
    """Initialise the database and Beanie ODM.

    This function is intended to be called once in the FastAPI lifespan.  It
    reuses the singleton client from :func:`get_client` and performs a quick
    ``ping`` to ensure connectivity.  The function also runs a light migration
    step to drop a legacy unique index that conflicted with the new schema.
    """
    client = get_client()
    try:
        await client.admin.command("ping")
        logger.info("✅ MongoDB connected successfully!")
    except Exception as exc:
        masked_url = get_masked_url(settings.MONGODB_URL)
        logger.error(
            f"\n{'='*60}\n"
            f"❌ FAILED TO CONNECT TO MONGODB: {exc}\n"
            f"Target URL: {masked_url}\n"
            f"Check environment variables and network access.\n"
            f"{'='*60}"
        )
        raise

    db = client[settings.MONGODB_DB_NAME]

    # Safe migration: drop legacy unique index if present.
    try:
        indexes = await db["reports"].index_information()
        if "project_id_1" in indexes and indexes["project_id_1"].get("unique"):
            await db["reports"].drop_index("project_id_1")
            logger.info("[db-migration] Dropped legacy unique index on reports.project_id")
    except Exception as exc:  # pragma: no cover – non‑critical migration step
        logger.debug(f"[db-migration] Index check ignored: {exc}")

    await init_beanie(
        database=db,
        document_models=[
            User,
            Project,
            Invitation,
            Report,
            Annotation,
            Evaluation,
            AIAnalysis,
            Notification,
            MockDefenseSimulation,
            ComplianceReportDocument,
            MeetingLog,
            PFEValidationCertificate,
            PaymentTransaction,
            AssistanceRequest,
        ],
    )
    logger.info("✅ Beanie ODM initialized successfully!")
