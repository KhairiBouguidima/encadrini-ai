import os
from typing import Union
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str = "Encadrini Platform API"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = "encadrini_super_secret_jwt_key_change_in_production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    FRONTEND_URL: str = "https://encadrini-ai.vercel.app"
    CORS_ORIGINS: list[str] = [ "https://encadrini-ai.vercel.app" ]

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, list[str]]) -> list[str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",") if i.strip()]
        return v

    MONGODB_URL: str = "mongodb://localhost:27017"
    MONGODB_DB_NAME: str = "encadrini_db"

    MINIO_ENDPOINT: str = "localhost:9000"
    MINIO_ACCESS_KEY: str = "minioadmin"
    MINIO_SECRET_KEY: str = "minioadmin"
    MINIO_BUCKET_NAME: str = "encadrini-reports"
    MINIO_SECURE: bool = False

    AI_PROVIDER: str = "openai"
    OPENAI_API_KEY: str = "sk-fake-key-for-dev"

    REQUIRE_EMAIL_CONFIRMATION: bool = True

    # Email Service Providers (Loaded strictly from .env)
    # Resend / Brevo HTTPS APIs bypass Render Free tier SMTP port blocking (ports 25, 465, 587)
    RESEND_API_KEY: str = ""
    RESEND_FROM_EMAIL: str = "Encadrini <onboarding@resend.dev>"
    BREVO_API_KEY: str = ""
    BREVO_FROM_EMAIL: str = ""

    # SMTP Configuration (Loaded strictly from .env)
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USERNAME: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM_EMAIL: str = ""
    SMTP_USE_TLS: bool = True

    model_config = SettingsConfigDict(
        env_file=(
            os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), ".env"),
            ".env"
        ),
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )

settings = Settings()
