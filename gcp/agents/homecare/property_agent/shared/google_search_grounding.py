"""Google Search grounding helpers (tool wiring for Vertex vs AI Studio)."""

from __future__ import annotations

import logging
import os
from typing import Any, Callable

from google.genai import types


def text_from_generate_content_response(response: Any) -> str:
    """
    Extract prose from a ``google.genai`` ``generate_content`` response.

    Grounded calls sometimes leave ``response.text`` empty while text lives in
    ``candidates[].content.parts`` (same issue ADK warns about for function_call
    parts). Concatenate all text parts across candidates.
    """
    if response is None:
        return ""

    direct = getattr(response, "text", None)
    if isinstance(direct, str) and direct.strip():
        return direct.strip()

    chunks: list[str] = []
    for candidate in getattr(response, "candidates", None) or []:
        content = getattr(candidate, "content", None)
        if content is None:
            continue
        for part in getattr(content, "parts", None) or []:
            part_text = getattr(part, "text", None)
            if isinstance(part_text, str) and part_text:
                chunks.append(part_text)

    joined = "".join(chunks).strip()
    if joined:
        return joined

    if isinstance(direct, str):
        return direct.strip()
    return ""


def grounded_generate_max_attempts() -> int:
    """Retries for intermittent empty grounded ``generate_content`` responses."""
    raw = os.getenv("GROUNDED_GENERATE_MAX_ATTEMPTS", "2").strip()
    try:
        n = int(raw)
    except ValueError:
        return 2
    return max(1, min(n, 4))


def finish_reason_from_response(response: Any) -> str:
    candidates = getattr(response, "candidates", None) or []
    if not candidates:
        return "no_candidates"
    reason = getattr(candidates[0], "finish_reason", None)
    return str(reason) if reason is not None else "unknown"


def usage_metadata_summary(response: Any) -> str:
    usage = getattr(response, "usage_metadata", None)
    if usage is None:
        return "usage=?"
    parts: list[str] = []
    for attr in (
        "prompt_token_count",
        "candidates_token_count",
        "thoughts_token_count",
        "total_token_count",
    ):
        value = getattr(usage, attr, None)
        if value is not None:
            parts.append(f"{attr}={value}")
    return " ".join(parts) if parts else "usage=?"


def part_kind_summary(response: Any) -> str:
    text_parts = thought_parts = other_parts = 0
    for candidate in getattr(response, "candidates", None) or []:
        content = getattr(candidate, "content", None)
        if content is None:
            continue
        for part in getattr(content, "parts", None) or []:
            if getattr(part, "thought", False):
                thought_parts += 1
            elif isinstance(getattr(part, "text", None), str) and part.text:
                text_parts += 1
            else:
                other_parts += 1
    return f"parts text={text_parts} thought={thought_parts} other={other_parts}"


def log_grounded_response_usage(
    logger: logging.Logger,
    response: Any,
    *,
    label: str,
    attempt: int,
    max_attempts: int,
    text_len: int,
) -> None:
    """Log finish_reason and usage_metadata for grounded generate_content calls."""
    outcome = "ok" if text_len > 0 else "empty"
    logger.info(
        "%s: grounded %s finish_reason=%s %s %s text_len=%d attempt=%d/%d",
        label,
        outcome,
        finish_reason_from_response(response),
        usage_metadata_summary(response),
        part_kind_summary(response),
        text_len,
        attempt,
        max_attempts,
    )


def grounded_prose_with_retry(
    generate: Callable[[], Any],
    *,
    logger: logging.Logger,
    label: str,
    max_attempts: int | None = None,
) -> str:
    """
    Call ``generate()`` (a ``client.models.generate_content``) and extract prose.

    Grounded Gemini calls intermittently return HTTP 200 with no visible text;
    retry once or twice before giving up.
    """
    attempts = max_attempts if max_attempts is not None else grounded_generate_max_attempts()
    for attempt in range(1, attempts + 1):
        try:
            response = generate()
        except Exception as exc:
            if attempt >= attempts:
                logger.exception(
                    "%s: grounded generate_content failed on final attempt (%s: %s)",
                    label,
                    type(exc).__name__,
                    exc,
                )
                return ""
            logger.warning(
                "%s: grounded generate_content failed attempt %d/%d (%s: %s), retrying",
                label,
                attempt,
                attempts,
                type(exc).__name__,
                exc,
            )
            continue

        text = text_from_generate_content_response(response)
        log_grounded_response_usage(
            logger,
            response,
            label=label,
            attempt=attempt,
            max_attempts=attempts,
            text_len=len(text),
        )
        if text:
            return text

    return ""


def uses_vertex_ai() -> bool:
    """Homecare direct ``generate_content`` paths use Vertex (see ``LEGACY_API_GEMINI``)."""
    raw = os.getenv("GOOGLE_GENAI_USE_VERTEXAI", "1").strip().lower()
    return raw not in ("0", "false", "no", "off")


def dynamic_retrieval_enabled() -> bool:
    """
    When true on AI Studio, use ``google_search_retrieval`` with a dynamic threshold.

    Not supported on Vertex — ``google_search_grounding_tool`` always uses ``google_search`` there.
    """
    raw = os.getenv("GOOGLE_SEARCH_DYNAMIC_RETRIEVAL", "true").strip().lower()
    return raw not in ("0", "false", "no", "off")


def dynamic_retrieval_threshold() -> float:
    """
    Ground only when the model's retrieval predictor score is >= this value (0–1).

    Applies to AI Studio ``google_search_retrieval`` only.
    """
    raw = os.getenv("GOOGLE_SEARCH_DYNAMIC_THRESHOLD", "0.45").strip()
    try:
        value = float(raw)
    except ValueError:
        return 0.45
    return max(0.0, min(value, 1.0))


def google_search_grounding_tool() -> types.Tool:
    """
    Tool for Gemini ``generate_content`` with Google Search grounding.

    Vertex AI requires ``google_search`` (``google_search_retrieval`` returns 400 INVALID_ARGUMENT).
    AI Studio may use ``google_search_retrieval`` with dynamic retrieval when enabled.
    """
    if uses_vertex_ai() or not dynamic_retrieval_enabled():
        return types.Tool(google_search=types.GoogleSearch())
    return types.Tool(
        google_search_retrieval=types.GoogleSearchRetrieval(
            dynamic_retrieval_config=types.DynamicRetrievalConfig(
                mode=types.DynamicRetrievalConfigMode.MODE_DYNAMIC,
                dynamic_threshold=dynamic_retrieval_threshold(),
            )
        )
    )
