import asyncio
from app.core.db import init_db
from app.models.user import User

async def main():
    await init_db()
    users = await User.find_all().to_list()
    print(f"Total users: {len(users)}")
    for u in users:
        u.is_active = True
        await u.save()
        print(f"- {u.email} | Role: {u.role} | Active: {u.is_active}")

if __name__ == "__main__":
    asyncio.run(main())

