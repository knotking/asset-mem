"""HomeGeek Service Request Broker agent definition."""

from __future__ import annotations

import json
import uuid
from typing import Any, Dict, List, Optional

from dotenv import load_dotenv
from google.adk.agents import Agent

from ..shared import (
    ProviderDispatchRecord,
    ProviderMessage,
    SessionRecord,
    SessionStore,
    TwilioDispatchResult,
    TwilioMessenger,
    get_default_catalog,
)
from .agent_inputs import ServiceRequestInput
from .prompts import broker_agent_instruction

load_dotenv()

catalog = get_default_catalog()
session_store = SessionStore()
messenger = TwilioMessenger()


def fetch_provider_candidates(
    service_category: str,
    location_city: Optional[str] = None,
    location_postal_code: Optional[str] = None,
    min_rating: float = 3.5,
    limit: int = 3,
) -> Dict[str, List[dict]]:
    """Return catalog providers that match the filters."""

    matches = catalog.find_matches(
        category=service_category,
        city=location_city,
        postal_code=location_postal_code,
        min_rating=min_rating,
        limit=limit,
    )
    providers = [
        {
            "provider_id": record.provider_id,
            "display_name": record.display_name,
            "channel": record.messaging_channel,
            "rating": record.rating,
            "response_time_minutes": record.response_time_minutes,
            "phone_number": record.phone_number,
            "notes": record.notes,
        }
        for record in matches
    ]
    return {"providers": providers}


def open_or_update_session(
    request_id: Optional[str],
    user_id: str,
    service_category: str,
    problem_statement: str,
    location_city: Optional[str],
    location_postal_code: Optional[str],
    preferred_channel: str,
    providers: Optional[Any] = None,
    metadata: Optional[Any] = None,
) -> Dict[str, str]:
    """Persist the session with selected providers and metadata."""

    if isinstance(providers, str):
        providers_data = json.loads(providers or "[]")
    else:
        providers_data = providers or []

    if isinstance(metadata, str):
        metadata_payload = json.loads(metadata or "{}")
    else:
        metadata_payload = metadata or {}

    request_id = request_id or str(uuid.uuid4())

    session = session_store.get_session(request_id)
    if session:
        session.category = service_category
        session.description = problem_statement
        session.location_city = location_city
        session.location_postal_code = location_postal_code
        session.preferred_channel = preferred_channel or session.preferred_channel
        session.extra.update(metadata_payload)
        session.touch()
    else:
        session = SessionRecord(
            request_id=request_id,
            user_id=user_id,
            category=service_category,
            description=problem_statement,
            location_city=location_city,
            location_postal_code=location_postal_code,
            preferred_channel=preferred_channel,
            extra=metadata_payload,
        )

    existing_providers = {record.provider_id: record for record in session.providers}
    updated_providers: List[ProviderDispatchRecord] = []

    for provider in providers_data:
        provider_id = provider["provider_id"]
        current = existing_providers.get(provider_id)
        if current:
            current.channel = provider.get("channel", current.channel or preferred_channel or "sms")
            current.status = provider.get("status", current.status)
            current.metadata.update(
                {
                    "display_name": provider.get("display_name", current.metadata.get("display_name", "")),
                    "rating": str(provider.get("rating") or current.metadata.get("rating") or ""),
                    "phone_number": provider.get("phone_number", current.metadata.get("phone_number", "")),
                }
            )
            updated_providers.append(current)
        else:
            updated_providers.append(
                ProviderDispatchRecord(
                    provider_id=provider_id,
                    channel=provider.get("channel", preferred_channel or "sms"),
                    status=provider.get("status", "pending"),
                    metadata={
                        "display_name": provider.get("display_name", ""),
                        "rating": str(provider.get("rating") or ""),
                        "phone_number": provider.get("phone_number", ""),
                    },
                )
            )

    # Preserve providers that were not part of the current selection (e.g., previously contacted vendors)
    for provider_id, record in existing_providers.items():
        if not any(p.provider_id == provider_id for p in updated_providers):
            updated_providers.append(record)

    session.providers = updated_providers

    session_store.upsert_session(session)
    return {"request_id": session.request_id, "status": session.status}


def render_dispatch_template(
    provider_name: str,
    service_category: str,
    problem_statement: str,
    location_city: Optional[str] = None,
    location_postal_code: Optional[str] = None,
    urgency: Optional[str] = None,
    callback_number: Optional[str] = None,
) -> str:
    """Return a templated outbound message for providers."""

    location_bits = [
        part for part in [location_city, location_postal_code] if part
    ]
    location_text = ", ".join(location_bits) if location_bits else "the customer’s location"

    urgency_text = f"The customer flagged the urgency as {urgency}." if urgency else "Urgency was not specified."
    callback_text = (
        f"You can reach them at {callback_number}."
        if callback_number
        else "Reply to this message with your estimate or follow-up questions."
    )

    return (
        f"Hi {provider_name}, HomeGeek has a new {service_category} request near {location_text}. "
        f"Details: {problem_statement}. {urgency_text} {callback_text}"
    )


def dispatch_via_twilio(
    request_id: str,
    provider_id: str,
    phone_number: str,
    channel: str,
    body: str,
) -> Dict[str, str]:
    """Send the outbound message and record the dispatch status."""

    result: TwilioDispatchResult = messenger.send(
        provider_id=provider_id,
        to_phone_number=phone_number,
        channel=channel,
        body=body,
        metadata={"request_id": request_id},
    )
    status = "sent"
    if result.status in {"failed", "undelivered", "error"}:
        status = "failed"
    elif result.status in {"delivered", "responded"}:
        status = result.status

    message = ProviderMessage(
        direction="outbound",
        channel=channel,
        body=body,
        metadata={"message_sid": result.message_sid or "", "dry_run": str(result.dry_run)},
    )
    session_store.append_message(
        request_id=request_id,
        provider_id=provider_id,
        message=message,
        status=status,
    )
    return result.model_dump()


service_broker_agent = Agent(
    model="gemini-2.5-flash",
    name="service_broker_agent",
    description="Routes HomeGeek service requests to qualified providers via Twilio.",
    instruction=broker_agent_instruction(),
    input_schema=ServiceRequestInput,
    tools=[
        fetch_provider_candidates,
        open_or_update_session,
        render_dispatch_template,
        dispatch_via_twilio,
    ],
)

__all__ = ["service_broker_agent"]

