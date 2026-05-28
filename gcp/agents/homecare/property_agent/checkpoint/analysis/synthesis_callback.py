"""Prose-only synthesis callback (Orchestrator V2 — no dual-format fences)."""

from __future__ import annotations

import logging
import re
from typing import Optional

from google.adk.agents.callback_context import CallbackContext
from google.adk.models.llm_response import LlmResponse
from google.genai import types

from property_agent.checkpoint.analysis.analysis_validate import (
    extract_text_from_llm_response,
    llm_response_declares_tool_use,
    llm_response_is_streaming_partial,
    strip_json_fences,
)
from property_agent.checkpoint.analysis.assembler import stash_checkpoint_analysis_in_state
from property_agent.checkpoint.constants import CHECKPOINT_ANALYSIS_MARKDOWN_STATE_KEY
from property_agent.checkpoint.timing import record_synthesis_ms

logger = logging.getLogger(__name__)

_JSON_FENCE_RE = re.compile(r"```json\s*\n?[\s\S]*?```", re.IGNORECASE)


def synthesis_after_model_callback(
    callback_context: CallbackContext,
    llm_response: LlmResponse,
) -> Optional[LlmResponse]:
    """Store markdown-only synthesis; structured JSON comes from the assembler."""
    if llm_response_declares_tool_use(llm_response):
        return None
    if llm_response_is_streaming_partial(llm_response):
        return None

    text = strip_json_fences(extract_text_from_llm_response(llm_response)).strip()
    text = _JSON_FENCE_RE.sub("", text).strip()
    if not text:
        return None

    record_synthesis_ms(callback_context.state)
    if hasattr(callback_context.state, "__setitem__"):
        callback_context.state[CHECKPOINT_ANALYSIS_MARKDOWN_STATE_KEY] = text

    analysis = callback_context.state.get("checkpoint_analysis")
    if isinstance(analysis, dict):
        from property_agent.checkpoint.analysis.analysis_normalize import (
            apply_analysis_title_from_markdown,
            normalize_assembled_analysis,
        )
        from property_agent.checkpoint.constants import (
            CHECKPOINT_RETRIEVAL_SEARCH_QUERY_KEY,
        )

        apply_analysis_title_from_markdown(analysis, text)
        pa = str(callback_context.state.get("property_address") or "").strip() or None
        stem = (
            str(callback_context.state.get(CHECKPOINT_RETRIEVAL_SEARCH_QUERY_KEY) or "")
            .strip()
            or None
        )
        normalize_assembled_analysis(
            analysis,
            property_address=pa,
            retrieval_search_query=stem,
            markdown_source=text,
        )
        stash_checkpoint_analysis_in_state(callback_context.state, analysis)

    if text != extract_text_from_llm_response(llm_response):
        new_content = types.Content(role="model", parts=[types.Part(text=text)])
        return llm_response.model_copy(update={"content": new_content})
    return None
