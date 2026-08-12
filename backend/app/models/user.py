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
    faculty: str = ""
    gender: str = ""
    phone_number: str = ""
    is_active: bool = False
    email_confirm_token_hash: Optional[str] = None
    email_confirm_expires_at: Optional[datetime] = None
    email_confirmed_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "users"
