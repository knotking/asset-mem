import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from firebase_admin import firestore

logger = logging.getLogger(__name__)


def _safe_float(v: Any) -> Optional[float]:
    try:
        if v is None:
            return None
        return float(v)
    except Exception:
        return None


def _extract_overall_condition(ai_analysis: Dict[str, Any]) -> Optional[float]:
    if not ai_analysis:
        return None
    condition_scores = ai_analysis.get("condition_scores") or {}
    overall = _safe_float(condition_scores.get("overall"))
    if overall is not None:
        return overall

    # Fallback: some analyses may not provide an explicit "overall".
    # Derive it as the mean of numeric component scores when available.
    vals: List[float] = []
    if isinstance(condition_scores, dict):
        for k, v in condition_scores.items():
            if k == "overall":
                continue
            fv = _safe_float(v)
            if fv is not None:
                vals.append(fv)
    if vals:
        return sum(vals) / float(len(vals))
    return None


def _extract_issues_by_severity(ai_analysis: Dict[str, Any]) -> Dict[str, int]:
    # Prefer worker-computed `issues_by_severity`
    issues_by_sev = ai_analysis.get("issues_by_severity")
    if isinstance(issues_by_sev, dict):
        out = {"critical": 0, "major": 0, "moderate": 0, "minor": 0}
        for k in out.keys():
            try:
                out[k] = int(issues_by_sev.get(k, 0) or 0)
            except Exception:
                out[k] = 0
        return out

    # Fallback: infer from `issues` list
    issues = ai_analysis.get("issues") or []
    out = {"critical": 0, "major": 0, "moderate": 0, "minor": 0}
    for issue in issues:
        if isinstance(issue, dict):
            sev = (issue.get("severity") or "minor").lower()
            if sev not in out:
                sev = "minor"
            out[sev] += 1
        else:
            out["minor"] += 1
    return out


def compute_property_metrics_from_checkpoints(
    checkpoint_docs: List[Dict[str, Any]],
    trend_points: int = 12,
) -> Dict[str, Any]:
    """
    Compute a compact metrics summary suitable for mobile consumption.
    Expects checkpoint_docs as a list of checkpoint dicts (including `createdAt` and `aiAnalysis`).
    """
    # Sort ascending by createdAt where possible (for trends)
    def _sort_key(c: Dict[str, Any]) -> Tuple[int, str]:
        created_at = c.get("createdAt")
        if hasattr(created_at, "seconds"):
            return (int(created_at.seconds), c.get("id", ""))
        return (0, c.get("id", ""))

    ordered = sorted(checkpoint_docs, key=_sort_key)
    completed = [c for c in ordered if (c.get("analysisStatus") == "completed" or c.get("aiAnalysis"))]

    issues_total = {"critical": 0, "major": 0, "moderate": 0, "minor": 0}
    overall_trend: List[Dict[str, Any]] = []

    last_overall: Optional[float] = None
    last_overall_time: Optional[datetime] = None
    prev_overall: Optional[float] = None
    prev_overall_time: Optional[datetime] = None

    for c in completed:
        ai = c.get("aiAnalysis") or {}
        sev_counts = _extract_issues_by_severity(ai)
        for k, v in sev_counts.items():
            issues_total[k] += int(v or 0)

        overall = _extract_overall_condition(ai)
        created_at = c.get("createdAt")
        dt: Optional[datetime] = None
        if hasattr(created_at, "to_datetime"):
            dt = created_at.to_datetime()
        elif hasattr(created_at, "seconds"):
            dt = datetime.fromtimestamp(created_at.seconds, tz=timezone.utc)
        elif isinstance(created_at, datetime):
            dt = created_at if created_at.tzinfo else created_at.replace(tzinfo=timezone.utc)

        if overall is not None and dt is not None:
            overall_trend.append(
                {
                    "t": dt.isoformat(),
                    "score": overall,
                }
            )
            # Track last two points for deterioration rate
            prev_overall, prev_overall_time = last_overall, last_overall_time
            last_overall, last_overall_time = overall, dt

    overall_trend = overall_trend[-trend_points:]

    deterioration_rate = None
    deterioration_trend = "unknown"
    if (
        prev_overall is not None
        and last_overall is not None
        and prev_overall_time is not None
        and last_overall_time is not None
    ):
        days = (last_overall_time - prev_overall_time).total_seconds() / 86400.0
        if days > 0:
            # Positive means deterioration (score decreased)
            deterioration_rate = (prev_overall - last_overall) / days
            if deterioration_rate > 0.05:
                deterioration_trend = "deteriorating"
            elif deterioration_rate < -0.05:
                deterioration_trend = "improving"
            else:
                deterioration_trend = "stable"

    return {
        "version": 1,
        "updatedAt": firestore.SERVER_TIMESTAMP,
        "window": {
            "checkpoints_considered": len(completed),
            "trend_points": len(overall_trend),
        },
        "overall": {
            "latest_score": last_overall,
            "trend": overall_trend,
        },
        "issues": {
            "total_by_severity": issues_total,
            "total": sum(issues_total.values()),
        },
        "deterioration": {
            "rate_points_per_day": deterioration_rate,
            "trend": deterioration_trend,
        },
    }


def aggregate_property_metrics(
    db: firestore.Client,
    user_id: str,
    property_id: str,
    limit_checkpoints: int = 60,
) -> Dict[str, Any]:
    """
    Reads recent checkpoints for a property, computes metrics, and writes a summary doc.
    Returns the metrics payload that was written.
    """
    checkpoints_ref = (
        db.collection("users")
        .document(user_id)
        .collection("properties")
        .document(property_id)
        .collection("checkpoints")
    )

    docs = (
        checkpoints_ref.order_by("createdAt", direction=firestore.Query.DESCENDING)
        .limit(limit_checkpoints)
        .stream()
    )
    checkpoint_dicts: List[Dict[str, Any]] = []
    for d in docs:
        data = d.to_dict() or {}
        data["id"] = d.id
        checkpoint_dicts.append(data)

    metrics = compute_property_metrics_from_checkpoints(checkpoint_dicts)

    metrics_ref = (
        db.collection("users")
        .document(user_id)
        .collection("properties")
        .document(property_id)
        .collection("metrics")
        .document("summary")
    )
    metrics_ref.set(metrics, merge=True)
    return metrics


