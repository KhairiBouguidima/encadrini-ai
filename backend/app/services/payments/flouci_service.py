import logging
from typing import Tuple
import httpx
from app.core.config import settings
from app.models.user import User
from app.models.payment import PaymentTransaction

logger = logging.getLogger("uvicorn.error")

class FlouciPaymentService:
    BASE_URL = "https://api.flouci.com/api"

    @staticmethod
    def is_configured() -> bool:
        return bool(settings.FLOUCI_APP_PUBLIC_KEY and settings.FLOUCI_APP_SECRET)

    @classmethod
    async def initiate_payment(
        cls,
        user: User,
        transaction: PaymentTransaction,
        frontend_url: str,
        backend_url: str
    ) -> Tuple[str, str, bool]:
        """
        Initiates a payment session with Flouci.
        Returns (pay_url, provider_payment_id, is_simulation).
        """
        if not cls.is_configured():
            logger.warning("[Flouci] API keys not configured. Running in simulated sandbox mode.")
            simulated_url = f"{frontend_url}/mock-defense?payment=simulated&tx_id={str(transaction.id)}&provider=flouci"
            return simulated_url, f"sim_flouci_{str(transaction.id)[:8]}", True

        url = f"{cls.BASE_URL}/generate_payment"
        payload = {
            "app_token": settings.FLOUCI_APP_PUBLIC_KEY,
            "app_secret": settings.FLOUCI_APP_SECRET,
            "amount": str(transaction.amount_millimes),
            "accept_card": "true",
            "session_timeout_secs": 1800,
            "success_link": f"{frontend_url}/mock-defense?payment=success&tx_id={str(transaction.id)}&provider=flouci",
            "fail_link": f"{frontend_url}/mock-defense?payment=failed&tx_id={str(transaction.id)}&provider=flouci",
            "developer_tracking_id": str(transaction.id),
        }

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                res = await client.post(url, json=payload)
                if res.status_code in (200, 201):
                    data = res.json()
                    if data.get("success"):
                        result = data.get("result", {})
                        pay_url = result.get("link")
                        payment_id = result.get("payment_id")
                        return pay_url, payment_id, False
                logger.error(f"[Flouci] Generate failed: {res.status_code} - {res.text}")
                simulated_url = f"{frontend_url}/mock-defense?payment=simulated&tx_id={str(transaction.id)}&provider=flouci"
                return simulated_url, f"sim_flouci_{str(transaction.id)[:8]}", True
        except Exception as e:
            logger.error(f"[Flouci] Error connecting: {e}")
            simulated_url = f"{frontend_url}/mock-defense?payment=simulated&tx_id={str(transaction.id)}&provider=flouci"
            return simulated_url, f"sim_flouci_{str(transaction.id)[:8]}", True

    @classmethod
    async def verify_payment(cls, payment_id: str) -> bool:
        """
        Verifies payment with Flouci's verification API.
        """
        if not cls.is_configured() or payment_id.startswith("sim_"):
            return True

        url = f"{cls.BASE_URL}/verify_payment/{payment_id}"
        headers = {
            "apppublic": settings.FLOUCI_APP_PUBLIC_KEY,
            "appsecret": settings.FLOUCI_APP_SECRET,
        }

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                res = await client.get(url, headers=headers)
                if res.status_code == 200:
                    data = res.json()
                    status = (data.get("result", {}).get("status") or "").upper()
                    return status == "SUCCESS"
                return False
        except Exception as e:
            logger.error(f"[Flouci] Error verifying payment: {e}")
            return False
