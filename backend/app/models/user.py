from datetime import datetime
from enum import Enum
from typing import Optional
from beanie import Document, Indexed
from pydantic import Field, EmailStr

class UserRole(str, Enum):
    STUDENT = "STUDENT"
    ENCADRER = "ENCADRER"
    ADMIN = "ADMIN"

class User(Document):
    email: Indexed(EmailStr, unique=True)
    password_hash: str
    role: UserRole = UserRole.STUDENT
    first_name: str
    last_name: str
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "users"
