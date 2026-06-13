"""Homecare session state_delta merge bindings."""

from __future__ import annotations

from typing import Any

from agent_platform.core.state.state_delta_merge import merge_state_delta

HOMECARE_LIST_DEDUPE_KEYS = frozenset(
    {
        "checkpoint_optional_agents",
        "checkpoint_ids",
        "context_doc_uris",
    }
)


def merge_homecare_state_delta(
    existing: dict[str, Any] | None,
    incoming: dict[str, Any],
) -> dict[str, Any]:
    return merge_state_delta(
        existing, incoming, list_dedupe_keys=HOMECARE_LIST_DEDUPE_KEYS
    )
