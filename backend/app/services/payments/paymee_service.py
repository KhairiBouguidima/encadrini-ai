import logging
from typing import Tuple
import httpx
from app.core.config import settings
from app.models.user import User
from app.models.payment import PaymentTransaction

logger = logging.getLogger("uvicorn.error")

class PaymeePaymentService:
    @staticmethod
    def is_configured() -> bool:
        return bool(settings.PAYMEE_API_KEY)

    @staticmethod
    def get_base_url() -> str:
        if settings.PAYMEE_MODE.lower() == "production":
            return "https://app.paymee.tn/api/v2"
        return "https://sandbox.paymee.tn/api/v2"

    @classmethod
    async def initiate_payment(
        cls,
        user: User,
        transaction: PaymentTransaction,
        frontend_url: str,
        backend_url: str
    ) -> Tuple[str, str, bool]:
        """
        Initiates a payment session with Paymee.
        Returns (pay_url, provider_payment_id, is_simulation).
        """
        if not cls.is_configured():
            logger.warning("[Paymee] API key not configured. Running in simulated sandbox mode.")
            simulated_url = f"{frontend_url}/mock-defense?payment=simulated&tx_id={str(transaction.id)}&provider=paymee"
            return simulated_url, f"sim_paymee_{str(transaction.id)[:8]}", True

        base_url = cls.get_base_url()
        url = f"{base_url}/payments/create"
        headers = {
            "Authorization": f"Token {settings.PAYMEE_API_KEY}",
            "Content-Type": "application/json"
        }

        payload = {
            "amount": float(transaction.amount_tnd),
            "note": f"Encadrini {transaction.plan} - 1 Mois",
            "first_name": user.first_name or "Étudiant",
            "last_name": user.last_name or "Encadrini",
            "email": user.email,
            "phone": user.phone_number or "+21600000000",
            "return_url": f"{frontend_url}/mock-defense?payment=success&tx_id={str(transaction.id)}&provider=paymee",
            "cancel_url": f"{frontend_url}/mock-defense?payment=failed&tx_id={str(transaction.id)}&provider=paymee",
            "webhook_url": f"{backend_url}/api/v1/payments/webhook/paymee",
            "order_id": str(transaction.id),
        }

        if settings.PAYMEE_VENDOR_ID:
            try:
                payload["vendor"] = int(settings.PAYMEE_VENDOR_ID)
            except ValueError:
                pass

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                res = await client.post(url, json=payload, headers=headers)
                if res.status_code in (200, 201):
                    data = res.json()
                    if data.get("status") and "data" in data:
                        token = data["data"].get("token")
                        pay_url = data["data"].get("payment_url")
                        return pay_url, token, False
                logger.error(f"[Paymee] Create failed: {res.status_code} - {res.text}")
                simulated_url = f"{frontend_url}/mock-defense?payment=simulated&tx_id={str(transaction.id)}&provider=paymee"
                return simulated_url, f"sim_paymee_{str(transaction.id)[:8]}", True
        except Exception as e:
            logger.error(f"[Paymee] Error connecting: {e}")
            simulated_url = f"{frontend_url}/mock-defense?payment=simulated&tx_id={str(transaction.id)}&provider=paymee"
            return simulated_url, f"sim_paymee_{str(transaction.id)[:8]}", True

    @classmethod
    async def verify_payment(cls, token: str) -> bool:
        """
        Verifies payment with Paymee check API.
        """
        if not cls.is_configured() or token.startswith("sim_"):
            return True

        base_url = cls.get_base_url()
        url = f"{base_url}/payments/{token}/check"
        headers = {"Authorization": f"Token {settings.PAYMEE_API_KEY}"}

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                res = await client.get(url, headers=headers)
                if res.status_code == 200:
                    data = res.json()
                    if data.get("status") and "data" in data:
                        return bool(data["data"].get("payment_status"))
                return False
        except Exception as e:
            logger.error(f"[Paymee] Error verifying payment: {e}")
            return False
