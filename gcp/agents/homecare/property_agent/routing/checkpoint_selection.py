"""Detect when UI checkpoint selection differs from the last analyzed set."""

from __future__ import annotations

from typing import Any

from property_agent.routing.schema import SessionStateLike

from property_agent.checkpoint.constants import CHECKPOINT_IDS_ANALYZED_STATE_KEY

from .conversational_intent import prior_checkpoint_analysis_in_session

_SESSION_SNAPSHOT_KEY = "session_working_memory_snapshot"


def normalized_checkpoint_id_set(ids: Any) -> frozenset[str]:
    if not isinstance(ids, list):
        return frozenset()
    return frozenset(str(x).strip() for x in ids if x is not None and str(x).strip())


def checkpoint_ids_from_state(state: SessionStateLike | None) -> frozenset[str]:
    if not state:
        return frozenset()
    return normalized_checkpoint_id_set(state.get("checkpoint_ids"))


def checkpoint_ids_last_analyzed(state: SessionStateLike | None) -> frozenset[str]:
    if not state:
        return frozenset()
    recorded = normalized_checkpoint_id_set(state.get(CHECKPOINT_IDS_ANALYZED_STATE_KEY))
    if recorded:
        return recorded
    snapshot = state.get(_SESSION_SNAPSHOT_KEY)
    if isinstance(snapshot, dict):
        recorded = normalized_checkpoint_id_set(
            snapshot.get(CHECKPOINT_IDS_ANALYZED_STATE_KEY)
        )
        if recorded:
            return recorded
    return frozenset()


def _checkpoints_analyzed_count(state: SessionStateLike | None) -> int | None:
    if state is None:
        return None
    structured = state.get("checkpoint_analysis")
    if isinstance(structured, dict):
        cs = structured.get("checkpointSummary")
        if not isinstance(cs, dict):
            inner = structured.get("analysis")
            if isinstance(inner, dict):
                cs = inner.get("checkpointSummary")
        if isinstance(cs, dict):
            analyzed = cs.get("checkpointsAnalyzed")
            if isinstance(analyzed, (int, float)) and analyzed > 0:
                return int(analyzed)
    snapshot = state.get(_SESSION_SNAPSHOT_KEY)
    if isinstance(snapshot, dict):
        summary = snapshot.get("checkpoint_summary")
        if isinstance(summary, dict):
            analyzed = summary.get("checkpointsAnalyzed")
            if isinstance(analyzed, (int, float)) and analyzed > 0:
                return int(analyzed)
    return None


def checkpoint_selection_changed(state: SessionStateLike | None) -> bool:
    """True when the client checkpoint_ids set differs from the last full analysis."""
    current = checkpoint_ids_from_state(state)
    if not current:
        return False
    prior = checkpoint_ids_last_analyzed(state)
    if prior:
        return current != prior
    if not prior_checkpoint_analysis_in_session(state):
        return False
    analyzed_n = _checkpoints_analyzed_count(state)
    if analyzed_n is not None:
        return len(current) != analyzed_n
    return True


def record_checkpoint_ids_analyzed(state: Any) -> None:
    """Persist the checkpoint id set used for the latest pipeline run."""
    if state is None or not hasattr(state, "__setitem__"):
        return
    current = checkpoint_ids_from_state(state)
    if not current:
        return
    state[CHECKPOINT_IDS_ANALYZED_STATE_KEY] = sorted(current)


def clear_stale_checkpoint_analysis_state(state: Any) -> bool:
    """Drop prior structured analysis when checkpoint selection changed."""
    if not checkpoint_selection_changed(state):
        return False
    if state is None or not hasattr(state, "__getitem__"):
        return False
    for key in (
        "checkpoint_analysis",
        "checkpoint_parallel_results",
        "checkpoint_analysis_markdown",
        "checkpoint_analysis_progress",
        "checkpoint_results",
        "checkpoint_result",
    ):
        if hasattr(state, "__delitem__"):
            try:
                del state[key]
            except KeyError:
                pass
        elif hasattr(state, "pop"):
            state.pop(key, None)
    return True
