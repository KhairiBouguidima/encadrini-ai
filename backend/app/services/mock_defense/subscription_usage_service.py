from datetime import datetime, timedelta, timezone
from typing import Dict, Any
from app.models.user import User

PLAN_LIMITS: Dict[str, Dict[str, Any]] = {
    "FREE": {
        "monthly_simulations_limit": 3,
        "max_questions_per_session": 5,
        "voice_mode_enabled": True,
        "stress_test_mode_enabled": False,
        "detailed_revision_plan_enabled": False,
    },
    "PREMIUM": {
        "monthly_simulations_limit": 25,
        "max_questions_per_session": 15,
        "voice_mode_enabled": True,
        "stress_test_mode_enabled": True,
        "detailed_revision_plan_enabled": True,
    }
}

class SubscriptionUsageService:
    @staticmethod
    async def ensure_usage_reset(user: User) -> User:
        """Reset monthly counters if more than 30 days have elapsed."""
        now = datetime.now(timezone.utc)
        last_reset = user.last_simulation_reset_at
        if not last_reset:
            user.last_simulation_reset_at = now
            user.monthly_simulations_count = 0
            await user.save()
            return user

        # Ensure timezone-aware comparison
        if last_reset.tzinfo is None:
            last_reset = last_reset.replace(tzinfo=timezone.utc)

        if now - last_reset >= timedelta(days=30):
            user.monthly_simulations_count = 0
            user.last_simulation_reset_at = now
            await user.save()

        return user

    @staticmethod
    def get_plan(user: User) -> str:
        plan = getattr(user, "subscription_plan", "FREE") or "FREE"
        if plan.upper() not in PLAN_LIMITS:
            return "FREE"
        return plan.upper()

    @classmethod
    async def get_usage_summary(cls, user: User) -> Dict[str, Any]:
        user = await cls.ensure_usage_reset(user)
        plan = cls.get_plan(user)
        limits = PLAN_LIMITS[plan]

        used = getattr(user, "monthly_simulations_count", 0) or 0
        limit = limits["monthly_simulations_limit"]
        remaining = max(0, limit - used)

        return {
            "plan": plan,
            "monthly_simulations_limit": limit,
            "monthly_simulations_used": used,
            "monthly_simulations_remaining": remaining,
            "max_questions_per_session": limits["max_questions_per_session"],
            "voice_mode_enabled": limits["voice_mode_enabled"],
            "stress_test_mode_enabled": limits["stress_test_mode_enabled"],
            "detailed_revision_plan_enabled": limits["detailed_revision_plan_enabled"],
            "can_start_simulation": remaining > 0 or user.role == "ADMIN",
        }

    @classmethod
    async def can_start_simulation(cls, user: User) -> bool:
        if user.role == "ADMIN":
            return True
        summary = await cls.get_usage_summary(user)
        return summary["can_start_simulation"]

    @classmethod
    async def can_use_mode(cls, user: User, mode: str) -> bool:
        if user.role == "ADMIN":
            return True
        plan = cls.get_plan(user)
        if mode.upper() == "STRESS_TEST":
            return PLAN_LIMITS[plan]["stress_test_mode_enabled"]
        return True

    @classmethod
    async def can_use_voice(cls, user: User) -> bool:
        if user.role == "ADMIN":
            return True
        plan = cls.get_plan(user)
        return PLAN_LIMITS[plan]["voice_mode_enabled"]

    @classmethod
    def get_max_questions(cls, user: User) -> int:
        plan = cls.get_plan(user)
        return PLAN_LIMITS[plan]["max_questions_per_session"]

    @classmethod
    async def record_simulation_used(cls, user: User) -> None:
        user = await cls.ensure_usage_reset(user)
        user.monthly_simulations_count = (getattr(user, "monthly_simulations_count", 0) or 0) + 1
        await user.save()

    @classmethod
    async def upgrade_plan(cls, user: User, target_plan: str) -> User:
        target = target_plan.upper()
        if target not in PLAN_LIMITS:
            target = "PREMIUM"
        user.subscription_plan = target
        if target == "PREMIUM":
            user.subscription_expires_at = datetime.now(timezone.utc) + timedelta(days=30)
        else:
            user.subscription_expires_at = None
        await user.save()
        return user
