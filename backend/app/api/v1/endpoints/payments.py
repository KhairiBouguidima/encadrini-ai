import logging
from typing import Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, Request
from beanie import PydanticObjectId
from app.models.user import User
from app.api.deps import get_current_user
from app.core.config import settings
from app.models.payment import PaymentTransaction, PaymentStatus
from app.schemas.payment import (
    PaymentInitiateRequest,
    PaymentInitiateResponse,
    PaymentVerifyResponse,
    PaymentProvidersResponse,
    ProviderInfo
)
from app.services.payments.payment_gateway_manager import PaymentGatewayManager

logger = logging.getLogger("uvicorn.error")

router = APIRouter()

@router.get("/providers", response_model=PaymentProvidersResponse)
async def get_payment_providers():
    """Returns available Tunisian payment gateways (Konnect, Flouci, Paymee) and pricing."""
    raw_providers = PaymentGatewayManager.get_available_providers()
    providers = [ProviderInfo(**p) for p in raw_providers]
    return PaymentProvidersResponse(
        price_tnd=settings.PREMIUM_PRICE_TND,
        currency="TND",
        plan="PREMIUM",
        providers=providers
    )


@router.post("/initiate", response_model=PaymentInitiateResponse)
async def initiate_payment(
    body: PaymentInitiateRequest,
    request: Request,
    current_user: User = Depends(get_current_user)
):
    """
    Initiates payment with the selected Tunisian gateway (Konnect, Flouci, or Paymee).
    Returns the gateway checkout URL to redirect the student.
    """
    origin = request.headers.get("origin") or settings.FRONTEND_URL.rstrip("/")
    base_backend = str(request.base_url).rstrip("/")

    try:
        tx, pay_url, is_sim = await PaymentGatewayManager.initiate_payment(
            user=current_user,
            provider=body.provider,
            plan=body.plan or "PREMIUM",
            frontend_url=origin,
            backend_url=base_backend
        )

        msg = "Session de paiement créée avec succès."
        if is_sim:
            msg = "Mode Bac à sable / Simulation activé pour ce fournisseur."

        return PaymentInitiateResponse(
            transaction_id=str(tx.id),
            provider=tx.provider,
            amount_tnd=tx.amount_tnd,
            currency="TND",
            pay_url=pay_url,
            is_simulation=is_sim,
            message=msg
        )
    except Exception as e:
        logger.error(f"Error initiating payment: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur lors de l'initialisation du paiement: {str(e)}"
        )


@router.get("/verify/{transaction_id}", response_model=PaymentVerifyResponse)
async def verify_payment(
    transaction_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    Verifies payment completion for a given transaction and upgrades user to PREMIUM.
    """
    try:
        tx_obj_id = PydanticObjectId(transaction_id)
    except Exception:
        raise HTTPException(status_code=400, detail="ID de transaction invalide.")

    tx = await PaymentTransaction.get(tx_obj_id)
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction introuvable.")

    if tx.user_id != current_user.id and current_user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Accès interdit à cette transaction.")

    success = await PaymentGatewayManager.verify_and_finalize_payment(tx)

    return PaymentVerifyResponse(
        transaction_id=str(tx.id),
        status=tx.status,
        is_successful=success,
        plan=tx.plan,
        provider=tx.provider,
        message="Abonnement activé avec succès !" if success else "Le paiement n'a pas encore été confirmé."
    )


# ── Webhooks from Gateways ──────────────────────────────────────────

@router.post("/webhook/konnect")
async def webhook_konnect(request: Request):
    """Webhook callback triggered by Konnect Network upon payment status change."""
    try:
        body = await request.json()
        logger.info(f"[Webhook Konnect] Payload: {body}")
        payment_ref = body.get("payment_ref") or body.get("paymentRef")
        if payment_ref:
            tx = await PaymentTransaction.find_one(PaymentTransaction.provider_payment_id == payment_ref)
            if tx:
                await PaymentGatewayManager.verify_and_finalize_payment(tx)
        return {"status": "received"}
    except Exception as e:
        logger.error(f"[Webhook Konnect] Error: {e}")
        return {"status": "error", "detail": str(e)}


@router.post("/webhook/flouci")
async def webhook_flouci(request: Request):
    """Webhook callback from Flouci."""
    try:
        body = await request.json()
        logger.info(f"[Webhook Flouci] Payload: {body}")
        payment_id = body.get("payment_id")
        if payment_id:
            tx = await PaymentTransaction.find_one(PaymentTransaction.provider_payment_id == payment_id)
            if tx:
                await PaymentGatewayManager.verify_and_finalize_payment(tx)
        return {"status": "received"}
    except Exception as e:
        logger.error(f"[Webhook Flouci] Error: {e}")
        return {"status": "error", "detail": str(e)}


@router.post("/webhook/paymee")
async def webhook_paymee(request: Request):
    """Webhook callback from Paymee."""
    try:
        body = await request.json()
        logger.info(f"[Webhook Paymee] Payload: {body}")
        token = body.get("token")
        order_id = body.get("order_id")
        tx = None
        if token:
            tx = await PaymentTransaction.find_one(PaymentTransaction.provider_payment_id == token)
        if not tx and order_id:
            try:
                tx = await PaymentTransaction.get(PydanticObjectId(order_id))
            except Exception:
                pass
        if tx:
            await PaymentGatewayManager.verify_and_finalize_payment(tx)
        return {"status": "received"}
    except Exception as e:
        logger.error(f"[Webhook Paymee] Error: {e}")
        return {"status": "error", "detail": str(e)}
