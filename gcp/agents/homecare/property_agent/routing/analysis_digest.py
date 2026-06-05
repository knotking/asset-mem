"""Compact analysis digest for resolve ui_context and executor focus snippets."""

from __future__ import annotations

from typing import Any, Mapping, Optional

from .query_mode.session_memory import (
    SESSION_WORKING_MEMORY_SNAPSHOT_KEY,
    build_session_working_memory,
)


def build_analysis_digest_blob(state: Mapping[str, Any] | None) -> Optional[dict[str, Any]]:
    """Deterministic serialization of prior structured analysis for resolve NLU."""
    if not state:
        return None
    snapshot = state.get(SESSION_WORKING_MEMORY_SNAPSHOT_KEY)
    memory = snapshot if isinstance(snapshot, dict) else build_session_working_memory(state)
    if not memory:
        return None
    digest: dict[str, Any] = {}
    raw = memory.get("analysis_digest")
    if isinstance(raw, dict):
        digest.update(raw)
    branches = memory.get("branches_completed")
    if isinstance(branches, list) and branches:
        digest["branches_completed"] = list(branches)
    title = memory.get("analysis_title")
    if isinstance(title, str) and title.strip():
        digest["analysis_title"] = title.strip()
    summary = memory.get("checkpoint_summary")
    if isinstance(summary, dict) and summary:
        digest["checkpoint_summary"] = {
            k: summary.get(k)
            for k in ("overallCondition", "issuesDetected", "locations", "checkpointsAnalyzed")
            if summary.get(k) is not None
        }
    comparison = _comparison_notes_from_digest(digest)
    if comparison:
        digest["comparison_notes"] = comparison
    return digest or None


def _comparison_notes_from_digest(digest: Mapping[str, Any]) -> Optional[str]:
    cost = digest.get("cost_summary")
    if not isinstance(cost, dict):
        return None
    parts: list[str] = []
    for key in ("Service", "DIY", "Professional", "service", "diy"):
        value = cost.get(key)
        if isinstance(value, dict):
            rng = value.get("cost_range") or value.get("description")
            if rng:
                parts.append(f"{key}: {rng}")
        elif value is not None:
            parts.append(f"{key}: {value}")
    if not parts:
        return None
    return "; ".join(parts[:6])


def focus_snippet_for_branch(
    state: Mapping[str, Any] | None,
    focus_branch: Optional[str],
) -> Optional[str]:
    """Deterministic excerpt for executor inject on explain_prior turns."""
    if not focus_branch or not state:
        return None
    digest = build_analysis_digest_blob(state)
    if not digest:
        return None
    branch = focus_branch.strip().lower()
    if branch == "cost":
        cost = digest.get("cost_summary")
        if isinstance(cost, dict) and cost:
            return f"cost_summary: {cost}"
        notes = digest.get("comparison_notes")
        return f"comparison_notes: {notes}" if notes else None
    if branch == "diy":
        diy = digest.get("diy_steps_summary")
        if isinstance(diy, list) and diy:
            return f"diy_steps_summary: {diy[:8]}"
        return None
    if branch == "coverage":
        cov = digest.get("coverage_summary")
        if isinstance(cov, dict) and cov:
            return f"coverage_summary: {cov}"
        return None
    if branch == "service":
        svc = digest.get("serviceResults")
        if isinstance(svc, dict) and svc:
            return "serviceResults: (structured service branch present)"
        providers = digest.get("service_providers_mentioned")
        if isinstance(providers, list) and providers:
            return f"service_providers_mentioned: {providers[:8]}"
        return None
    if branch == "checkpoint":
        summary = digest.get("checkpoint_summary")
        if isinstance(summary, dict) and summary:
            return f"checkpoint_summary: {summary}"
        return None
    return None
