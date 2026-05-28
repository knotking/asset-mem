"""ADK-aligned merge for tool ``state_delta`` (dict deep-merge + list accumulation)."""

from __future__ import annotations

from copy import deepcopy
from typing import Any

from google.adk.flows.llm_flows.functions import deep_merge_dicts


def _merge_list_values(
    key: str,
    existing: list[Any],
    incoming: list[Any],
    *,
    list_dedupe_keys: frozenset[str],
) -> list[Any]:
    combined = existing + incoming
    if key not in list_dedupe_keys:
        return combined
    seen: set[Any] = set()
    out: list[Any] = []
    for item in combined:
        if item in seen:
            continue
        seen.add(item)
        out.append(item)
    return out


def merge_state_delta(
    existing: dict[str, Any] | None,
    incoming: dict[str, Any],
    *,
    list_dedupe_keys: frozenset[str] = frozenset(),
) -> dict[str, Any]:
    """Merge ``incoming`` into ``existing`` for session/tool state deltas.

    Mirrors ADK parallel tool merge semantics (``deep_merge_dicts`` for nested
    dicts; concatenate when both sides hold lists — see adk-python #5190).
    """
    if not incoming:
        return dict(existing or {})
    if not existing:
        return deepcopy(incoming)

    merged = deepcopy(existing)
    for key, value in incoming.items():
        if key in merged and isinstance(merged[key], list) and isinstance(value, list):
            merged[key] = _merge_list_values(
                key, merged[key], value, list_dedupe_keys=list_dedupe_keys
            )
        elif (
            key in merged and isinstance(merged[key], dict) and isinstance(value, dict)
        ):
            merged[key] = deep_merge_dicts(deepcopy(merged[key]), deepcopy(value))
        else:
            merged[key] = value
    return merged
