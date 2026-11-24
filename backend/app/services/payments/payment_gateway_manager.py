import logging
from datetime import datetime, timezone
from typing import Dict, Any, List, Tuple
from app.core.config import settings
from app.models.user import User
from app.models.payment import PaymentTransaction, PaymentProvider, PaymentStatus
from app.services.mock_defense.subscription_usage_service import SubscriptionUsageService
from app.services.payments.konnect_service import KonnectPaymentService
from app.services.payments.flouci_service import FlouciPaymentService
from app.services.payments.paymee_service import PaymeePaymentService

logger = logging.getLogger("uvicorn.error")

class PaymentGatewayManager:
    @classmethod
    def get_available_providers(cls) -> List[Dict[str, Any]]:
        return [
            {
                "id": PaymentProvider.KONNECT,
                "name": "Konnect Network",
                "description": "Cartes Bancaires (GIE), Carte e-Dinar (Poste) & Portefeuille Flouci",
                "badges": ["e-Dinar", "Carte Bancaire", "Flouci", "Visa / Mastercard"],
                "is_configured": KonnectPaymentService.is_configured(),
            },
            {
                "id": PaymentProvider.FLOUCI,
                "name": "Flouci",
                "description": "Paiement direct par l'application Flouci (QR Code ou validation mobile)",
                "badges": ["Application Flouci", "QR Code Instantané"],
                "is_configured": FlouciPaymentService.is_configured(),
            },
            {
                "id": PaymentProvider.PAYMEE,
                "name": "Paymee",
                "description": "Passerelle bancaire tunisienne pour Cartes CIB nationales & e-Dinar",
                "badges": ["Cartes Bancaires CIB", "e-Dinar"],
                "is_configured": PaymeePaymentService.is_configured(),
            },
        ]

    @classmethod
    async def initiate_payment(
        cls,
        user: User,
        provider: PaymentProvider,
        plan: str = "PREMIUM",
        frontend_url: str = "",
        backend_url: str = ""
    ) -> Tuple[PaymentTransaction, str, bool]:
        """
        Creates a pending transaction in MongoDB and calls the respective provider gateway.
        Returns (transaction, pay_url, is_simulation).
        """
        amount_tnd = float(settings.PREMIUM_PRICE_TND)
        amount_millimes = int(amount_tnd * 1000)

        frontend = frontend_url or settings.FRONTEND_URL.rstrip("/")
        backend = backend_url or "http://localhost:8000"

        # 1. Create pending transaction document in DB
        tx = PaymentTransaction(
            user_id=user.id,
            provider=provider,
            amount_tnd=amount_tnd,
            amount_millimes=amount_millimes,
            currency="TND",
            plan=plan,
            duration_days=30,
            status=PaymentStatus.PENDING,
            metadata={"user_email": user.email, "initiated_at": datetime.now(timezone.utc).isoformat()}
        )
        await tx.insert()

        # 2. Delegate to the selected Tunisian gateway
        if provider == PaymentProvider.KONNECT:
            pay_url, provider_id, is_sim = await KonnectPaymentService.initiate_payment(user, tx, frontend, backend)
        elif provider == PaymentProvider.FLOUCI:
            pay_url, provider_id, is_sim = await FlouciPaymentService.initiate_payment(user, tx, frontend, backend)
        elif provider == PaymentProvider.PAYMEE:
            pay_url, provider_id, is_sim = await PaymeePaymentService.initiate_payment(user, tx, frontend, backend)
        else:
            raise ValueError(f"Unknown payment provider: {provider}")

        # 3. Update transaction record
        tx.provider_payment_id = provider_id
        tx.provider_pay_url = pay_url
        if is_sim:
            tx.metadata["is_simulation"] = True
        await tx.save()

        return tx, pay_url, is_sim

    @classmethod
    async def verify_and_finalize_payment(cls, transaction: PaymentTransaction) -> bool:
        """
        Checks verification with provider, updates transaction and upgrades user plan if successful.
        """
        if transaction.status == PaymentStatus.COMPLETED:
            return True

        provider = transaction.provider
        is_verified = False

        if provider == PaymentProvider.KONNECT:
            is_verified = await KonnectPaymentService.verify_payment(transaction.provider_payment_id or "")
        elif provider == PaymentProvider.FLOUCI:
            is_verified = await FlouciPaymentService.verify_payment(transaction.provider_payment_id or "")
        elif provider == PaymentProvider.PAYMEE:
            is_verified = await PaymeePaymentService.verify_payment(transaction.provider_payment_id or "")

        if is_verified:
            transaction.status = PaymentStatus.COMPLETED
            transaction.completed_at = datetime.now(timezone.utc)
            await transaction.save()

            # Upgrade the user's plan to PREMIUM
            user = await User.get(transaction.user_id)
            if user:
                await SubscriptionUsageService.upgrade_plan(user, transaction.plan)
                logger.info(f"âœ… Payment success: Upgraded user {user.email} to {transaction.plan} via {provider}.")
            return True
        else:
            logger.warning(f"âš ï¸  Payment verification failed for transaction {transaction.id} ({provider})")
            return False
