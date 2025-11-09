"""Pydantic schemas shared across broker workflows."""

from __future__ import annotations

from typing import Dict, List, Optional

from pydantic import BaseModel, Field


class Attachment(BaseModel):
    uri: str = Field(..., description="GCS URL or HTTPS link to supporting media.")
    media_type: Optional[str] = Field(default=None, description="mime-type of the attachment, e.g. image/jpeg.")
    caption: Optional[str] = None


class ServiceRequestInput(BaseModel):
    """Input payload originating from the HomeGeek AI App."""

    request_id: Optional[str] = Field(default=None, description="External identifier if already generated.")
    user_id: str = Field(..., description="Identifier for the end user initiating the request.")
    service_category: str = Field(..., description="Canonical category (e.g., plumbing, hvac).")
    problem_statement: str = Field(..., description="User-provided description of the issue.")
    location_city: Optional[str] = Field(default=None)
    location_postal_code: Optional[str] = Field(default=None)
    urgency: Optional[str] = Field(default=None, description="low|medium|high or textual urgency indicator.")
    preferred_channel: str = Field(default="sms", description="sms|whatsapp|voice|email.")
    contact_number: Optional[str] = Field(default=None, description="User callback number if different from session.")
    budget_ceiling_usd: Optional[float] = Field(default=None, description="Optional spending cap for provider.")
    attachments: List[Attachment] = Field(default_factory=list)
    metadata: Dict[str, str] = Field(default_factory=dict, description="Arbitrary key/value metadata.")


class ProviderSummary(BaseModel):
    provider_id: str
    display_name: str
    channel: str
    rating: Optional[float] = None
    eta_minutes: Optional[int] = None
    status: str = Field(default="pending")
    phone_number: Optional[str] = None


class BrokerResponse(BaseModel):
    request_id: str
    session_status: str
    providers_contacted: List[ProviderSummary]
    notes: Optional[str] = None


class ProviderLookupInput(BaseModel):
    service_category: str
    location_city: Optional[str] = None
    location_postal_code: Optional[str] = None
    min_rating: Optional[float] = Field(default=3.5)
    limit: int = Field(default=3, ge=1, le=10)


class DispatchRequest(BaseModel):
    request_id: str
    provider_id: str
    phone_number: str
    channel: str = "sms"
    body: str
    metadata: Dict[str, str] = Field(default_factory=dict)


class DispatchResult(BaseModel):
    provider_id: str
    channel: str
    status: str
    message_sid: Optional[str] = None
    dry_run: bool = False
    payload: Dict[str, str] = Field(default_factory=dict)


__all__ = [
    "Attachment",
    "ServiceRequestInput",
    "ProviderSummary",
    "BrokerResponse",
    "ProviderLookupInput",
    "DispatchRequest",
    "DispatchResult",
]

