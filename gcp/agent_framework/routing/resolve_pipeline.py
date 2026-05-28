"""Generic resolve-turn orchestration for ADK ``before_model`` callbacks."""

from __future__ import annotations

import logging
from typing import Any, Optional, Protocol

from agent_framework.routing.resolved_turn import (
    RESOLVE_APPLIED_INVOCATION_KEY,
    inject_resolved_turn_into_llm_request,
    invocation_id,
    session_events,
)
from agent_framework.runtime.llm_short_circuit import plain_text_llm_response

logger = logging.getLogger(__name__)


class ResolveTurnHooks(Protocol):
    """Vertical-specific resolve + inject hooks."""

    def prepare_state(self, ctx: Any) -> None:
        """Optional: set property_id etc. before resolve."""

    def early_short_circuit(self, ctx: Any) -> Any | None:
        """Return LlmResponse to skip resolve, or None to continue."""

    def resolved_turn_from_state(self, state: Any) -> Any | None:
        """Parse resolved turn from session state."""

    def is_casual(self, resolved: Any) -> bool:
        """Whether this turn should not run the executor LLM."""

    def before_resolve(self, ctx: Any) -> None:
        """Called once per invocation before resolve_turn."""

    def resolve_turn(self, ctx: Any, *, llm_request: Any = None) -> Any:
        """Run vertical resolve (LLM or rules)."""

    def apply_to_state(self, state: Any, resolved: Any) -> None:
        """Persist resolve output to session state."""

    def build_casual_reply(self, resolved: Any, ctx: Any) -> str:
        """Canned text for casual intents."""

    def format_inject_block(
        self, resolved: Any, *, state: Any | None = None
    ) -> str:
        """Full [RESOLVED_TURN] block for executor inject."""

    def log_substantive_resolve(self, resolved: Any, ctx: Any) -> None:
        """Optional info log after substantive resolve."""


def run_resolve_before_model(
    ctx: Any,
    *,
    llm_request: Any = None,
    hooks: ResolveTurnHooks,
) -> Optional[Any]:
    """
    Per-invocation dedupe, re-inject, casual short-circuit, or inject for executor.

    Returns LlmResponse to short-circuit the executor, or None to run the executor LLM.
    """
    state = getattr(ctx, "state", None)
    events = session_events(ctx)
    _ = events
    inv_id = invocation_id(ctx)

    hooks.prepare_state(ctx)

    short = hooks.early_short_circuit(ctx)
    if short is not None:
        return short

    if inv_id and state is not None and state.get(RESOLVE_APPLIED_INVOCATION_KEY) == inv_id:
        existing = hooks.resolved_turn_from_state(state)
        if existing is not None and not hooks.is_casual(existing):
            if llm_request is not None:
                block = hooks.format_inject_block(existing, state=state)
                inject_resolved_turn_into_llm_request(
                    llm_request, existing, block=block
                )
            logger.debug(
                "resolve_pipeline skip re-resolve invocation_id=%s",
                inv_id,
            )
            return None

    hooks.before_resolve(ctx)
    resolved = hooks.resolve_turn(ctx, llm_request=llm_request)
    hooks.apply_to_state(state, resolved)
    if inv_id and state is not None:
        state[RESOLVE_APPLIED_INVOCATION_KEY] = inv_id

    if hooks.is_casual(resolved):
        text = hooks.build_casual_reply(resolved, ctx)
        return plain_text_llm_response(text)

    if llm_request is not None:
        block = hooks.format_inject_block(resolved, state=state)
        inject_resolved_turn_into_llm_request(llm_request, resolved, block=block)
    hooks.log_substantive_resolve(resolved, ctx)
    return None
