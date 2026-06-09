"""Load and scope property metrics for report PDF charts."""

from __future__ import annotations

from typing import Any, Optional


def load_property_metrics(
    db: Any,
    user_id: str,
    property_id: str,
) -> Optional[dict[str, Any]]:
    snap = (
        db.collection("users")
        .document(user_id)
        .collection("properties")
        .document(property_id)
        .collection("metrics")
        .document("summary")
        .get()
    )
    if not snap.exists:
        return None
    return snap.to_dict() or None


def _count_issues_from_checkpoint(analysis: dict[str, Any]) -> dict[str, int]:
    counts = {"critical": 0, "major": 0, "moderate": 0, "minor": 0}
    by_sev = analysis.get("issues_by_severity") or {}
    if by_sev:
        for key in counts:
            counts[key] = int(by_sev.get(key) or 0)
        return counts
    for issue in analysis.get("issues") or []:
        if isinstance(issue, dict):
            sev = str(issue.get("severity") or "minor").lower()
        else:
            sev = "minor"
        if sev not in counts:
            sev = "minor"
        counts[sev] += 1
    return counts


def rollup_metrics_from_checkpoints(
    checkpoints: list[dict[str, Any]],
    property_metrics: Optional[dict[str, Any]] = None,
) -> dict[str, Any]:
    """Build a metrics block scoped to the checkpoints included in this report."""
    severity = {"critical": 0, "major": 0, "moderate": 0, "minor": 0}
    for cp in checkpoints:
        analysis = cp.get("aiAnalysis") or {}
        row = _count_issues_from_checkpoint(analysis)
        for key in severity:
            severity[key] += row[key]
    total_issues = sum(severity.values())

    headline_value: Optional[float] = None
    headline_source: Optional[str] = None
    deterioration_trend: Optional[str] = None
    checkpoint_ids = {
        str(cp.get("id") or cp.get("checkpointId") or "")
        for cp in checkpoints
        if cp.get("id") or cp.get("checkpointId")
    }
    trend_points: list[dict[str, Any]] = []
    if property_metrics:
        headline = (property_metrics.get("overall") or {}).get("headline") or {}
        raw_value = headline.get("value")
        if raw_value is not None:
            headline_value = float(raw_value)
            headline_source = headline.get("source")
        deterioration_trend = (property_metrics.get("deterioration") or {}).get("trend")
        raw_trend = (property_metrics.get("overall") or {}).get("trend") or []
        scoped = [
            point
            for point in raw_trend
            if str(point.get("checkpointId") or "") in checkpoint_ids
        ]
        source_trend = scoped if scoped else raw_trend
        for point in source_trend[-12:]:
            score = point.get("score")
            if score is None:
                continue
            label = str(point.get("t") or point.get("date") or "")[:10]
            trend_points.append(
                {
                    "label": label or "—",
                    "score": int(round(float(score))),
                }
            )

    return {
        "checkpointsIncluded": len(checkpoints),
        "issues": {
            "total": total_issues,
            "total_by_severity": severity,
        },
        "overall": {
            "headline": {
                "value": headline_value,
                "source": headline_source,
            },
            "trend": trend_points,
        },
        "deterioration": {
            "trend": deterioration_trend,
        },
    }
