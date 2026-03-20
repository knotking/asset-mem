"""
Accumulates LLM token usage from Reasoning Engine stream events and writes per-user totals to Firestore.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional, Tuple

from common.token import TOKEN_USAGE_COLLECTION, persist_firestore_token_totals

logger = logging.getLogger(__name__)

_INT_KEYS = (
    ("prompt_token_count", "promptTokenCount"),
    ("candidates_token_count", "candidatesTokenCount", "output_token_count", "outputTokenCount"),
    ("total_token_count", "totalTokenCount"),
)


def _coerce_int(value: Any) -> int:
    if value is None:
        return 0
    try:
        return int(value)
    except (TypeError, ValueError):
        return 0


def _normalize_usage_blob(blob: Dict[str, Any]) -> Optional[Tuple[int, int, int]]:
    """Returns (prompt, candidates, total) if any token field is present."""
    if not blob or not isinstance(blob, dict):
        return None
    prompt = max(_coerce_int(blob.get(k)) for k in _INT_KEYS[0])
    candidates = max(_coerce_int(blob.get(k)) for k in _INT_KEYS[1])
    total = max(_coerce_int(blob.get(k)) for k in _INT_KEYS[2])
    if not prompt and not candidates and not total:
        return None
    return (prompt, candidates, total)


def _usage_blobs_from_obj(obj: Any, depth: int = 0, max_depth: int = 6) -> List[Dict[str, Any]]:
    """Collect usage metadata dicts from nested event JSON."""
    found: List[Dict[str, Any]] = []
    if depth > max_depth or not isinstance(obj, dict):
        return found
    for key in ("usageMetadata", "usage_metadata"):
        if key in obj and isinstance(obj[key], dict):
            found.append(obj[key])
    for value in obj.values():
        if isinstance(value, dict):
            found.extend(_usage_blobs_from_obj(value, depth + 1, max_depth))
        elif isinstance(value, list):
            for item in value:
                if isinstance(item, dict):
                    found.extend(_usage_blobs_from_obj(item, depth + 1, max_depth))
    return found


def accumulate_usage_from_stream_event(
    running: Dict[str, int], event: Any, *, event_index: Optional[int] = None
) -> None:
    """Adds token counts from a single stream event into running totals (mutates running)."""
    ev = f"[event={event_index}] " if event_index is not None else ""
    if not isinstance(event, dict):
        logger.debug("%sToken usage: skip non-dict stream chunk type=%s", ev, type(event).__name__)
        return

    blobs = _usage_blobs_from_obj(event)
    author = event.get("author")
    partial = event.get("partial")
    turn_complete = event.get("turn_complete")
    if not blobs:
        logger.debug(
            "%sToken usage: no usageMetadata in stream chunk author=%r partial=%s turn_complete=%s "
            "top_level_keys=%s",
            ev,
            author,
            partial,
            turn_complete,
            list(event.keys()),
        )
    else:
        logger.debug(
            "%sToken usage: found %d usage blob(s) author=%r partial=%s",
            ev,
            len(blobs),
            author,
            partial,
        )

    for blob in blobs:
        normalized = _normalize_usage_blob(blob)
        if not normalized:
            logger.debug("%sToken usage: usage blob has no token integer fields keys=%s", ev, list(blob.keys()))
            continue
        prompt, candidates, total = normalized
        if prompt or candidates:
            running["prompt"] += prompt
            running["candidates"] += candidates
            logger.debug(
                "%sToken usage: delta +prompt=%s +candidates=%s (running prompt=%s candidates=%s total_only=%s) "
                "raw_blob=%s",
                ev,
                prompt,
                candidates,
                running["prompt"],
                running["candidates"],
                running["total_only"],
                blob,
            )
        elif total:
            running["total_only"] += total
            logger.debug(
                "%sToken usage: delta total_only +%s (running total_only=%s) raw_blob=%s",
                ev,
                total,
                running["total_only"],
                blob,
            )


def persist_user_token_usage(user_id: str, running: Dict[str, int]) -> None:
    """Increment Firestore aggregates for one completed agent stream."""
    prompt = running.get("prompt") or 0
    candidates = running.get("candidates") or 0
    total_only = running.get("total_only") or 0
    combined = prompt + candidates
    total_delta = combined if combined else total_only

    if not user_id:
        logger.debug(
            "Token usage persist: skipped (no user_id) would_have_running=%s",
            dict(running),
        )
        return
    if total_delta == 0:
        logger.debug(
            "Token usage persist: skipped (zero delta) user_id=%s running=%s",
            user_id,
            dict(running),
        )
        return

    logger.debug(
        "Token usage persist: applying increments user_id=%s collection=%s "
        "+inputTokens=%s +outputTokens=%s +totalTokens=%s +agentStreamCount=1",
        user_id,
        TOKEN_USAGE_COLLECTION,
        prompt,
        candidates,
        total_delta,
    )
    persist_firestore_token_totals(
        user_id,
        running,
        agent_stream_increment=1,
    )
