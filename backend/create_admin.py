import asyncio
import sys
from datetime import datetime
from app.core.db import init_db
from app.core.security import get_password_hash
from app.models.user import User, UserRole

async def create_or_promote_admin(email: str, password: str = "admin123", first_name: str = "Admin", last_name: str = "Encadrini"):
    await init_db()
    normalized_email = email.strip().lower()
    user = await User.find_one(User.email == normalized_email)
    
    if user:
        user.role = UserRole.ADMIN
        user.is_active = True
        user.email_confirmed_at = datetime.utcnow()
        if password:
            user.password_hash = get_password_hash(password)
        await user.save()
        print(f"User '{normalized_email}' has been PROMOTED to ADMIN successfully!")
    else:
        user = User(
            email=normalized_email,
            password_hash=get_password_hash(password),
            role=UserRole.ADMIN,
            first_name=first_name,
            last_name=last_name,
            faculty="Administration",
            is_active=True,
            email_confirmed_at=datetime.utcnow()
        )
        await user.insert()
        print(f"ADMIN user '{normalized_email}' has been CREATED successfully!")
    
    print(f"Credentials:\n  Email: {normalized_email}\n  Password: {password}\n  Role: ADMIN")

if __name__ == "__main__":
    email = sys.argv[1] if len(sys.argv) > 1 else "admin@encadrini.tn"
    pwd = sys.argv[2] if len(sys.argv) > 2 else "admin123"
    asyncio.run(create_or_promote_admin(email, pwd))
