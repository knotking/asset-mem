"""Single-loop routing.

Skips a separate routing LLM; the root executor chooses tools. Injects a slim
``[SESSION_CONTEXT]`` block instead of full ``[RESOLVED_TURN]`` + working-memory
hydration. Bare greetings short-circuit via cheap regex (fail-open to the executor).
"""

from __future__ import annotations

import logging
from typing import Any, Optional

from agent_platform.adk.llm_short_circuit import plain_text_llm_response
from agent_platform.core.routing.resolved_turn import inject_tagged_system_block
from agent_platform.core.routing.single_loop_harness import run_single_loop_before_model

from .single_loop_common import bare_casual_intent, minimal_substantive_resolved_turn
from .single_loop_hooks import (
    PROPERTY_SINGLE_LOOP_HOOKS,
    format_slim_session_context_block,
)
from .chip_action import resolve_turn_from_chip
from .pending_user_action import resolve_turn_from_pending_offer

logger = logging.getLogger(__name__)

__all__ = [
    "bare_casual_intent",
    "format_slim_session_context_block",
    "inject_slim_session_context_into_llm_request",
    "minimal_substantive_resolved_turn",
    "prepare_single_loop_before_model",
    "resolve_turn_from_chip",
    "resolve_turn_from_pending_offer",
]


def inject_slim_session_context_into_llm_request(
    llm_request: Any,
    *,
    block: str,
) -> None:
    inject_tagged_system_block(llm_request, block=block)


def prepare_single_loop_before_model(
    ctx: Any,
    *,
    llm_request: Any = None,
) -> Optional[Any]:
    """Single-loop pre-routing; inject slim context or short-circuit bare greetings."""
    outcome = run_single_loop_before_model(
        ctx,
        llm_request=llm_request,
        hooks=PROPERTY_SINGLE_LOOP_HOOKS,
    )
    if outcome.kind == "short_circuit" and outcome.short_circuit_text:
        return plain_text_llm_response(outcome.short_circuit_text)
    return None
