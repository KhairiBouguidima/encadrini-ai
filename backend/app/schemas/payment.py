from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from app.models.payment import PaymentProvider, PaymentStatus


class PaymentInitiateRequest(BaseModel):
    provider: PaymentProvider = Field(default=PaymentProvider.KONNECT)
    plan: str = Field(default="PREMIUM")


class PaymentInitiateResponse(BaseModel):
    transaction_id: str
    provider: PaymentProvider
    amount_tnd: float
    currency: str = "TND"
    pay_url: str
    is_simulation: bool = False
    message: str


class PaymentVerifyResponse(BaseModel):
    transaction_id: str
    status: PaymentStatus
    is_successful: bool
    plan: str
    provider: PaymentProvider
    message: str


class ProviderInfo(BaseModel):
    id: PaymentProvider
    name: str
    description: str
    badges: List[str]
    is_configured: bool


class PaymentProvidersResponse(BaseModel):
    price_tnd: float
    currency: str = "TND"
    plan: str = "PREMIUM"
    providers: List[ProviderInfo]
