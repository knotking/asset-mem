"""Google Search grounding helpers (tool wiring for Vertex vs AI Studio)."""

from __future__ import annotations

import os

from google.genai import types


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
