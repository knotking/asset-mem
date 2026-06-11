"""Deterministic checkpoint analysis assembly (no dual-format strings)."""

from __future__ import annotations

import json
import uuid
from typing import Any, Dict, List, Optional, Sequence

from property_agent.bindings.state_merge import merge_homecare_state_delta
from property_agent.checkpoint.constants import (
    CHECKPOINT_ANALYSIS_RUN_ID_STATE_KEY,
    CHECKPOINT_ANALYSIS_STATE_KEY,
    CHECKPOINT_SESSION_INPUT_KEYS,
    CHECKPOINT_SYNTHESIS_ANALYSIS_STATUS_KEY,
    OPTIONAL_BRANCH_TO_AGENT_NAME,
    _PARALLEL_KEY_TO_BRANCH,
    _VALID_OPTIONAL_BRANCHES,
)
from property_agent.checkpoint.analysis.markdown_render import (
    build_fallback_analysis,
    render_analysis_markdown,
    title_from_markdown_first_heading,
)


def normalize_checkpoint_optional_agents(value: Any) -> List[str]:
    """Return valid optional branch names from state / tool args."""
    if not isinstance(value, list):
        return []
    return [str(x) for x in value if str(x) in _VALID_OPTIONAL_BRANCHES]


def checkpoint_results_text_from_state(state: Any) -> Optional[str]:
    """Pluggable checkpoint retrieval blob (``checkpoint_results`` or ADK ``checkpoint_result``)."""
    if not hasattr(state, "get"):
        return None
    for key in ("checkpoint_results", "checkpoint_result"):
        raw = state.get(key)
        if isinstance(raw, str) and raw.strip():
            return raw.strip()
    return None


def sync_checkpoint_tool_args_to_state(state: Any, args: Dict[str, Any]) -> None:
    """Persist checkpoint tool args on session state for nested runners."""
    if not hasattr(state, "__setitem__") or not isinstance(args, dict):
        return
    for key in CHECKPOINT_SESSION_INPUT_KEYS:
        if key in args and args[key] is not None:
            state[key] = args[key]


def apply_tool_context_state_delta(tool_context: Any, delta: Dict[str, Any]) -> None:
    """Write session fields and merge into outgoing tool ``state_delta`` for parent sync."""
    if not delta or tool_context is None:
        return
    from property_agent.runtime.session_diet import filter_state_delta_for_session_storage

    session_delta = filter_state_delta_for_session_storage(delta)
    state = getattr(tool_context, "state", None)
    if state is not None and hasattr(state, "update") and session_delta:
        state.update(session_delta)
    actions = getattr(tool_context, "actions", None)
    if actions is None:
        return
    existing = getattr(actions, "state_delta", None)
    if isinstance(existing, dict):
        actions.state_delta = merge_homecare_state_delta(existing, delta)
    else:
        actions.state_delta = merge_homecare_state_delta(None, delta)


def checkpoint_synthesis_progress_session_text() -> str:
    """Session event copy while executive-summary synthesis LLM is running."""
    return "Writing your summary…"


def set_synthesis_analysis_status(
    analysis: Dict[str, Any],
    *,
    phase: str,
) -> Dict[str, Any]:
    """Attach ``analysisStatus.synthesis`` for progressive chat UI."""
    updated = json.loads(json.dumps(analysis, ensure_ascii=False))
    status = dict(updated.get("analysisStatus") or {})
    status[CHECKPOINT_SYNTHESIS_ANALYSIS_STATUS_KEY] = phase
    updated["analysisStatus"] = status
    return updated


def analysis_status_for_branches(
    requested: Sequence[str],
    *,
    completed: List[str],
    pending: List[str],
) -> Dict[str, str]:
    status: Dict[str, str] = {}
    done = set(completed)
    for branch in requested:
        if branch in done:
            status[branch] = "completed"
        elif pending and branch == pending[0]:
            status[branch] = "running"
        else:
            status[branch] = "pending"
    return status


