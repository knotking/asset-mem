"""Message patch types for structured chat messages — no imports from registry/routing/runtime."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

MESSAGE_PATCH_SCHEMA_VERSION = 2


@dataclass(frozen=True)
class MessagePatchInputV1:
    """Platform contract for assistant message persist (agent → proxy → Firestore)."""

    content_markdown: str
    content_json: dict[str, Any] | None
    revision: int
    client_routing_hint: str | None
    agent_steps: list[dict[str, Any]]
    analysis_run_id: str | None = None
