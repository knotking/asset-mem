from typing import Literal

from pydantic import BaseModel, Field

B2CCheckoutTier = Literal["plus", "pro"]


class CheckoutSessionRequest(BaseModel):
    """B2C: start Stripe Checkout for a named tier (resolved on the proxy from STRIPE_B2C_PRICE_TOKEN_CAPS_JSON)."""

    tier: B2CCheckoutTier = Field(
        ...,
        description="Paid plan tier key (e.g. plus, pro) — must exist in STRIPE_B2C_PRICE_TOKEN_CAPS_JSON with stripePriceId",
    )


class PortalSessionRequest(BaseModel):
    """Return path is appended to BILLING_PUBLIC_APP_BASE_URL for Stripe Customer Portal."""

    return_path: str | None = Field(
        default="/home/settings",
        alias="returnPath",
        description="Path only (leading slash); used as return_url path segment",
    )

    class Config:
        populate_by_name = True
