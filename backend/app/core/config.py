import os
from typing import Union
from pydantic import field_validator
from pydantic_settings import BaseSettings

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
    RESEND_API_KEY: str = ""
    BREVO_API_KEY: str = ""
    EMAIL_FROM: str = "Encadrini <onboarding@resend.dev>"

    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USERNAME: str = "encadriniai@gmail.com"
    SMTP_PASSWORD: str = "usdqzwaswcvmzyzz"
    SMTP_FROM_EMAIL: str = "no-reply@encadrini.local"
    SMTP_USE_TLS: bool = True

    class Config:
        env_file = ".env"
        case_sensitive = True

settings = Settings()
