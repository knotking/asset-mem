"""
Deterministic executor trajectory planner (stub policy for CI).

Maps ``ResolvedTurn`` + session state to expected tool calls without calling
the executor LLM. Mirrors product rules in ``prompts.py`` and
``checkpoint/retrieval/inventory_query.py``.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Mapping

from property_agent.checkpoint.constants import (
    CHECKPOINT_ANALYSIS_TOOL,
    CHECKPOINT_LIST_TOOL,
)
from property_agent.checkpoint.retrieval.inventory_query import (
    query_requests_checkpoint_inventory,
)
from property_agent.routing.resolve_turn import is_executor_conversational_turn
from property_agent.routing.schema import ResolvedTurn

_USER_DOCS_TOOL = "user_docs_retrieval"
_REPORT_TOOL = "report_retrieval"

_VALID_TOOLS = frozenset(
    {
        CHECKPOINT_LIST_TOOL,
        CHECKPOINT_ANALYSIS_TOOL,
        _USER_DOCS_TOOL,
        _REPORT_TOOL,
    }
)


@dataclass(frozen=True)
class TrajectoryPrediction:
    tools_called: tuple[str, ...]
    branches: tuple[str, ...]
    retrieval_only: bool

    def to_dict(self) -> dict[str, Any]:
        return {
            "tools_called": list(self.tools_called),
            "branches": list(self.branches),
            "retrieval_only": self.retrieval_only,
        }


def _coerce_resolved(resolved: Any) -> ResolvedTurn:
    if isinstance(resolved, ResolvedTurn):
        return resolved
    if isinstance(resolved, Mapping):
        return ResolvedTurn.from_dict(dict(resolved))
    raise TypeError(f"expected ResolvedTurn or mapping, got {type(resolved)!r}")


def predict_trajectory(
    resolved: ResolvedTurn | Mapping[str, Any],
    state: Mapping[str, Any],
    *,
    user_query: str,
) -> TrajectoryPrediction:
    """Return the tool trajectory the executor should take for this turn."""
    turn = _coerce_resolved(resolved)
    retrieval_only = bool(turn.retrieval_only)

    if is_executor_conversational_turn(turn, state=state):
        return TrajectoryPrediction((), (), retrieval_only=retrieval_only)

    route = turn.route
    if route == "user_docs":
        return TrajectoryPrediction((_USER_DOCS_TOOL,), (), retrieval_only=retrieval_only)
    if route == "report":
        return TrajectoryPrediction((_REPORT_TOOL,), (), retrieval_only=retrieval_only)
    if route != "checkpoint":
        return TrajectoryPrediction((), (), retrieval_only=retrieval_only)

    branches = tuple(sorted(set(turn.run_optional_agents or [])))
    query = (user_query or "").strip()

    if query_requests_checkpoint_inventory(query):
        return TrajectoryPrediction((CHECKPOINT_LIST_TOOL,), (), retrieval_only=retrieval_only)

    if branches and not retrieval_only:
        return TrajectoryPrediction(
            (CHECKPOINT_ANALYSIS_TOOL,),
            branches,
            retrieval_only=False,
        )

    if retrieval_only:
        return TrajectoryPrediction((), (), retrieval_only=True)

    if turn.user_goal == "new_analysis":
        return TrajectoryPrediction((CHECKPOINT_ANALYSIS_TOOL,), (), retrieval_only=False)

    return TrajectoryPrediction((), (), retrieval_only=retrieval_only)


def infer_content_json_flags(
    prediction: TrajectoryPrediction,
) -> dict[str, bool]:
    """Heuristic V2 message flags from a predicted trajectory."""
    has_analysis_tool = CHECKPOINT_ANALYSIS_TOOL in prediction.tools_called
    has_branches = bool(prediction.branches)
    present = has_analysis_tool and (has_branches or not prediction.retrieval_only)
    return {
        "content_json_present": present,
        "content_json_absent": not present,
    }


def validate_tool_names(tools: list[str]) -> list[str]:
    errors: list[str] = []
    for name in tools:
        if name not in _VALID_TOOLS:
            errors.append(f"unknown tool {name!r}")
    return errors
