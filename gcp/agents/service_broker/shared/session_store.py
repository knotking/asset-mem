"""Lightweight JSON-backed session persistence for local development."""

from __future__ import annotations

import json
import os
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

from pydantic import BaseModel, Field

DEFAULT_STORE_PATH = Path(__file__).resolve().parent.parent / ".sessions" / "service_sessions.json"


class ProviderMessage(BaseModel):
    direction: str = Field(..., description="outbound|inbound")
    channel: str = Field(..., description="sms|whatsapp|voice|email")
    body: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    metadata: Dict[str, str] = Field(default_factory=dict)


class ProviderDispatchRecord(BaseModel):
    provider_id: str
    channel: str
    status: str = Field(default="pending", description="pending|sent|delivered|responded|failed")
    last_message_sid: Optional[str] = None
    last_updated: datetime = Field(default_factory=datetime.utcnow)
    messages: List[ProviderMessage] = Field(default_factory=list)
    metadata: Dict[str, str] = Field(default_factory=dict)


class SessionRecord(BaseModel):
    request_id: str
    user_id: str
    category: str
    description: str
    location_city: Optional[str] = None
    location_postal_code: Optional[str] = None
    preferred_channel: str = "sms"
    status: str = Field(default="queued", description="queued|in_progress|completed|cancelled")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    providers: List[ProviderDispatchRecord] = Field(default_factory=list)
    extra: Dict[str, str] = Field(default_factory=dict)

    def touch(self) -> None:
        self.updated_at = datetime.utcnow()


class SessionStore:
    """Minimal persistence layer. Swap with Firestore/SQL in production."""

    def __init__(self, path: Optional[Path] = None) -> None:
        env_path = os.environ.get("SESSION_STORE_PATH")
        self._path = Path(path or env_path or DEFAULT_STORE_PATH)
        self._path.parent.mkdir(parents=True, exist_ok=True)
        self._cache: Dict[str, SessionRecord] = {}
        self._load()

    def _load(self) -> None:
        if not self._path.exists():
            self._cache = {}
            return
        raw = json.loads(self._path.read_text())
        self._cache = {
            key: SessionRecord(**value) for key, value in raw.items()
        }

    def _flush(self) -> None:
        serialisable = {key: value.model_dump(mode="json") for key, value in self._cache.items()}
        self._path.write_text(json.dumps(serialisable, indent=2, sort_keys=True))

    def create_session(self, record: SessionRecord) -> SessionRecord:
        self._cache[record.request_id] = record
        self._flush()
        return record

    def upsert_session(self, record: SessionRecord) -> SessionRecord:
        record.touch()
        self._cache[record.request_id] = record
        self._flush()
        return record

    def get_session(self, request_id: str) -> Optional[SessionRecord]:
        return self._cache.get(request_id)

    def record_dispatch(
        self,
        request_id: str,
        dispatch: ProviderDispatchRecord,
    ) -> SessionRecord:
        session = self._cache.get(request_id)
        if not session:
            raise KeyError(f"Session {request_id} not found")
        session.touch()
        existing = next((p for p in session.providers if p.provider_id == dispatch.provider_id), None)
        if existing:
            existing.status = dispatch.status
            existing.last_message_sid = dispatch.last_message_sid or existing.last_message_sid
            existing.last_updated = datetime.utcnow()
            existing.metadata.update(dispatch.metadata)
            existing.messages.extend(dispatch.messages)
        else:
            session.providers.append(dispatch)
        self._flush()
        return session

    def append_message(
        self,
        request_id: str,
        provider_id: str,
        message: ProviderMessage,
        status: Optional[str] = None,
    ) -> SessionRecord:
        session = self._cache.get(request_id)
        if not session:
            raise KeyError(f"Session {request_id} not found")
        target = next((p for p in session.providers if p.provider_id == provider_id), None)
        if not target:
            target = ProviderDispatchRecord(provider_id=provider_id, channel=message.channel)
            session.providers.append(target)
        target.messages.append(message)
        if status:
            target.status = status
        target.last_updated = datetime.utcnow()
        session.touch()
        self._flush()
        return session

    def list_sessions(self) -> List[SessionRecord]:
        return list(self._cache.values())


__all__ = [
    "ProviderDispatchRecord",
    "ProviderMessage",
    "SessionRecord",
    "SessionStore",
]

