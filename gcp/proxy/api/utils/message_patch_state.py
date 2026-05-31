"""Deterministic message patch/revision helpers for streaming writes."""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any, Iterable, Optional

_api_root = Path(__file__).resolve().parents[1]
for root in (_api_root.parent.parent, _api_root):
    if (root / "agent_framework" / "__init__.py").is_file() and str(root) not in sys.path:
        sys.path.insert(0, str(root))
        break

from agent_framework.contracts.message_patch_v1 import (
    firestore_fields_from_message_patch_input,
    message_patch_input_from_accumulator,
)
from agent_framework.contracts.message_patch_types import MessagePatchInputV1


def normalize_revision(value: Any, *, default: int = 0) -> int:
    """Convert arbitrary revision value to a non-negative integer."""

    if isinstance(value, bool):
        return default
    if isinstance(value, int):
        return value if value >= 0 else default
    if isinstance(value, str):
        raw = value.strip()
        if raw.isdigit():
            parsed = int(raw)
            return parsed if parsed >= 0 else default
    return default


def next_revision(current_revision: int) -> int:
    """Monotonic next revision for a local stream writer."""

    return normalize_revision(current_revision, default=0) + 1


def is_stale_revision(*, incoming_revision: int, stored_revision: int) -> bool:
    """True when incoming write should be rejected as stale/no-op."""

    return normalize_revision(incoming_revision) <= normalize_revision(stored_revision)


def should_apply_patch(*, incoming_revision: int, stored_revision: int) -> bool:
    """True when incoming patch is newer than stored revision."""

    return not is_stale_revision(
        incoming_revision=incoming_revision, stored_revision=stored_revision
    )


def build_assistant_message_patch(
    *,
    content: str,
    agent_steps: Iterable[dict[str, Any]],
    primary_agent: Optional[str],
    revision: int,
    updated_at: Any,
    message_patch: MessagePatchInputV1 | None = None,
    accumulated_state_delta: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Build canonical assistant-message patch payload from ``MessagePatchInputV1``."""
    rev = normalize_revision(revision)
    if message_patch is None:
        message_patch = message_patch_input_from_accumulator(
            accumulated_state_delta or {},
            revision=rev,
            agent_steps=list(agent_steps),
            client_routing_hint=primary_agent,
        )
    payload = firestore_fields_from_message_patch_input(
        message_patch,
        content=content,
        updated_at=updated_at,
    )
    payload["revision"] = rev
    if primary_agent and not payload.get("primaryAgent"):
        payload["primaryAgent"] = primary_agent
    return payload


def validate_assistant_message_patch(patch: dict[str, Any]) -> None:
    """Fail-closed validation for assistant message patch payloads."""

    if not isinstance(patch, dict):
        raise ValueError("patch must be a dict")
    if patch.get("role") != "assistant":
        raise ValueError("role must be assistant")
    if not isinstance(patch.get("content"), str):
        raise ValueError("content must be a string")
    if not isinstance(patch.get("agentSteps"), list):
        raise ValueError("agentSteps must be a list")
    revision = patch.get("revision")
    if not isinstance(revision, int) or revision < 1:
        raise ValueError("revision must be a positive integer")
    content_schema_version = patch.get("contentSchemaVersion")
    if content_schema_version != 2:
        raise ValueError("contentSchemaVersion must be 2")
    if "contentMarkdown" in patch and not isinstance(patch.get("contentMarkdown"), str):
        raise ValueError("contentMarkdown must be a string when provided")
    content_json = patch.get("contentJson")
    if content_json is not None and not isinstance(content_json, dict):
        raise ValueError("contentJson must be an object or null")


def apply_patches_deterministically(
    patches: Iterable[dict[str, Any]],
    *,
    initial_revision: int = 0,
) -> tuple[int, dict[str, Any]]:
    """
    Apply patches with monotonic revision semantics.

    Used by tests to prove out-of-order + duplicate retries converge to
    deterministic final state.
    """

    revision = normalize_revision(initial_revision, default=0)
    state: dict[str, Any] = {}
    for patch in patches:
        incoming = normalize_revision((patch or {}).get("revision"), default=0)
        if should_apply_patch(incoming_revision=incoming, stored_revision=revision):
            revision = incoming
            state = dict(patch)
    return revision, state


def constrain_content_json_size(
    content_json: dict[str, Any] | None,
    *,
    max_bytes: int,
) -> tuple[dict[str, Any] | None, bool]:
    """
    Enforce a hard serialized size budget for contentJson.

    Truncation order is deterministic:
      1. Drop heavy checkpoint details.
      2. Drop service provider lists.
      3. Drop DIY media/product lists.
      4. Drop synthesis markdown summary.
    """

    if content_json is None:
        return None, False
    if max_bytes <= 0:
        return None, True

    def _encoded_size(value: Any) -> int:
        return len(json.dumps(value, ensure_ascii=False, separators=(",", ":")).encode("utf-8"))

    if _encoded_size(content_json) <= max_bytes:
        return content_json, False

    trimmed = json.loads(json.dumps(content_json, ensure_ascii=False))

    drop_paths = (
        ("analysis", "checkpointDetails"),
        ("analysis", "serviceResults", "localPros", "serpAPIResults"),
        ("analysis", "serviceResults", "localPros", "googleSearchResults"),
        ("analysis", "serviceResults", "localPros", "yelpAPIResults"),
        ("analysis", "diyResults", "youtubeSearch", "videos"),
        ("analysis", "diyResults", "recommendedProducts", "products"),
        ("analysis", "synthesis", "markdownSummary"),
    )

    def _drop_path(root: dict[str, Any], path: tuple[str, ...]) -> bool:
        node: Any = root
        for part in path[:-1]:
            if not isinstance(node, dict):
                return False
            node = node.get(part)
        if not isinstance(node, dict):
            return False
        return node.pop(path[-1], None) is not None

    for path in drop_paths:
        if _drop_path(trimmed, path) and _encoded_size(trimmed) <= max_bytes:
            return trimmed, True

    if _encoded_size(trimmed) > max_bytes:
        return {"analysis": {"title": "Analysis summary truncated due to size limits."}}, True

    return trimmed, True

