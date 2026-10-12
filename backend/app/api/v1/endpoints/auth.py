import jwt
import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from bson import ObjectId

from fastapi import APIRouter, HTTPException, status, Depends, BackgroundTasks
from app.core.config import settings
from app.core.security import get_password_hash, verify_password, create_access_token, create_refresh_token
from app.core.email import send_email_confirmation
from app.models.user import User, UserRole
from app.schemas.auth import (
    UserRegister, UserLogin, TokenResponse, UserResponse, 
    MessageResponse, UserUpdate, ForgotPasswordRequest, 
    ResetPasswordRequest, ChangePasswordRequest, RefreshTokenRequest,
    ResendConfirmationRequest
)
from app.api.deps import get_current_user

router = APIRouter()

async def check_and_link_pending_invitations(user: User):
    if user.role != UserRole.ENCADRER:
        return
    normalized_email = user.email.strip().lower()
    from app.models.project import Project, Invitation, InvitationStatus
    from app.models.notification import NotificationType
    from app.services.notification_service import notify

    pending_invitations = await Invitation.find(
        Invitation.encadrer_email == normalized_email,
        Invitation.status == InvitationStatus.PENDING
    ).to_list()

    for inv in pending_invitations:
        project = await Project.get(inv.project_id)
        if project:
            project.encadrer_id = user.id
            if not hasattr(project, "encadrer_ids") or project.encadrer_ids is None:
                project.encadrer_ids = []
            if user.id not in project.encadrer_ids:
                project.encadrer_ids.append(user.id)
            project.updated_at = datetime.now(timezone.utc)
            await project.save()

            inv.status = InvitationStatus.ACCEPTED
            await inv.save()

            encadrer_name = f"{user.first_name} {user.last_name}"
            await notify(
                user_id=project.student_id,
                notification_type=NotificationType.INVITATION_ACCEPTED,
                title="Encadreur connecté",
                message=f"{encadrer_name} ({user.email}) est connecté(e) et supervise désormais votre projet PFE.",
                link="/projects/me"
            )

@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(user_in: UserRegister, background_tasks: BackgroundTasks):
    normalized_email = user_in.email.strip().lower()
    existing_user = await User.find_one(User.email == normalized_email)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Un compte avec cette adresse email existe déjà."
        )

    is_auto_active = not bool(settings.SMTP_HOST)
    confirmation_token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(confirmation_token.encode()).hexdigest()

    user = User(
        email=normalized_email,
        password_hash=get_password_hash(user_in.password),
        first_name=user_in.first_name.strip(),
        last_name=user_in.last_name.strip(),
        faculty=user_in.faculty.strip() if user_in.faculty else "",
        gender=user_in.gender.strip() if user_in.gender else "",
        phone_number=user_in.phone_number.strip() if user_in.phone_number else "",
        role=user_in.role,
        is_active=True if is_auto_active else False,
        email_confirm_token_hash=None if is_auto_active else token_hash,
        email_confirm_expires_at=None if is_auto_active else (datetime.now(timezone.utc) + timedelta(hours=24)),
        email_confirmed_at=datetime.now(timezone.utc) if is_auto_active else None,
    )
    await user.insert()

    if user.role == UserRole.ENCADRER:
        await check_and_link_pending_invitations(user)

    if not is_auto_active:
        background_tasks.add_task(
            send_email_confirmation,
            user.email,
            user.first_name,
            confirmation_token,
        )

    access_token = create_access_token(user.id) if user.is_active else ""
    refresh_token = create_refresh_token(user.id) if user.is_active else ""

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
            is_active=user.is_active,
            openai_api_key=user.openai_api_key
        )
    )

@router.post("/login", response_model=TokenResponse)
async def login(credentials: UserLogin):
    normalized_email = credentials.email.strip().lower()
    user = await User.find_one(User.email == normalized_email)
    if not user or not verify_password(credentials.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email ou mot de passe incorrect."
        )
    
    if not user.is_active:
        # If no SMTP is configured, auto-activate user to prevent lockout
        if not settings.SMTP_HOST:
            user.is_active = True
            user.email_confirmed_at = datetime.now(timezone.utc)
            await user.save()
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Veuillez confirmer votre adresse email avant de vous connecter."
            )

    if user.role == UserRole.ENCADRER:
        await check_and_link_pending_invitations(user)
        
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
            is_active=user.is_active,
            openai_api_key=user.openai_api_key
        )
    )

@router.get("/confirm-email", response_model=MessageResponse)
async def confirm_email(token: str):
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    user = await User.find_one(User.email_confirm_token_hash == token_hash)

    if not user:
        raise HTTPException(status_code=400, detail="Lien de confirmation invalide ou déjà utilisé.")

    if user.email_confirm_expires_at:
        expires_at = user.email_confirm_expires_at
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if expires_at < datetime.now(timezone.utc):
            raise HTTPException(status_code=400, detail="Le lien de confirmation a expiré. Veuillez demander un nouvel email de confirmation.")

    user.is_active = True
    user.email_confirm_token_hash = None
    user.email_confirm_expires_at = None
    user.email_confirmed_at = datetime.now(timezone.utc)
    await user.save()

    return MessageResponse(message="Email confirmé avec succès ! Vous pouvez maintenant vous connecter.")

