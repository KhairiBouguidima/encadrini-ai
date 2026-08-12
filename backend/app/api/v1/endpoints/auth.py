import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException, status, Depends, BackgroundTasks
from app.core.security import get_password_hash, verify_password, create_access_token, create_refresh_token
from app.core.email import send_email_confirmation
from app.models.user import User
from app.schemas.auth import UserRegister, UserLogin, TokenResponse, UserResponse, MessageResponse
from app.api.deps import get_current_user

router = APIRouter()

@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(user_in: UserRegister, background_tasks: BackgroundTasks):
    existing_user = await User.find_one(User.email == user_in.email)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User with this email already exists"
        )

    confirmation_token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(confirmation_token.encode()).hexdigest()
    user = User(
        email=user_in.email,
        password_hash=get_password_hash(user_in.password),
        first_name=user_in.first_name,
        last_name=user_in.last_name,
        faculty=user_in.faculty,
        gender=user_in.gender,
        phone_number=user_in.phone_number,
        role=user_in.role,
        is_active=False,
        email_confirm_token_hash=token_hash,
        email_confirm_expires_at=datetime.now(timezone.utc) + timedelta(hours=24),
    )
    await user.insert()

    background_tasks.add_task(
        send_email_confirmation,
        user.email,
        user.first_name,
        confirmation_token,
    )

    return UserResponse(
        id=str(user.id),
        email=user.email,
        first_name=user.first_name,
        last_name=user.last_name,
        faculty=user.faculty,
        gender=user.gender,
        phone_number=user.phone_number,
        role=user.role,
        is_active=user.is_active
    )

@router.post("/login", response_model=TokenResponse)
async def login(credentials: UserLogin):
    user = await User.find_one(User.email == credentials.email)
    if not user or not verify_password(credentials.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please confirm your email before logging in"
        )
        
    access_token = create_access_token(user.id)
    refresh_token = create_refresh_token(user.id)
    
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=UserResponse(
            id=str(user.id),
            email=user.email,
            first_name=user.first_name,
            last_name=user.last_name,
            faculty=user.faculty,
            gender=user.gender,
            phone_number=user.phone_number,
            role=user.role,
            is_active=user.is_active
        )
    )

@router.get("/confirm-email", response_model=MessageResponse)
async def confirm_email(token: str):
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    user = await User.find_one(User.email_confirm_token_hash == token_hash)

    if not user:
        raise HTTPException(status_code=400, detail="Invalid confirmation link")

    if user.email_confirm_expires_at:
        expires_at = user.email_confirm_expires_at
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if expires_at < datetime.now(timezone.utc):
            raise HTTPException(status_code=400, detail="Confirmation link has expired")

    user.is_active = True
    user.email_confirm_token_hash = None
    user.email_confirm_expires_at = None
    user.email_confirmed_at = datetime.now(timezone.utc)
    await user.save()

    return MessageResponse(message="Email confirmed successfully")

@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    return UserResponse(
        id=str(current_user.id),
        email=current_user.email,
        first_name=current_user.first_name,
        last_name=current_user.last_name,
        faculty=current_user.faculty,
        gender=current_user.gender,
        phone_number=current_user.phone_number,
        role=current_user.role,
        is_active=current_user.is_active
    )
