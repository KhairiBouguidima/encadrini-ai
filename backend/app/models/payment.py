from datetime import datetime, timezone
from typing import Optional, Dict, Any
from enum import Enum
from beanie import Document, PydanticObjectId
from pydantic import Field


class PaymentProvider(str, Enum):
    KONNECT = "KONNECT"
    FLOUCI = "FLOUCI"
    PAYMEE = "PAYMEE"


class PaymentStatus(str, Enum):
    PENDING = "PENDING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"


class PaymentTransaction(Document):
    user_id: PydanticObjectId
    provider: PaymentProvider
    amount_tnd: float
    amount_millimes: int
    currency: str = "TND"
    plan: str = "PREMIUM"
    duration_days: int = 30
    status: PaymentStatus = PaymentStatus.PENDING

    # External Provider Identifiers
    provider_payment_id: Optional[str] = None  # paymentRef (Konnect), payment_id (Flouci), token (Paymee)
    provider_pay_url: Optional[str] = None
    developer_tracking_id: Optional[str] = None  # Internal order id / tracking id

    metadata: Dict[str, Any] = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    completed_at: Optional[datetime] = None

    class Settings:
        name = "payment_transactions"
