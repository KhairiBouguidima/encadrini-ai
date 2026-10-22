from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from beanie import PydanticObjectId

# Fix Beanie PydanticObjectId OpenAPI generation in Pydantic 2.10+
@classmethod
def _object_id_json_schema(cls, _core_schema, handler):
    return {"type": "string", "example": "507f1f77bcf86cd799439011"}
PydanticObjectId.__get_pydantic_json_schema__ = _object_id_json_schema

from app.core.config import settings
from app.core.db import init_db
from app.api.v1.endpoints import auth, projects, reports, annotations, ai, admin, notifications, evaluations, mock_defense, compliance, meeting_logs, certificates

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup lifecycle
    await init_db()
    yield

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3})(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix=f"{settings.API_V1_STR}/auth", tags=["auth"])
app.include_router(projects.router, prefix=f"{settings.API_V1_STR}/projects", tags=["projects"])
app.include_router(reports.router, prefix=f"{settings.API_V1_STR}/reports", tags=["reports"])
app.include_router(annotations.router, prefix=f"{settings.API_V1_STR}/annotations", tags=["annotations"])
app.include_router(evaluations.router, prefix=f"{settings.API_V1_STR}/evaluations", tags=["evaluations"])
app.include_router(ai.router, prefix=f"{settings.API_V1_STR}/ai", tags=["ai"])
app.include_router(mock_defense.router, prefix=f"{settings.API_V1_STR}/mock-defense", tags=["mock-defense"])
app.include_router(compliance.router, prefix=f"{settings.API_V1_STR}/compliance", tags=["compliance"])
app.include_router(meeting_logs.router, prefix=f"{settings.API_V1_STR}", tags=["meeting-logs"])
app.include_router(certificates.router, prefix=f"{settings.API_V1_STR}", tags=["certificates"])
app.include_router(admin.router, prefix=f"{settings.API_V1_STR}/admin", tags=["admin"])
app.include_router(notifications.router, prefix=f"{settings.API_V1_STR}/notifications", tags=["notifications"])

@app.get("/")
async def root():
    return {
        "status": "ok",
        "project": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "docs": "/docs",
        "api": settings.API_V1_STR,
    }

@app.get("/health")
async def health_check():
    return {"status": "ok", "project": settings.PROJECT_NAME, "version": settings.VERSION}
