"""Homecare bindings for platform message patch contracts."""

from __future__ import annotations

from typing import Any, Mapping

from agent_framework.contracts.message_patch_v1 import (
    message_patch_input_from_accumulator,
    state_delta_from_message_patch_input,
)
from agent_framework.contracts.v1 import MessagePatchInputV1


def build_state_delta_message_patch(
    *,
    content_markdown: str,
    content_json: dict[str, Any] | None,
    analysis_run_id: str,
    branch_completed: str = "",
) -> dict[str, Any]:
    """Build V2 ``state_delta`` message keys aligned with ``MessagePatchInputV1``."""
    from property_agent.checkpoint.constants import CHECKPOINT_BRANCH_COMPLETED_STATE_KEY

    patch = MessagePatchInputV1(
        content_markdown=content_markdown,
        content_json=content_json,
        revision=0,
        client_routing_hint=None,
        agent_steps=[],
        analysis_run_id=analysis_run_id,
    )
    delta = state_delta_from_message_patch_input(patch)
    if branch_completed:
        delta[CHECKPOINT_BRANCH_COMPLETED_STATE_KEY] = branch_completed
    return delta


def message_patch_input_from_state_delta_accumulator(
    accumulated: Mapping[str, Any],
    *,
    revision: int,
    agent_steps: list[dict[str, Any]],
    client_routing_hint: str | None = None,
) -> MessagePatchInputV1:
    return message_patch_input_from_accumulator(
        accumulated,
        revision=revision,
        agent_steps=agent_steps,
        client_routing_hint=client_routing_hint,
    )
