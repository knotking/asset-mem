"""ADK after_model callbacks for checkpoint flows (single-hop executor)."""

from __future__ import annotations

import json
import logging
from typing import Any, Dict, Optional

from google.adk.agents.callback_context import CallbackContext
from google.adk.models.llm_response import LlmResponse
from google.genai import types

from ..checkpoint_request_timing import (
    emit_checkpoint_request_timing,
    record_executor_ms,
    record_synthesis_ms,
    set_return_chars,
)
from .constants import (
    CHECKPOINT_ANALYSIS_PROGRESS_STATE_KEY,
    CHECKPOINT_PROGRESS_EMIT_SEQ_STATE_KEY,
    CHECKPOINT_PROGRESS_LAST_EMITTED_SEQ_STATE_KEY,
)
from .dual_format_body import (
    build_fallback_analysis,
    dual_format_has_valid_analysis_json,
    dual_format_is_passthrough_quality,
    enrich_dual_format_markdown,
    extract_analysis_object_from_dual_format,
    extract_text_from_llm_response,
    llm_response_declares_tool_use,
    llm_response_is_streaming_partial,
    markdown_has_rich_analysis_sections,
    merge_parallel_results_into_dual_format,
    normalize_checkpoint_optional_agents,
    patch_dual_format_from_state,
    rebuild_dual_format_from_analysis,
    resolve_passthrough_dual_format_from_state,
    stash_checkpoint_dual_format_in_state,
    strip_json_fences,
    analysis_has_structured_ui_sections,
)

logger = logging.getLogger(__name__)


def ensure_dual_format_body(
    body: str,
    *,
    parallel_results_json: Optional[str] = None,
    checkpoint_results: str = "",
) -> str:
    """Strip invalid ```json fences; append JSON only when parallel branches supply UI sections."""
    if dual_format_is_passthrough_quality(body):
        return body
    base = strip_json_fences(body).rstrip()
    parallel: Optional[Dict[str, Any]] = None
    if parallel_results_json and parallel_results_json.strip():
        try:
            parallel = json.loads(parallel_results_json)
        except json.JSONDecodeError:
            parallel = None
    analysis = build_fallback_analysis(
        parallel_blob=parallel,
        markdown_source=body or base,
        checkpoint_results=checkpoint_results,
    )
    if not analysis_has_structured_ui_sections(analysis):
        return base
    draft = (
        base
        + "\n\n```json\n"
        + json.dumps({"analysis": analysis}, ensure_ascii=False, indent=2)
        + "\n```\n"
    )
    return enrich_dual_format_markdown(draft)


def synthesis_after_model_callback(
    callback_context: CallbackContext,
    llm_response: LlmResponse,
) -> Optional[LlmResponse]:
    """ADK hook: checkpoint analysis synthesizer must emit markdown + valid analysis JSON."""
    if llm_response_declares_tool_use(llm_response):
        return None
    if llm_response_is_streaming_partial(llm_response):
        return None
    text = extract_text_from_llm_response(llm_response)
    text = patch_dual_format_from_state(text, callback_context.state)
    parallel = callback_context.state.get("checkpoint_parallel_results")
    par_str = parallel if isinstance(parallel, str) else None

    if par_str:
        merged = merge_parallel_results_into_dual_format(
            text, parallel_results_json=par_str
        )
        if merged != text:
            logger.info(
                "checkpoint_analysis_synthesis: merged parallel branch payloads into response"
            )
            text = merged

    if dual_format_has_valid_analysis_json(text):
        enriched = enrich_dual_format_markdown(text)
        if enriched != text:
            logger.info(
                "checkpoint_analysis_synthesis: enriched markdown from analysis JSON"
            )
            text = enriched

    analysis = extract_analysis_object_from_dual_format(text)
    if isinstance(analysis, dict) and analysis.get("analysisStatus"):
        analysis = dict(analysis)
        analysis.pop("analysisStatus", None)
        text = rebuild_dual_format_from_analysis(
            analysis,
            markdown_source=text,
            user_query=(
                callback_context.state.get("user_query")
                if hasattr(callback_context.state, "get")
                else ""
            )
            or "",
        )

    record_synthesis_ms(callback_context.state)
    stash_checkpoint_dual_format_in_state(callback_context.state, text)

    if dual_format_is_passthrough_quality(text):
        if text != extract_text_from_llm_response(llm_response):
            new_content = types.Content(role="model", parts=[types.Part(text=text)])
            return llm_response.model_copy(update={"content": new_content})
        return None

    ck_results = callback_context.state.get("checkpoint_results")
    ck_blob = ck_results if isinstance(ck_results, str) else ""
    fixed = ensure_dual_format_body(
        text, parallel_results_json=par_str, checkpoint_results=ck_blob
    )
    if fixed == text:
        return None
    appended_json = "```json" in fixed and "```json" not in text
    logger.warning(
        "checkpoint_analysis_synthesis: model output missing valid ```json``` block; "
        "repaired response (parallel_state=%s, appended_json=%s)",
        "yes" if par_str else "no",
        appended_json,
    )
    fixed = enrich_dual_format_markdown(fixed)
    new_content = types.Content(role="model", parts=[types.Part(text=fixed)])
    return llm_response.model_copy(update={"content": new_content})


