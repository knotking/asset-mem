"""Aggregate token counts from google-genai responses."""

from __future__ import annotations

import logging
from typing import Any, Dict, Tuple

logger = logging.getLogger(__name__)


def _coerce_int(value: Any) -> int:
    if value is None:
        return 0
    try:
        return int(value)
    except (TypeError, ValueError):
        return 0


def _deltas_from_usage_metadata(um: Any) -> Tuple[int, int, int]:
    """Parse google-genai usage_metadata object or dict -> (prompt, candidates, total)."""
    if um is None:
        return (0, 0, 0)

    def pick(*names: str) -> int:
        for n in names:
            if isinstance(um, dict):
                v = um.get(n)
            else:
                v = getattr(um, n, None)
            if v is not None:
                return _coerce_int(v)
        return 0

    prompt = pick("prompt_token_count", "promptTokenCount")
    candidates = pick(
        "candidates_token_count",
        "candidatesTokenCount",
        "output_token_count",
        "outputTokenCount",
    )
    total = pick("total_token_count", "totalTokenCount")
    return (prompt, candidates, total)


def new_llm_usage_sink() -> Dict[str, int]:
    return {"prompt": 0, "candidates": 0, "total_only": 0, "gemini_calls": 0}


def accumulate_google_genai_generate_response(sink: Dict[str, int], response: Any) -> None:
    """Record tokens from a ``client.models.generate_content`` response (mutates sink)."""
    sink["gemini_calls"] = sink.get("gemini_calls", 0) + 1
    um = getattr(response, "usage_metadata", None)
    if um is None:
        logger.debug("LLM usage: generate_content response has no usage_metadata")
        return
    prompt, candidates, total = _deltas_from_usage_metadata(um)
    if prompt or candidates:
        sink["prompt"] = sink.get("prompt", 0) + prompt
        sink["candidates"] = sink.get("candidates", 0) + candidates
        logger.debug(
            "LLM usage: generate_content +prompt=%s +candidates=%s raw=%r",
            prompt,
            candidates,
            um,
        )
    elif total:
        sink["total_only"] = sink.get("total_only", 0) + total
        logger.debug("LLM usage: generate_content +total_only=%s raw=%r", total, um)


def accumulate_google_genai_embed_response(sink: Dict[str, int], result: Any) -> None:
    """Record tokens from a ``client.models.embed_content`` result (mutates sink)."""
    sink["gemini_calls"] = sink.get("gemini_calls", 0) + 1
    um = getattr(result, "usage_metadata", None)
    if um is None:
        logger.debug("LLM usage: embed_content result has no usage_metadata")
        return
    prompt, candidates, total = _deltas_from_usage_metadata(um)
    if prompt or candidates:
        sink["prompt"] = sink.get("prompt", 0) + prompt
        sink["candidates"] = sink.get("candidates", 0) + candidates
        logger.debug(
            "LLM usage: embed_content +prompt=%s +candidates=%s raw=%r",
            prompt,
            candidates,
            um,
        )
    elif total:
        sink["total_only"] = sink.get("total_only", 0) + total
        logger.debug("LLM usage: embed_content +total_only=%s raw=%r", total, um)
