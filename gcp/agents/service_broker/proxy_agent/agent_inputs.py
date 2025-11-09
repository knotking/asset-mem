"""Input and output models for the proxy agent."""

from __future__ import annotations

from typing import Dict, Optional

from pydantic import BaseModel, Field


class ProxyWebhookInput(BaseModel):
    """Normalized payload received from the Twilio webhook proxy."""

    request_id: str = Field(..., description="Identifier of the broker session to update.")
    provider_id: Optional[str] = Field(
        default=None,
        description="Provider identifier, when known from Twilio message SID mapping.",
    )
    from_number: str = Field(..., description="E.164 formatted sender phone number.")
    to_number: Optional[str] = Field(default=None, description="Recipient phone number configured in Twilio.")
    channel: str = Field(default="sms", description="sms|whatsapp|voice|email")
    body: str = Field(..., description="Raw message content from the provider.")
    message_sid: Optional[str] = Field(default=None, description="Twilio message SID for correlation.")
    sent_at: Optional[str] = Field(
        default=None,
        description="ISO timestamp when Twilio recorded the message. Optional but recommended.",
    )
    metadata: Dict[str, str] = Field(
        default_factory=dict,
        description="Additional fields forwarded from the webhook (e.g., media URLs, custom params).",
    )


class ProviderResponseSummary(BaseModel):
    request_id: str
    provider_id: str
    session_status: str
    classification: str
    summary: str
    estimate_amount: Optional[float] = None
    estimate_currency: Optional[str] = None
    follow_up_needed: bool = False
    raw_text: str


__all__ = ["ProxyWebhookInput", "ProviderResponseSummary"]