def checkpoint_agent_after_model_callback(
    callback_context: CallbackContext,
    llm_response: LlmResponse,
) -> Optional[LlmResponse]:
    """ADK hook: checkpoint_agent (simple query or passthrough) must keep dual format."""
    if llm_response_declares_tool_use(llm_response):
        return None
    if llm_response_is_streaming_partial(llm_response):
        return None
    text = extract_text_from_llm_response(llm_response)
    parallel = callback_context.state.get("checkpoint_parallel_results")
    par_str = parallel if isinstance(parallel, str) else None
    stashed = resolve_passthrough_dual_format_from_state(callback_context.state)

    requested = normalize_checkpoint_optional_agents(
        callback_context.state.get("checkpoint_optional_agents")
    )
    if requested:
        text = patch_dual_format_from_state(text, callback_context.state)
        analysis = extract_analysis_object_from_dual_format(text)
        if not isinstance(analysis, dict) or not analysis.get("analysisStatus"):
            progress = callback_context.state.get(
                CHECKPOINT_ANALYSIS_PROGRESS_STATE_KEY
            )
            if isinstance(progress, str) and progress.strip():
                text = patch_dual_format_from_state(progress, callback_context.state)

    if stashed and not dual_format_is_passthrough_quality(text):
        stashed = enrich_dual_format_markdown(stashed)
        logger.info(
            "checkpoint_agent: restored dual-format from analysis workflow stash "
            "(model_chars=%d stash_chars=%d)",
            len(text or ""),
            len(stashed),
        )
        new_content = types.Content(role="model", parts=[types.Part(text=stashed)])
        return llm_response.model_copy(update={"content": new_content})

    if dual_format_is_passthrough_quality(text):
        text = patch_dual_format_from_state(text, callback_context.state)
        enriched = enrich_dual_format_markdown(text)
        if enriched != text:
            text = enriched
        stash_checkpoint_dual_format_in_state(callback_context.state, text)
        if text != extract_text_from_llm_response(llm_response):
            new_content = types.Content(role="model", parts=[types.Part(text=text)])
            return llm_response.model_copy(update={"content": new_content})
        return None

    ck_results = callback_context.state.get("checkpoint_results")
    ck_blob = ck_results if isinstance(ck_results, str) else ""
    fixed = ensure_dual_format_body(
        text, parallel_results_json=par_str, checkpoint_results=ck_blob
    )
    fixed = patch_dual_format_from_state(fixed, callback_context.state)
    if fixed == text:
        return None
    appended_json = "```json" in fixed and "```json" not in text
    logger.warning(
        "checkpoint_agent: model output missing valid ```json``` block; "
        "repaired response (parallel_state=%s, appended_json=%s)",
        "yes" if par_str else "no",
        appended_json,
    )
    fixed = enrich_dual_format_markdown(fixed)
    stash_checkpoint_dual_format_in_state(callback_context.state, fixed)
    new_content = types.Content(role="model", parts=[types.Part(text=fixed)])
    return llm_response.model_copy(update={"content": new_content})