def apply_inventory_meta_to_checkpoint_summary(
    analysis: Dict[str, Any],
    inventory_meta: Optional[Dict[str, Any]],
) -> None:
    """Attach inventory list scope to checkpointSummary for markdown disclosure."""
    if not inventory_meta:
        return
    cs = analysis.get("checkpointSummary")
    if not isinstance(cs, dict):
        cs = {}
        analysis["checkpointSummary"] = cs
    cs["inventoryList"] = {
        "totalCount": int(inventory_meta.get("total_count") or 0),
        "returnedCount": int(inventory_meta.get("returned_count") or 0),
        "truncated": bool(inventory_meta.get("truncated")),
        "scope": str(inventory_meta.get("scope") or "recent"),
    }


def prepend_inventory_disclosure_to_blob(
    blob: str,
    inventory_meta: Optional[Dict[str, Any]],
) -> str:
    from property_agent.checkpoint.retrieval.firestore_checkpoint_list import (
        format_checkpoint_inventory_disclosure,
    )

    note = format_checkpoint_inventory_disclosure(inventory_meta or {})
    if not note:
        return blob
    prefix = f"Inventory scope: {note}"
    body = (blob or "").strip()
    return f"{prefix}\n\n{body}" if body else prefix


def build_initial_analysis(
    *,
    checkpoint_results: str,
    user_query: str,
    requested_branches: Sequence[str],
    property_address: Optional[str] = None,
    retrieval_search_query: Optional[str] = None,
    inventory_meta: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Phase-0 analysis object before optional branches start."""
    empty_parallel = {
        "checkpoint_parallel_coverage_result": "SKIPPED",
        "checkpoint_parallel_diy_result": "SKIPPED",
        "checkpoint_parallel_service_result": "SKIPPED",
        "checkpoint_parallel_cost_result": "SKIPPED",
    }
    analysis = build_fallback_analysis(
        parallel_blob=empty_parallel,
        markdown_source="",
        checkpoint_results=checkpoint_results,
        property_address=property_address,
        retrieval_search_query=retrieval_search_query,
    )
    if not (analysis.get("title") or "").strip():
        analysis["title"] = (
            title_from_markdown_first_heading((user_query or "").strip())
            or "Checkpoint analysis"
        )
    if requested_branches:
        analysis["analysisStatus"] = analysis_status_for_branches(
            requested_branches,
            completed=[],
            pending=list(requested_branches),
        )
    apply_inventory_meta_to_checkpoint_summary(analysis, inventory_meta)
    return analysis


def merge_branch_result(
    analysis: Dict[str, Any],
    *,
    checkpoint_results: str,
    user_query: str,
    parallel_results: Dict[str, str],
    requested_branches: Sequence[str],
    completed_branches: List[str],
    pending_branches: List[str],
    in_progress: bool = True,
    property_address: Optional[str] = None,
    retrieval_search_query: Optional[str] = None,
    markdown_source: str = "",
) -> Dict[str, Any]:
    """Merge parallel branch payloads into a single analysis dict."""
    parallel_blob = {
        k: parallel_results.get(k, "SKIPPED")
        for k in _PARALLEL_KEY_TO_BRANCH.keys()
    }
    merged = build_fallback_analysis(
        parallel_blob=parallel_blob,
        markdown_source=markdown_source,
        checkpoint_results=checkpoint_results,
        property_address=property_address,
        retrieval_search_query=retrieval_search_query,
    )
    if not (merged.get("title") or "").strip():
        merged["title"] = analysis.get("title") or (
            title_from_markdown_first_heading((user_query or "").strip())
            or "Checkpoint analysis"
        )
    if in_progress and requested_branches:
        merged["analysisStatus"] = analysis_status_for_branches(
            requested_branches,
            completed=completed_branches,
            pending=pending_branches,
        )
    elif not in_progress and requested_branches:
        merged["analysisStatus"] = {
            b: "completed" for b in requested_branches
        }
    return merged


def render_markdown(analysis: Dict[str, Any]) -> str:
    """Render rich markdown from structured analysis (no JSON fences)."""
    return render_analysis_markdown(analysis)


def minimal_checkpoint_progress_session_text(
    *,
    completed_branches: List[str],
    pending_branches: List[str],
    requested_branches: Sequence[str],
) -> str:
    """Short placeholder for ADK session history during progressive analysis."""
    total = len(requested_branches) or 1
    done = len(completed_branches)
    title = "Checkpoint analysis"
    if not requested_branches:
        return f"# {title}\n\n_Preparing analysis…_\n"
    labels = ", ".join(requested_branches)
    if done >= total:
        return f"# {title}\n\n_Analysis complete ({done}/{total}: {labels})._\n"
    running = pending_branches[0] if pending_branches else ""
    if running:
        return (
            f"# {title}\n\n_Progress {done}/{total} — "
            f"completed: {', '.join(completed_branches) or 'none'}; "
            f"running: {running}._\n"
        )
    return f"# {title}\n\n_Progress {done}/{total} ({labels})._\n"


def format_checkpoints_for_analysis_blob(
    formatted_results: List[Dict[str, Any]],
) -> str:
    """Build checkpoint_results prose for optional analysis branches."""
    blocks: list[str] = []
    for fc in formatted_results or ():
        if not isinstance(fc, dict):
            continue
        lines: list[str] = []
        name = (fc.get("checkpointName") or "Checkpoint").strip()
        if name:
            lines.append(f"Checkpoint Name: {name}")
        loc = (fc.get("location") or "").strip()
        if loc:
            lines.append(f"Location/Asset: {loc}")
        text = (fc.get("text") or "").strip()
        if text:
            for line in text.splitlines():
                s = line.strip()
                if s and s not in lines:
                    lines.append(s)
        if lines:
            blocks.append("\n".join(lines))
    return "\n\n".join(blocks).strip()


def ensure_analysis_run_id(state: Any) -> str:
    """Return stable analysis run id for the current turn."""
    if hasattr(state, "get"):
        existing = state.get(CHECKPOINT_ANALYSIS_RUN_ID_STATE_KEY)
        if isinstance(existing, str) and existing.strip():
            return existing.strip()
    run_id = str(uuid.uuid4())
    if hasattr(state, "__setitem__"):
        state[CHECKPOINT_ANALYSIS_RUN_ID_STATE_KEY] = run_id
    return run_id


def stash_checkpoint_analysis_in_state(state: Any, analysis: Dict[str, Any]) -> None:
    """Persist structured analysis on session state."""
    if not hasattr(state, "__setitem__") or not isinstance(analysis, dict):
        return
    state[CHECKPOINT_ANALYSIS_STATE_KEY] = json.loads(
        json.dumps(analysis, ensure_ascii=False)
    )


def build_message_patch_from_analysis(
    analysis: Dict[str, Any],
    *,
    analysis_run_id: str,
    branch_completed: str = "",
) -> Dict[str, Any]:
    """Build V2 state_delta message patch keys for the proxy."""
    from property_agent.bindings.message_patch import build_state_delta_message_patch
    from property_agent.routing.suggested_actions import (
        merge_suggested_actions_into_content_json,
    )

    content_json = merge_suggested_actions_into_content_json(
        {"analysis": analysis},
        analysis,
    )
    return build_state_delta_message_patch(
        content_markdown=render_markdown(analysis),
        content_json=content_json,
        analysis_run_id=analysis_run_id,
        branch_completed=branch_completed,
    )


def agent_steps_from_analysis_status(analysis: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Map analysisStatus to completed agent step rows."""
    status = analysis.get("analysisStatus")
    if not isinstance(status, dict):
        return []
    updates: List[Dict[str, Any]] = []
    for branch, st in status.items():
        if st != "completed":
            continue
        agent_name = OPTIONAL_BRANCH_TO_AGENT_NAME.get(str(branch))
        if agent_name:
            updates.append({"name": agent_name, "status": "completed"})
    return updates


def bump_checkpoint_progress_emit_seq(state: Any) -> int:
    """Increment progress emit sequence."""
    from property_agent.checkpoint.constants import CHECKPOINT_PROGRESS_EMIT_SEQ_STATE_KEY

    if not hasattr(state, "get"):
        return 0
    current = state.get(CHECKPOINT_PROGRESS_EMIT_SEQ_STATE_KEY, 0)
    try:
        seq = int(current) + 1
    except (TypeError, ValueError):
        seq = 1
    state[CHECKPOINT_PROGRESS_EMIT_SEQ_STATE_KEY] = seq
    return seq
