"""G4 ADK session diet — keep session events/state small; structured data in Firestore."""

from __future__ import annotations

from typing import Any, Mapping

from property_agent.checkpoint.constants import CHECKPOINT_ANALYSIS_STATE_KEY

SESSION_NON_PERSISTENT_STATE_KEYS = frozenset(
    {
        "contentMarkdown",
        "contentJson",
        "analysisRunId",
        "checkpoint_branch_completed",
    }
)

HEAVY_STRING_STATE_KEYS = frozenset(
    {
        "checkpoint_result",
        CHECKPOINT_ANALYSIS_STATE_KEY,
    }
)

HEAVY_STATE_KEYS_TO_PRUNE_AFTER_TURN = frozenset(
    {
        *HEAVY_STRING_STATE_KEYS,
        "checkpoint_parallel_results",
        "checkpoint_analysis_markdown",
        "_checkpoint_pipeline_requested",
        "_checkpoint_pipeline_completed",
        "_checkpoint_pipeline_pending",
        "checkpoint_progress_emit_seq",
        "checkpoint_progress_last_emitted_seq",
    }
)

_G4_DEFAULT_TOKEN_THRESHOLD = 24_000
_G4_DEFAULT_EVENT_RETENTION_SIZE = 24


def g4_compaction_token_threshold(default: int) -> int:
    _ = default
    return _G4_DEFAULT_TOKEN_THRESHOLD


def g4_compaction_event_retention_size(default: int) -> int:
    _ = default
    return _G4_DEFAULT_EVENT_RETENTION_SIZE


def slim_analysis_for_session(analysis: Mapping[str, Any] | None) -> str:
    """Short placeholder for ADK session history during progressive analysis."""
    if not isinstance(analysis, dict):
        return "# Checkpoint analysis\n\n_Structured analysis in Firestore._\n"
    inner = analysis.get("analysis")
    if not isinstance(inner, dict):
        inner = analysis
    title = (inner.get("title") or "Checkpoint analysis").strip()
    status = inner.get("analysisStatus")
    if isinstance(status, dict):
        requested = list(status.keys())
        completed = [b for b, s in status.items() if str(s).lower() == "completed"]
        pending = [b for b, s in status.items() if str(s).lower() in ("pending", "running")]
        if requested:
            from property_agent.checkpoint.analysis.assembler import (
                minimal_checkpoint_progress_session_text,
            )

            return minimal_checkpoint_progress_session_text(
                completed_branches=completed,
                pending_branches=pending,
                requested_branches=requested,
            )
    return f"# {title}\n\n_Structured analysis in Firestore._\n"


def filter_state_delta_for_session_storage(delta: Mapping[str, Any] | None) -> dict[str, Any]:
    if not delta:
        return {}

    out: dict[str, Any] = {}
    for key, value in delta.items():
        if key in SESSION_NON_PERSISTENT_STATE_KEYS:
            continue
        if key == CHECKPOINT_ANALYSIS_STATE_KEY and isinstance(value, dict):
            out[key] = value
            continue
        if key == "checkpoint_parallel_results" and isinstance(value, str):
            continue
        out[key] = value
    return out


def prune_heavy_checkpoint_state(state: Any) -> None:
    if state is None or not hasattr(state, "pop"):
        return
    for key in HEAVY_STATE_KEYS_TO_PRUNE_AFTER_TURN:
        state.pop(key, None)
