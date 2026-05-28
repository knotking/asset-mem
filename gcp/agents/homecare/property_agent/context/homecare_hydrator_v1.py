"""Homecare binding for ``ContextHydratorV1`` (session working memory)."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any, Mapping

from agent_framework.context.prompt.session_memory import (
    _DEFAULT_SESSION_MEMORY_MAX_CHARS,
)
from agent_framework.contracts.v1 import (
    ContextBudgets,
    HydratedContext,
    RetrievedSnippet,
)

from property_agent.routing.query_mode import (
    SESSION_WORKING_MEMORY_SNAPSHOT_KEY,
    format_session_working_memory_block,
)

logger = logging.getLogger(__name__)

SESSION_MEMORY_SOURCE = "session_working_memory"

DEFAULT_HOMECARE_CONTEXT_BUDGETS = ContextBudgets(
    system_and_rules_budget=0,
    recent_turns_budget=0,
    retrieved_memory_budget=_DEFAULT_SESSION_MEMORY_MAX_CHARS,
    tool_output_budget=0,
)


def _retrieved_memory_max_chars(budgets: ContextBudgets) -> int:
    cap = budgets.retrieved_memory_budget
    if cap > 0:
        return cap
    return _DEFAULT_SESSION_MEMORY_MAX_CHARS


def hydrate_session_context_sync(
    *,
    query: str,
    state: Mapping[str, Any] | None,
    recent_turns: list[str] | None = None,
    budgets: ContextBudgets | None = None,
    top_k: int = 5,
) -> HydratedContext:
    """
    Build ``HydratedContext`` from ADK session state (thin wrapper).

    ``query`` is reserved for future retrieval; session memory does not use it today.
    """
    _ = query
    budgets = budgets or DEFAULT_HOMECARE_CONTEXT_BUDGETS
    turns = list(recent_turns or [])
    max_chars = _retrieved_memory_max_chars(budgets)
    if not state:
        logger.info(
            "orchestrator_v2_context_hydrator path=ContextHydratorV1 "
            "injected=false reason=no_state query_len=%s",
            len((query or "").strip()),
        )
        return HydratedContext(recent_turns=turns, retrieved=[], compacted_summary=None)

    has_snapshot = bool(state.get(SESSION_WORKING_MEMORY_SNAPSHOT_KEY))
    block = format_session_working_memory_block(state, max_chars=max_chars)
    retrieved: list[RetrievedSnippet] = []
    if block and top_k > 0:
        retrieved.append(
            RetrievedSnippet(text=block, source=SESSION_MEMORY_SOURCE),
        )
        retrieved = retrieved[:top_k]

    if retrieved:
        logger.info(
            "orchestrator_v2_context_hydrator path=ContextHydratorV1 "
            "injected=true retrieved=%s block_chars=%s max_chars=%s "
            "has_snapshot=%s recent_turns=%s query_len=%s",
            len(retrieved),
            len(block),
            max_chars,
            has_snapshot,
            len(turns),
            len((query or "").strip()),
        )
    else:
        logger.info(
            "orchestrator_v2_context_hydrator path=ContextHydratorV1 "
            "injected=false reason=empty_memory has_snapshot=%s top_k=%s query_len=%s",
            has_snapshot,
            top_k,
            len((query or "").strip()),
        )

    return HydratedContext(
        recent_turns=turns,
        retrieved=retrieved,
        compacted_summary=None,
    )


@dataclass(frozen=True)
class HomecareContextHydratorV1:
    """Per-turn hydrator with session state bound at construction."""

    state: Mapping[str, Any] | None

    async def hydrate(
        self,
        *,
        query: str,
        recent_turns: list[str],
        budgets: ContextBudgets,
        top_k: int = 5,
    ) -> HydratedContext:
        return hydrate_session_context_sync(
            query=query,
            state=self.state,
            recent_turns=recent_turns,
            budgets=budgets,
            top_k=top_k,
        )
