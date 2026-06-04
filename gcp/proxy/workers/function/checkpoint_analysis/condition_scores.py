"""
Normalize checkpoint condition_scores for Firestore and property metrics.
"""

from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional, Tuple

ScoreStatus = Literal["ok", "derived", "unavailable"]

# When Gemini omits numeric scores, derive overall from issue severities (v2 spec §4.7).
_SEVERITY_OVERALL: Dict[str, float] = {
    "critical": 40.0,
    "major": 55.0,
    "moderate": 70.0,
    "minor": 85.0,
}
_NO_ISSUES_OVERALL = 90.0


def _safe_float(v: Any) -> Optional[float]:
    try:
        if v is None:
            return None
        return float(v)
    except (TypeError, ValueError):
        return None


def _mean_component_scores(condition_scores: Dict[str, Any]) -> Optional[float]:
    vals: List[float] = []
    for key, raw in condition_scores.items():
        if key == "overall":
            continue
        fv = _safe_float(raw)
        if fv is not None:
            vals.append(fv)
    if not vals:
        return None
    return sum(vals) / float(len(vals))


def _overall_from_issues(issues: List[Any]) -> float:
    worst: Optional[str] = None
    rank = {"critical": 0, "major": 1, "moderate": 2, "minor": 3}
    for issue in issues:
        if isinstance(issue, dict):
            sev = (issue.get("severity") or "minor").lower()
        else:
            sev = "minor"
        if sev not in rank:
            sev = "minor"
        if worst is None or rank[sev] < rank[worst]:
            worst = sev
    if worst is None:
        return _NO_ISSUES_OVERALL
    return _SEVERITY_OVERALL.get(worst, _NO_ISSUES_OVERALL)


def normalize_condition_scores(
    condition_scores: Optional[Dict[str, Any]],
    issues: Optional[List[Any]] = None,
) -> Tuple[Dict[str, Any], ScoreStatus]:
    """
    Ensure condition_scores.overall is set when possible.

    Returns (condition_scores dict for Firestore, score_status).
    """
    scores: Dict[str, Any] = dict(condition_scores or {})

    overall = _safe_float(scores.get("overall"))
    if overall is not None:
        scores["overall"] = overall
        return scores, "ok"

    derived = _mean_component_scores(scores)
    if derived is not None:
        scores["overall"] = derived
        return scores, "derived"

    if issues:
        scores["overall"] = _overall_from_issues(issues)
        return scores, "derived"

    scores["overall"] = None
    return scores, "unavailable"
