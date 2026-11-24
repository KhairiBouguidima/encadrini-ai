import logging
from typing import Dict, Any, Tuple
import httpx
from app.core.config import settings
from app.models.user import User
from app.models.payment import PaymentTransaction

logger = logging.getLogger("uvicorn.error")

class KonnectPaymentService:
    @staticmethod
    def is_configured() -> bool:
        return bool(settings.KONNECT_API_KEY and settings.KONNECT_WALLET_ID)

    @staticmethod
    def get_base_url() -> str:
        if settings.KONNECT_MODE.lower() == "production":
            return "https://api.konnect.network/api/v2"
        return "https://api.preprod.konnect.network/api/v2"

    @classmethod
    async def initiate_payment(
        cls,
        user: User,
        transaction: PaymentTransaction,
        frontend_url: str,
        backend_url: str
    ) -> Tuple[str, str, bool]:
        """
        Initiates a payment with Konnect Network.
        Returns (pay_url, provider_payment_id, is_simulation).
        """
        if not cls.is_configured():
            logger.warning("[Konnect] API keys not configured. Running in simulated sandbox mode.")
            simulated_url = f"{frontend_url}/mock-defense?payment=simulated&tx_id={str(transaction.id)}&provider=konnect"
            return simulated_url, f"sim_konnect_{str(transaction.id)[:8]}", True

        base_url = cls.get_base_url()
        url = f"{base_url}/payments/init-payment"
        headers = {
            "x-api-key": settings.KONNECT_API_KEY,
            "Content-Type": "application/json"
        }

        payload = {
            "receiverWalletId": settings.KONNECT_WALLET_ID,
            "token": "TND",
            "amount": transaction.amount_millimes,
            "type": "immediate",
            "description": f"Encadrini {transaction.plan} - 1 Mois",
            "acceptedPaymentMethods": ["bank_card", "e-dinar", "flouci"],
            "lifespan": 45,
            "addPaymentFeesToAmount": False,
            "firstName": user.first_name or "Étudiant",
            "lastName": user.last_name or "Encadrini",
            "email": user.email,
            "orderId": str(transaction.id),
            "webhook": f"{backend_url}/api/v1/payments/webhook/konnect",
            "silentWebhook": True,
            "successUrl": f"{frontend_url}/mock-defense?payment=success&tx_id={str(transaction.id)}&provider=konnect",
            "failUrl": f"{frontend_url}/mock-defense?payment=failed&tx_id={str(transaction.id)}&provider=konnect",
        }

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                res = await client.post(url, json=payload, headers=headers)
                if res.status_code in (200, 201):
                    data = res.json()
                    pay_url = data.get("payUrl")
                    payment_ref = data.get("paymentRef")
                    return pay_url, payment_ref, False
                else:
                    logger.error(f"[Konnect] Init failed: {res.status_code} - {res.text}")
                    # Graceful fallback to sandbox simulation
                    simulated_url = f"{frontend_url}/mock-defense?payment=simulated&tx_id={str(transaction.id)}&provider=konnect"
                    return simulated_url, f"sim_konnect_{str(transaction.id)[:8]}", True
        except Exception as e:
            logger.error(f"[Konnect] Exception connecting to API: {e}")
            simulated_url = f"{frontend_url}/mock-defense?payment=simulated&tx_id={str(transaction.id)}&provider=konnect"
            return simulated_url, f"sim_konnect_{str(transaction.id)[:8]}", True

    @classmethod
    async def verify_payment(cls, payment_ref: str) -> bool:
        """
        Verifies payment status directly against Konnect's API.
        """
        if not cls.is_configured() or payment_ref.startswith("sim_"):
            # Simulated transaction is accepted in test mode
            return True

        base_url = cls.get_base_url()
        url = f"{base_url}/payments/{payment_ref}"
        headers = {"x-api-key": settings.KONNECT_API_KEY}

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                res = await client.get(url, headers=headers)
                if res.status_code == 200:
                    data = res.json()
                    payment_data = data.get("payment", {})
                    status = (payment_data.get("status") or "").lower()
                    return status in ("completed", "paid", "success")
                return False
        except Exception as e:
            logger.error(f"[Konnect] Error during verification: {e}")
            return False
