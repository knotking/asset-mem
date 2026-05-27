"""Short-circuit follow-ups that answer from session memory without the full executor."""

from __future__ import annotations

import json
import logging
import os
import time
from typing import TYPE_CHECKING, Any, Mapping, Optional, Sequence

from google.genai import types

from .conversational_intent import prior_checkpoint_analysis_in_session
from .model_config import GLOBAL_GEMINI_MODEL
from .query_mode import (
    build_session_working_memory,
    extract_service_provider_details,
    format_provider_context_answer,
    format_session_working_memory_block,
    needs_fresh_checkpoint_retrieval,
    query_references_known_provider,
    should_answer_provider_from_context,
    should_block_checkpoint_agent_for_context_turn,
)
if TYPE_CHECKING:
    from .resolve_turn import ResolvedTurn
from .sub_agents.checkpoint_dual_format.dual_format_body import (
    dual_format_has_valid_analysis_json,
)

logger = logging.getLogger(__name__)

_CONTEXT_ONLY_SYSTEM = """You are the AssetMem property care assistant.

Answer the user's follow-up using ONLY:
- [SESSION_WORKING_MEMORY] in the instructions (ground truth from prior analysis)
- recent_dialogue in INPUT_JSON (short excerpt)

Rules:
- Reply in concise, natural markdown prose (ChatGPT-like).
- Do NOT emit a ```json analysis block or Coverage/DIY/Service/Cost accordion payload.
- Do NOT call tools or offer to re-run full checkpoint analysis unless the user clearly asks for new analysis.
- If the user asks about an area or topic not covered in memory (e.g. kitchen when only garage was analyzed), say so clearly and offer to run a new inspection if helpful.
- For provider questions, use service_provider_details and service_providers_mentioned when present.
- When provider_focus is set in INPUT_JSON, answer ONLY about that provider from memory — never repeat an unrelated prior assistant reply from recent_dialogue.
- Never copy verbatim text from recent_dialogue as your answer.
"""


def context_only_short_circuit_disabled() -> bool:
    raw = (os.getenv("CONTEXT_ONLY_SHORT_CIRCUIT_DISABLED") or "").strip().lower()
    return raw in ("1", "true", "yes", "on")


def should_short_circuit_context_only_turn(
    resolved: ResolvedTurn,
    *,
    state: Mapping[str, Any] | None,
    user_query: str,
) -> bool:
    """True when a single small LLM call (or stash replay) can replace the executor."""
    if context_only_short_circuit_disabled():
        return False
    if resolved.is_casual:
        return False
    if resolved.route in ("user_docs", "knowledge_base", "none"):
        return False
    if resolved.user_goal == "replay_deliverable":
        return prior_checkpoint_analysis_in_session(state)
    if resolved.user_goal != "answer_from_context":
        return False
    if should_answer_provider_from_context(user_query, state=state):
        return True
    if needs_fresh_checkpoint_retrieval(user_query, state=state):
        return False
    if not build_session_working_memory(state):
        return False
    return should_block_checkpoint_agent_for_context_turn(
        user_query=user_query,
        state=state,
        user_goal=resolved.user_goal,
        query_mode=str(resolved.query_mode or "interpret_session"),
    )


def _replay_deliverable_body(state: Mapping[str, Any] | None) -> Optional[str]:
    if not state:
        return None
    for key in ("checkpoint_analysis_dual_format", "checkpoint_result"):
        raw = state.get(key)
        if isinstance(raw, str) and raw.strip() and dual_format_has_valid_analysis_json(raw):
            return raw.strip()
    return None


def _call_context_only_llm(
    *,
    user_query: str,
    memory_block: str,
    recent_dialogue: str,
    provider_name: Optional[str] = None,
    provider_details: Optional[dict[str, Any]] = None,
) -> Optional[str]:
    client = GLOBAL_GEMINI_MODEL.api_client
    model = getattr(GLOBAL_GEMINI_MODEL, "model", None) or "gemini-3.1-flash-lite"
    payload: dict[str, Any] = {
        "user_query": user_query,
        "recent_dialogue": recent_dialogue or "(none)",
    }
    if provider_name:
        payload["provider_focus"] = provider_name
        if provider_details:
            payload["provider_details"] = provider_details
    user_blob = json.dumps(payload, indent=2)
    prompt = f"{_CONTEXT_ONLY_SYSTEM}\n\n{memory_block}\n\nINPUT_JSON:\n{user_blob}\n"
    t0 = time.monotonic()
    try:
        response = client.models.generate_content(
            model=model,
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.3,
                max_output_tokens=1024,
            ),
        )
    except Exception:
        logger.exception("context_only_turn: generate_content failed")
        return None
    text = (getattr(response, "text", None) or "").strip()
    if not text:
        logger.warning(
            "context_only_turn: empty response (elapsed_ms=%.0f)",
            (time.monotonic() - t0) * 1000,
        )
        return None
    logger.info(
        "context_only_turn: ok chars=%d elapsed_ms=%.0f",
        len(text),
        (time.monotonic() - t0) * 1000,
    )
    return text


def build_context_only_response(
    resolved: ResolvedTurn,
    *,
    state: Mapping[str, Any] | None,
    session_events: Sequence[Any] | None,
    user_query: str,
    current_invocation_id: Optional[str] = None,
) -> Optional[str]:
    """
    Build assistant text for a context-only turn, or None to fall back to the executor.
    """
    if resolved.user_goal == "replay_deliverable":
        return _replay_deliverable_body(state)

    provider_name: Optional[str] = None
    provider_details: Optional[dict[str, Any]] = None
    if should_answer_provider_from_context(user_query, state=state):
        provider_answer = format_provider_context_answer(user_query, state)
        if provider_answer:
            return provider_answer
        provider_name = query_references_known_provider(user_query, state)
        if provider_name and state is not None:
            provider_details = extract_service_provider_details(state).get(
                provider_name
            )
        logger.info(
            "context_only_turn: provider follow-up without canned answer; using LLM "
            "provider=%r",
            provider_name,
        )

    memory_block = format_session_working_memory_block(state)
    if not memory_block:
        return None

    from .resolve_turn_llm import _recent_dialogue

    dialogue = _recent_dialogue(
        session_events,
        current_invocation_id=current_invocation_id,
    )
    if provider_name:
        # Avoid echoing the prior unrelated assistant turn (e.g. bathroom Q&A).
        dialogue = "(provider follow-up — use SESSION_WORKING_MEMORY only)"
    return _call_context_only_llm(
        user_query=resolved.expanded_user_query or user_query,
        memory_block=memory_block,
        recent_dialogue=dialogue,
        provider_name=provider_name,
        provider_details=provider_details,
    )