@router.post("/resend-confirmation", response_model=MessageResponse)
async def resend_confirmation(request: ResendConfirmationRequest, background_tasks: BackgroundTasks):
    """Resend an email confirmation link if the user account is not yet activated."""
    normalized_email = request.email.strip().lower()
    user = await User.find_one(User.email == normalized_email)

    # Always return a generic message to prevent email enumeration
    generic_msg = "Si cette adresse existe et n'est pas encore confirmée, un nouvel email de confirmation a été envoyé."

    if not user or user.is_active:
        return MessageResponse(message=generic_msg)

    if not settings.SMTP_HOST:
        # Auto-activate when SMTP is not configured (dev mode)
        user.is_active = True
        user.email_confirmed_at = datetime.now(timezone.utc)
        user.email_confirm_token_hash = None
        user.email_confirm_expires_at = None
        await user.save()
        return MessageResponse(message="Compte activé automatiquement (mode développement).")

    # Generate a new confirmation token
    new_token = secrets.token_urlsafe(32)
    new_token_hash = hashlib.sha256(new_token.encode()).hexdigest()

    user.email_confirm_token_hash = new_token_hash
    user.email_confirm_expires_at = datetime.now(timezone.utc) + timedelta(hours=24)
    await user.save()

    background_tasks.add_task(
        send_email_confirmation,
        user.email,
        user.first_name,
        new_token,
    )

    return MessageResponse(message=generic_msg)

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
        is_active=current_user.is_active,
        openai_api_key=current_user.openai_api_key
    )

@router.put("/me", response_model=UserResponse)
async def update_me(
    update_data: UserUpdate,
    current_user: User = Depends(get_current_user)
):
    update_dict = update_data.model_dump(exclude_unset=True)
    
    for key, value in update_dict.items():
        setattr(current_user, key, value)
        
    await current_user.save()
    
    return UserResponse(
        id=str(current_user.id),
        email=current_user.email,
        first_name=current_user.first_name,
        last_name=current_user.last_name,
        faculty=current_user.faculty,
        gender=current_user.gender,
        phone_number=current_user.phone_number,
        role=current_user.role,
        is_active=current_user.is_active,
        openai_api_key=current_user.openai_api_key
    )

@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(request: RefreshTokenRequest):
    try:
        payload = jwt.decode(
            request.refresh_token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
        )
        token_type = payload.get("type")
        if token_type != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")
        
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
            
        user = await User.get(ObjectId(user_id))
        if not user or not user.is_active:
            raise HTTPException(status_code=401, detail="User not found or inactive")

        access_token = create_access_token(user.id)
        refresh_token_new = create_refresh_token(user.id)
        
        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token_new,
            user=UserResponse(
                id=str(user.id),
                email=user.email,
                first_name=user.first_name,
                last_name=user.last_name,
                faculty=user.faculty,
                gender=user.gender,
                phone_number=user.phone_number,
                role=user.role,
                is_active=user.is_active,
                openai_api_key=user.openai_api_key
            )
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Could not validate credentials")

@router.post("/forgot-password", response_model=MessageResponse)
async def forgot_password(request: ForgotPasswordRequest, background_tasks: BackgroundTasks):
    from app.core.email import send_password_reset_email

    normalized_email = request.email.strip().lower()
    user = await User.find_one(User.email == normalized_email)
    if not user:
        # Prevent email enumeration by returning a generic success message
        return MessageResponse(message="If this email exists, a reset link has been sent.")
        
    reset_token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(reset_token.encode()).hexdigest()
    
    user.password_reset_token_hash = token_hash
    user.password_reset_expires_at = datetime.now(timezone.utc) + timedelta(hours=1)
    await user.save()
    
    background_tasks.add_task(
        send_password_reset_email,
        user.email,
        user.first_name,
        reset_token
    )
    
    return MessageResponse(message="If this email exists, a reset link has been sent.")

@router.post("/reset-password", response_model=MessageResponse)
async def reset_password(request: ResetPasswordRequest):
    token_hash = hashlib.sha256(request.token.encode()).hexdigest()
    user = await User.find_one(User.password_reset_token_hash == token_hash)
    
    if not user:
        raise HTTPException(status_code=400, detail="Invalid reset link")
        
    if user.password_reset_expires_at:
        expires_at = user.password_reset_expires_at
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if expires_at < datetime.now(timezone.utc):
            raise HTTPException(status_code=400, detail="Reset link has expired")
            
    user.password_hash = get_password_hash(request.new_password)
    user.password_reset_token_hash = None
    user.password_reset_expires_at = None
    await user.save()
    
    return MessageResponse(message="Password reset successfully")

@router.post("/change-password", response_model=MessageResponse)
async def change_password(
    request: ChangePasswordRequest, 
    current_user: User = Depends(get_current_user)
):
    if not verify_password(request.current_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Incorrect password")
        
    current_user.password_hash = get_password_hash(request.new_password)
    await current_user.save()
    
    return MessageResponse(message="Password changed successfully")

@router.post("/logout", response_model=MessageResponse)
async def logout(current_user: User = Depends(get_current_user)):
    """Logout endpoint. Clears session on the client side.
    Server-side token revocation would require a token blacklist store (e.g. Redis).
    This endpoint standardizes the logout flow and can be extended later."""
    return MessageResponse(message="Déconnexion réussie.")
