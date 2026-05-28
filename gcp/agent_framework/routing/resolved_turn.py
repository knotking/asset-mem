"""Platform turn-resolution primitives: inject helpers and session state keys."""

from __future__ import annotations

import json
import re
from typing import Any, Mapping, Optional

from google.genai import types

RESOLVED_TURN_STATE_KEY = "resolved_turn"
RESOLVE_APPLIED_INVOCATION_KEY = "_resolve_turn_invocation_id"


def session_events(ctx: Any) -> list:
    invocation = getattr(ctx, "_invocation_context", None)
    if invocation is None:
        return []
    session = getattr(invocation, "session", None)
    if session is None:
        return []
    return list(getattr(session, "events", None) or [])


def invocation_id(ctx: Any) -> Optional[str]:
    invocation = getattr(ctx, "_invocation_context", None)
    if invocation is None:
        return None
    return getattr(invocation, "invocation_id", None)


def format_resolved_turn_block(
    resolved: Any,
    *,
    extra_blocks: list[str] | None = None,
    metadata: Mapping[str, Any] | None = None,
) -> str:
    if hasattr(resolved, "to_dict"):
        payload = dict(resolved.to_dict())
    else:
        payload = dict(resolved)
    if metadata:
        payload.update(metadata)
    blocks = ["[RESOLVED_TURN]\n" f"{json.dumps(payload, indent=2)}\n" "[/RESOLVED_TURN]"]
    if extra_blocks:
        blocks.extend(extra_blocks)
    return "\n\n".join(blocks)


def _ensure_generate_content_config(llm_request: Any) -> Any:
    config = getattr(llm_request, "config", None)
    if config is None:
        config = types.GenerateContentConfig()
        llm_request.config = config
    return config


def _system_instruction_text(llm_request: Any) -> str:
    config = getattr(llm_request, "config", None)
    if config is None:
        return ""
    si = getattr(config, "system_instruction", None)
    if si is None:
        return ""
    if isinstance(si, str):
        return si
    if isinstance(si, types.Content):
        parts = getattr(si, "parts", None) or []
        return "".join((getattr(part, "text", None) or "") for part in parts)
    return str(si)


def inject_resolved_turn_into_llm_request(
    llm_request: Any,
    resolved: Any,
    *,
    block: str,
) -> None:
    """Append resolved JSON to the executor system instruction for this turn."""
    _ = resolved
    config = _ensure_generate_content_config(llm_request)
    existing = _system_instruction_text(llm_request).strip()
    if "[RESOLVED_TURN]" in existing:
        existing = re.sub(
            r"\[RESOLVED_TURN\][\s\S]*?\[/RESOLVED_TURN\]",
            "",
            existing,
        ).strip()
    if "[SESSION_WORKING_MEMORY]" in existing:
        existing = re.sub(
            r"\[SESSION_WORKING_MEMORY\][\s\S]*?\[/SESSION_WORKING_MEMORY\]\n?",
            "",
            existing,
        ).strip()
    combined = f"{existing}\n\n{block}" if existing else block
    config.system_instruction = combined
