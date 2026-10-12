import re
from typing import Optional
from pydantic import BaseModel, EmailStr, field_validator
from app.models.user import UserRole

# ── Password policy ─────────────────────────────────────────────
_PASSWORD_MIN_LENGTH = 8
_PASSWORD_PATTERN = re.compile(r"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$")
_PASSWORD_ERROR = (
    "Le mot de passe doit contenir au moins 8 caractères, "
    "une majuscule, une minuscule et un chiffre."
)

def _validate_password(value: str) -> str:
    if len(value) < _PASSWORD_MIN_LENGTH:
        raise ValueError(_PASSWORD_ERROR)
    if not _PASSWORD_PATTERN.match(value):
        raise ValueError(_PASSWORD_ERROR)
    return value

# ── Allowed roles for public registration ────────────────────────
_PUBLIC_ROLES = {UserRole.STUDENT, UserRole.ENCADRER}

class UserRegister(BaseModel):
    email: EmailStr
    password: str
    first_name: str
    last_name: str
    faculty: Optional[str] = ""
    gender: Optional[str] = ""
    phone_number: Optional[str] = ""
    role: UserRole = UserRole.STUDENT

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        return _validate_password(v)

    @field_validator("role")
    @classmethod
    def restrict_role(cls, v: UserRole) -> UserRole:
        if v not in _PUBLIC_ROLES:
            raise ValueError("Le rôle demandé n'est pas autorisé lors de l'inscription.")
        return v

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    faculty: Optional[str] = None
    phone_number: Optional[str] = None
    openai_api_key: Optional[str] = None

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        return _validate_password(v)

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        return _validate_password(v)

class RefreshTokenRequest(BaseModel):
    refresh_token: str

class ResendConfirmationRequest(BaseModel):
    email: EmailStr

class UserResponse(BaseModel):
    id: str
    email: EmailStr
    first_name: str
    last_name: str
    faculty: str
    gender: str
    phone_number: str
    role: UserRole
    is_active: bool
    openai_api_key: Optional[str] = None

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserResponse

class MessageResponse(BaseModel):
    message: str
