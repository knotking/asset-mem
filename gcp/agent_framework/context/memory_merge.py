"""Deterministic merge helpers for session working memory maps."""

from __future__ import annotations


def merge_memory_maps(
    base: dict[str, object],
    incoming: dict[str, object],
    *,
    list_union_keys: tuple[str, ...] = (),
    dict_merge_keys: tuple[str, ...] = (),
) -> dict[str, object]:
    """Merge two memory maps with deterministic list/dict semantics."""

    merged = dict(base)
    for key, value in incoming.items():
        if value is None:
            continue
        if key in list_union_keys and isinstance(value, list):
            existing = merged.get(key)
            values = set(existing) if isinstance(existing, list) else set()
            values.update(value)
            merged[key] = sorted(values, key=str.lower)
            continue
        if key in dict_merge_keys and isinstance(value, dict):
            existing = merged.get(key)
            payload = dict(existing) if isinstance(existing, dict) else {}
            payload.update(value)
            merged[key] = payload
            continue
        if value:
            merged[key] = value
    return merged
