"""Thin Twilio messaging helper with dry-run support for local development."""

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Optional

from pydantic import BaseModel, Field

try:
    from twilio.base.exceptions import TwilioRestException
    from twilio.rest import Client as TwilioClient
except ImportError:  # pragma: no cover - twilio may not be installed in some environments
    TwilioClient = None
    TwilioRestException = Exception


class TwilioDispatchResult(BaseModel):
    provider_id: str
    channel: str
    status: str
    message_sid: Optional[str] = None
    dry_run: bool = False
    payload: dict = Field(default_factory=dict)


class TwilioMessenger:
    """Wrapper around the Twilio REST API with graceful fallback when unconfigured."""

    def __init__(
        self,
        account_sid: Optional[str] = None,
        auth_token: Optional[str] = None,
        messaging_service_sid: Optional[str] = None,
        status_callback: Optional[str] = None,
    ) -> None:
        self.account_sid = account_sid or os.environ.get("TWILIO_ACCOUNT_SID")
        self.auth_token = auth_token or os.environ.get("TWILIO_AUTH_TOKEN")
        self.messaging_service_sid = messaging_service_sid or os.environ.get("TWILIO_MESSAGING_SERVICE_SID")
        self.status_callback = status_callback or os.environ.get("TWILIO_STATUS_WEBHOOK_URL")
        self._client = None

        if self.account_sid and self.auth_token and TwilioClient:
            self._client = TwilioClient(self.account_sid, self.auth_token)

    @property
    def configured(self) -> bool:
        return self._client is not None and bool(self.messaging_service_sid)

    def send(
        self,
        *,
        provider_id: str,
        to_phone_number: str,
        body: str,
        channel: str = "sms",
        metadata: Optional[dict] = None,
    ) -> TwilioDispatchResult:
        payload = {
            "provider_id": provider_id,
            "to": to_phone_number,
            "body": body,
            "messaging_service_sid": self.messaging_service_sid,
            "status_callback": self.status_callback,
            "channel": channel,
            "metadata": metadata or {},
        }

        if not self.configured:
            return TwilioDispatchResult(
                provider_id=provider_id,
                channel=channel,
                status="dry_run",
                dry_run=True,
                payload=payload,
            )

        try:
            message = self._client.messages.create(  # type: ignore[union-attr]
                to=to_phone_number,
                messaging_service_sid=self.messaging_service_sid,
                body=body,
                status_callback=self.status_callback,
            )
            return TwilioDispatchResult(
                provider_id=provider_id,
                channel=channel,
                status=message.status or "queued",
                message_sid=message.sid,
                dry_run=False,
                payload=payload,
            )
        except TwilioRestException as exc:  # pragma: no cover - network failure path
            return TwilioDispatchResult(
                provider_id=provider_id,
                channel=channel,
                status="error",
                dry_run=False,
                payload={**payload, "error": str(exc)},
            )


__all__ = ["TwilioMessenger", "TwilioDispatchResult"]