def executor_progressive_streaming_callback(
    callback_context: CallbackContext,
    llm_response: LlmResponse,
) -> Optional[LlmResponse]:
    """
    While the executor streams a follow-up turn, emit the latest stashed checkpoint
    progress body when the progress sequence advances (pairs with sub-agent events).
    """
    if llm_response_declares_tool_use(llm_response):
        return None
    if not llm_response_is_streaming_partial(llm_response):
        return None
    state = callback_context.state
    if state is None or not hasattr(state, "get"):
        return None
    stashed = state.get(CHECKPOINT_ANALYSIS_PROGRESS_STATE_KEY)
    if not isinstance(stashed, str) or not dual_format_has_valid_analysis_json(stashed):
        return None
    seq = state.get(CHECKPOINT_PROGRESS_EMIT_SEQ_STATE_KEY, 0)
    last = state.get(CHECKPOINT_PROGRESS_LAST_EMITTED_SEQ_STATE_KEY, -1)
    try:
        seq_i = int(seq)
        last_i = int(last)
    except (TypeError, ValueError):
        return None
    if seq_i <= last_i:
        return None
    state[CHECKPOINT_PROGRESS_LAST_EMITTED_SEQ_STATE_KEY] = seq_i
    body = enrich_dual_format_markdown(stashed)
    logger.info(
        "property_agent: streaming checkpoint progress (seq=%d chars=%d)",
        seq_i,
        len(body),
    )
    new_content = types.Content(role="model", parts=[types.Part(text=body)])
    return llm_response.model_copy(update={"content": new_content, "partial": True})


def _skip_checkpoint_dual_format_echo(state: Any, *, model_text: str = "") -> bool:
    """Skip stash echo unless this invocation ran structured analysis or user asked for replay."""
    _ = model_text
    from property_agent.conversational_intent import (
        executor_invocation_requested_structured_analysis,
        query_requests_full_analysis_replay,
    )
    from property_agent.resolve_turn import resolved_turn_from_state

    if str(state.get("primary_agent") or "").strip().lower() == "docs":
        return True

    resolved = resolved_turn_from_state(state)
    expanded = ""
    user_goal = ""
    if resolved is not None:
        expanded = str(resolved.expanded_user_query or "").strip()
        user_goal = str(resolved.user_goal or "")
        if resolved.route in ("user_docs", "knowledge_base"):
            return True
    else:
        raw = state.get("resolved_turn")
        if isinstance(raw, dict):
            expanded = str(raw.get("expanded_user_query") or "").strip()
            user_goal = str(raw.get("user_goal") or "")
            if raw.get("route") in ("user_docs", "knowledge_base"):
                return True

    if user_goal == "replay_deliverable" or query_requests_full_analysis_replay(
        expanded
    ) or query_requests_full_analysis_replay(str(state.get("user_query") or "")):
        return False

    if executor_invocation_requested_structured_analysis(state):
        return False

    return True


def executor_after_model_callback(
    callback_context: CallbackContext,
    llm_response: LlmResponse,
) -> Optional[LlmResponse]:
    """
    When checkpoint_agent returned dual-format output, echo it verbatim with rich markdown.

    The executor can re-stream JSON fragments instead of the tool payload; restore stash.

    Only act on the final model chunk; during streaming this callback fires once per
    partial and would otherwise emit the full stash as a duplicate event each time.
    """
    text = extract_text_from_llm_response(llm_response)
    if _skip_checkpoint_dual_format_echo(callback_context.state, model_text=text):
        return None
    if llm_response_declares_tool_use(llm_response):
        return None
    if llm_response_is_streaming_partial(llm_response):
        return None
    stashed = resolve_passthrough_dual_format_from_state(callback_context.state)
    if not stashed:
        return None
    stashed = enrich_dual_format_markdown(stashed)
    record_executor_ms(callback_context.state)
    model_ok = dual_format_is_passthrough_quality(
        text
    ) and markdown_has_rich_analysis_sections(strip_json_fences(text))
    if model_ok and text.strip() == stashed.strip():
        final_body = text
    elif not (text or "").strip() or not model_ok:
        logger.info(
            "property_agent: echoing checkpoint dual-format (model_chars=%d stash_chars=%d)",
            len(text or ""),
            len(stashed),
        )
        final_body = stashed
    elif not markdown_has_rich_analysis_sections(strip_json_fences(text)):
        logger.info(
            "property_agent: replacing thin markdown with enriched checkpoint output"
        )
        final_body = stashed
    else:
        final_body = text

    set_return_chars(callback_context.state, len(final_body))
    emit_checkpoint_request_timing(
        callback_context.state,
        return_chars=len(final_body),
        source="executor_final",
    )

    if final_body != text:
        new_content = types.Content(role="model", parts=[types.Part(text=final_body)])
        return llm_response.model_copy(update={"content": new_content})
    return None
