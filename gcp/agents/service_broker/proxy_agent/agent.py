"""Proxy agent that handles inbound Twilio webhooks."""

from __future__ import annotations

import re
from typing import Dict, Optional

from dotenv import load_dotenv
from google.adk.agents import Agent

from ..shared import ProviderDispatchRecord, ProviderMessage, SessionRecord, SessionStore
from .agent_inputs import ProxyWebhookInput, ProviderResponseSummary
from .prompts import proxy_agent_instruction

load_dotenv()

session_store = SessionStore()


def _normalise_phone(phone: Optional[str]) -> Optional[str]:
    if not phone:
        return None
    digits = re.sub(r"[^0-9]", "", phone)
    if not digits:
        return None
    if digits.startswith("1") and len(digits) == 11:
        digits = digits[1:]
    return digits


def identify_provider_for_request(
    request_id: str,
    provider_id: Optional[str] = None,
    from_number: Optional[str] = None,
) -> Dict[str, str]:
    """Return the provider identifier associated with the inbound webhook."""

    session: Optional[SessionRecord] = session_store.get_session(request_id)
    if not session:
        return {
            "success": False,
            "reason": f"Session {request_id} not found",
            "provider_id": "",
            "confidence": 0.0,
        }

    if provider_id:
        match = next((p for p in session.providers if p.provider_id == provider_id), None)
        if match:
            return {
                "success": True,
                "provider_id": provider_id,
                "confidence": 1.0,
                "matched_on": "provider_id",
            }

    if from_number:
        target_digits = _normalise_phone(from_number)
        for dispatch in session.providers:
            phone_digits = _normalise_phone(dispatch.metadata.get("phone_number"))
            if phone_digits and phone_digits == target_digits:
                return {
                    "success": True,
                    "provider_id": dispatch.provider_id,
                    "confidence": 0.9,
                    "matched_on": "phone_number",
                }

    return {
        "success": False,
        "reason": "Could not map inbound message to provider",
        "provider_id": provider_id or "",
        "confidence": 0.0,
    }


def record_provider_message(
    request_id: str,
    provider_id: str,
    channel: str,
    body: str,
    message_sid: Optional[str] = None,
    from_number: Optional[str] = None,
    metadata: Optional[Dict[str, str]] = None,
) -> Dict[str, str]:
    """Persist the inbound provider message and update session status."""

    session: Optional[SessionRecord] = session_store.get_session(request_id)
    if not session:
        raise ValueError(f"Session {request_id} not found")

    target: Optional[ProviderDispatchRecord] = next(
        (p for p in session.providers if p.provider_id == provider_id),
        None,
    )
    if not target:
        raise ValueError(f"Provider {provider_id} not associated with session {request_id}")

    metadata_payload: Dict[str, str] = metadata.copy() if metadata else {}
    if message_sid:
        metadata_payload.setdefault("message_sid", message_sid)
    if from_number:
        metadata_payload.setdefault("from_number", from_number)
        if not target.metadata.get("phone_number"):
            target.metadata["phone_number"] = from_number

    message = ProviderMessage(
        direction="inbound",
        channel=channel,
        body=body,
        metadata=metadata_payload,
    )
    session_store.append_message(
        request_id=request_id,
        provider_id=provider_id,
        message=message,
        status="responded",
    )

    # Refresh and flag session as active
    refreshed = session_store.get_session(request_id)
    if refreshed:
        refreshed.status = "in_progress"
        session_store.upsert_session(refreshed)
        session_status = refreshed.status
    else:
        session_status = session.status

    return {
        "request_id": request_id,
        "provider_id": provider_id,
        "session_status": session_status,
    }


_AMOUNT_PATTERN = re.compile(r"(?:USD|usd|\$)\s*([\d,]+(?:\.\d{1,2})?)|([\d,]+(?:\.\d{1,2})?)\s*(?:usd|USD)", re.IGNORECASE)
_TIME_PATTERN = re.compile(r"(\d+)\s*(?:day|days|hour|hours|hr|hrs|minute|minutes)", re.IGNORECASE)
_INTENT_KEYWORDS = {
    "decline": ["cannot", "unavailable", "decline", "sorry"],
    "follow_up": ["need", "more info", "question", "could you"],
}


def extract_estimate_metadata(message: str) -> Dict[str, object]:
    """Extract pricing or turnaround time hints from a provider message."""

    amount = None
    currency = None
    for match in _AMOUNT_PATTERN.finditer(message):
        candidate = match.group(1) or match.group(2)
        if candidate:
            amount = float(candidate.replace(",", ""))
            currency = "USD"
            break

    turnaround = None
    for match in _TIME_PATTERN.finditer(message):
        quantity = match.group(1)
        if quantity:
            turnaround = match.group(0)
            break

    intent = "other"
    lowered = message.lower()
    if amount is not None:
        intent = "estimate"
    else:
        for label, keywords in _INTENT_KEYWORDS.items():
            if any(keyword in lowered for keyword in keywords):
                intent = label if label != "follow_up" else "follow_up"
                break

    follow_up = intent in {"follow_up"}

    return {
        "intent": intent,
        "amount": amount,
        "currency": currency,
        "turnaround": turnaround,
        "follow_up_needed": follow_up,
    }


def get_session_snapshot(request_id: str) -> Dict[str, object]:
    """Return the session state to help the agent reason about responses."""

    session = session_store.get_session(request_id)
    if not session:
        return {"found": False}
    return {
        "found": True,
        "session": session.model_dump(mode="json"),
    }


proxy_agent = Agent(
    model="gemini-2.5-flash",
    name="proxy_agent",
    description="Processes inbound provider messages from Twilio and updates service sessions.",
    instruction=proxy_agent_instruction(),
    input_schema=ProxyWebhookInput,
    tools=[
        identify_provider_for_request,
        record_provider_message,
        extract_estimate_metadata,
        get_session_snapshot,
    ],
    output_schema=ProviderResponseSummary,
)


__all__ = ["proxy_agent"]


