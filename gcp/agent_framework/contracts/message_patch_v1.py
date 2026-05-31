"""V1 message patch wire format between agent state_delta and Firestore persist."""

from __future__ import annotations

from typing import Any, Mapping

from agent_framework.contracts.message_patch_types import (
    MESSAGE_PATCH_SCHEMA_VERSION,
    MessagePatchInputV1,
)

# Reasoning Engine state_delta keys merged into assistant message documents.
STATE_DELTA_MESSAGE_PATCH_KEYS: tuple[str, ...] = (
    "contentMarkdown",
    "contentJson",
    "analysisRunId",
)

# Firestore assistant message fields derived from MessagePatchInputV1.
FIRESTORE_MESSAGE_PATCH_FIELDS: tuple[str, ...] = (
    "contentMarkdown",
    "contentJson",
    "analysisRunId",
    "agentSteps",
    "agentLifecycle",
)


def merge_state_delta_message_keys(
    delta: Mapping[str, Any],
    current: Mapping[str, Any] | None,
) -> dict[str, Any]:
    """
    Merge recognized message keys from ``actions.state_delta`` into an accumulator.

    Returns camelCase keys (``contentMarkdown``, ``contentJson``, ``analysisRunId``).
    ``contentJson`` values are shallow-merged at the top level; branch-aware merge is
    applied by the proxy (``merge_branch_into_content_json``).
    """
    result: dict[str, Any] = dict(current or {})
    if not isinstance(delta, Mapping):
        return result

    content_markdown = delta.get("contentMarkdown")
    if isinstance(content_markdown, str):
        result["contentMarkdown"] = content_markdown

    analysis_run_id = delta.get("analysisRunId")
    if isinstance(analysis_run_id, str) and analysis_run_id.strip():
        result["analysisRunId"] = analysis_run_id.strip()

    return result


def message_patch_input_from_accumulator(
    accumulated: Mapping[str, Any],
    *,
    revision: int,
    agent_steps: list[dict[str, Any]],
    client_routing_hint: str | None = None,
) -> MessagePatchInputV1:
    """Build platform contract from merged state_delta accumulator."""
    content_markdown = accumulated.get("contentMarkdown")
    content_json = accumulated.get("contentJson")
    analysis_run_id = accumulated.get("analysisRunId")
    return MessagePatchInputV1(
        content_markdown=content_markdown if isinstance(content_markdown, str) else "",
        content_json=content_json if isinstance(content_json, dict) else None,
        revision=revision,
        client_routing_hint=client_routing_hint,
        agent_steps=list(agent_steps),
        analysis_run_id=(
            analysis_run_id.strip()
            if isinstance(analysis_run_id, str) and analysis_run_id.strip()
            else None
        ),
    )


def state_delta_from_message_patch_input(patch: MessagePatchInputV1) -> dict[str, Any]:
    """Emit Reasoning Engine ``state_delta`` keys from a platform message patch."""
    delta: dict[str, Any] = {
        "contentMarkdown": patch.content_markdown,
    }
    if patch.content_json is not None:
        delta["contentJson"] = patch.content_json
    if patch.analysis_run_id:
        delta["analysisRunId"] = patch.analysis_run_id
    return delta


def firestore_fields_from_message_patch_input(
    patch: MessagePatchInputV1,
    *,
    content: str,
    updated_at: Any,
) -> dict[str, Any]:
    """
    Map ``MessagePatchInputV1`` to Firestore assistant message patch fields.

    Caller supplies legacy ``content`` (stream prose) and ``updatedAt``.
    """
    payload: dict[str, Any] = {
        "role": "assistant",
        "content": content,
        "agentSteps": list(patch.agent_steps),
        "revision": patch.revision,
        "updatedAt": updated_at,
        "contentMarkdown": patch.content_markdown,
        "contentJson": patch.content_json,
        "contentSchemaVersion": MESSAGE_PATCH_SCHEMA_VERSION,
    }
    if patch.client_routing_hint:
        payload["primaryAgent"] = patch.client_routing_hint
    if patch.analysis_run_id:
        payload["analysisRunId"] = patch.analysis_run_id
    return payload
