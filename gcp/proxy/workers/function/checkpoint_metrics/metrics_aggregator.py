import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from firebase_admin import firestore

logger = logging.getLogger(__name__)

METRICS_VERSION = 2
MAX_CHECKPOINTS = 60
TREND_POINTS = 12
ISSUES_RECENT_MAX = 50


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
    issues_by_sev = ai_analysis.get("issues_by_severity")
    if isinstance(issues_by_sev, dict):
        out = {"critical": 0, "major": 0, "moderate": 0, "minor": 0}
        for k in out.keys():
            try:
                out[k] = int(issues_by_sev.get(k, 0) or 0)
            except Exception:
                out[k] = 0
        return out

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


def _checkpoint_datetime(created_at: Any) -> Optional[datetime]:
    if hasattr(created_at, "to_datetime"):
        dt = created_at.to_datetime()
    elif hasattr(created_at, "seconds"):
        dt = datetime.fromtimestamp(created_at.seconds, tz=timezone.utc)
    elif isinstance(created_at, datetime):
        dt = created_at if created_at.tzinfo else created_at.replace(tzinfo=timezone.utc)
    else:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def _issue_rows_from_checkpoint(c: Dict[str, Any]) -> List[Dict[str, Any]]:
    ai = c.get("aiAnalysis") or {}
    issues = ai.get("issues") or []
    if not issues:
        return []
    created_at = _checkpoint_datetime(c.get("createdAt"))
    created_iso = created_at.isoformat() if created_at else datetime.now(timezone.utc).isoformat()
    name = c.get("name") or "Untitled Checkpoint"
    rows: List[Dict[str, Any]] = []
    for issue in issues:
        if isinstance(issue, str):
            rows.append(
                {
                    "severity": "minor",
                    "description": issue,
                    "checkpointId": c.get("id", ""),
                    "checkpointName": name,
                    "createdAt": created_iso,
                }
            )
        elif isinstance(issue, dict):
            sev = (issue.get("severity") or "minor").lower()
            if sev not in ("critical", "major", "moderate", "minor"):
                sev = "minor"
            desc = str(
                issue.get("description") or issue.get("text") or issue.get("title") or "Issue detected"
            )
            rows.append(
                {
                    "severity": sev,
                    "description": desc,
                    "checkpointId": c.get("id", ""),
                    "checkpointName": name,
                    "createdAt": created_iso,
                }
            )
    return rows


def _compute_status(considered: int, with_score: int) -> str:
    if considered == 0:
        return "no_checkpoints"
    if with_score == 0:
        return "pending_analysis"
    if with_score < considered:
        return "partial"
    return "ready"


def compute_property_metrics_from_checkpoints(
    checkpoint_docs: List[Dict[str, Any]],
    trend_points: int = TREND_POINTS,
) -> Dict[str, Any]:
    """
    Compute v2 property metrics summary from checkpoint documents.
    """
    def _sort_key(c: Dict[str, Any]) -> Tuple[int, str]:
        created_at = c.get("createdAt")
        if hasattr(created_at, "seconds"):
            return (int(created_at.seconds), c.get("id", ""))
        return (0, c.get("id", ""))

    ordered = sorted(checkpoint_docs, key=_sort_key)
    completed = [c for c in ordered if (c.get("analysisStatus") == "completed" or c.get("aiAnalysis"))]

    issues_total = {"critical": 0, "major": 0, "moderate": 0, "minor": 0}
    scored_checkpoints: List[Tuple[Dict[str, Any], float, datetime]] = []

    for c in completed:
        ai = c.get("aiAnalysis") or {}
        sev_counts = _extract_issues_by_severity(ai)
        for k, v in sev_counts.items():
            issues_total[k] += int(v or 0)

        overall = _extract_overall_condition(ai)
        dt = _checkpoint_datetime(c.get("createdAt"))
        if overall is not None and dt is not None:
            scored_checkpoints.append((c, overall, dt))

    checkpoints_with_score = len(scored_checkpoints)
    checkpoints_considered = len(completed)
    status = _compute_status(checkpoints_considered, checkpoints_with_score)

    overall_trend: List[Dict[str, Any]] = []
    for c, score, dt in scored_checkpoints:
        overall_trend.append(
            {
                "t": dt.isoformat(),
                "score": score,
                "checkpointId": c.get("id", ""),
            }
        )
    overall_trend = overall_trend[-trend_points:]

    headline_value: Optional[float] = None
    headline_source: Optional[str] = None
    latest_checkpoint_id: Optional[str] = None
    latest_checkpoint_score: Optional[float] = None

    if scored_checkpoints:
        headline_value = sum(s for _, s, _ in scored_checkpoints) / float(len(scored_checkpoints))
        headline_source = "weighted_mean"
        last_c, last_score, _ = scored_checkpoints[-1]
        latest_checkpoint_id = last_c.get("id")
        latest_checkpoint_score = last_score

    deterioration_rate = None
    deterioration_trend = "unknown"
    if len(scored_checkpoints) >= 2:
        prev_c, prev_score, prev_dt = scored_checkpoints[-2]
        last_c, last_score, last_dt = scored_checkpoints[-1]
        days = (last_dt - prev_dt).total_seconds() / 86400.0
        if days > 0:
            deterioration_rate = (prev_score - last_score) / days
            if deterioration_rate > 0.05:
                deterioration_trend = "deteriorating"
            elif deterioration_rate < -0.05:
                deterioration_trend = "improving"
            else:
                deterioration_trend = "stable"

    issues_recent: List[Dict[str, Any]] = []
    for c in reversed(completed):
        issues_recent.extend(_issue_rows_from_checkpoint(c))
    issues_recent.sort(key=lambda r: r.get("createdAt", ""), reverse=True)
    issues_recent = issues_recent[:ISSUES_RECENT_MAX]

    headline = None
    if headline_value is not None:
        headline = {
            "value": headline_value,
            "source": headline_source,
            "latest_checkpoint_id": latest_checkpoint_id,
            "latest_checkpoint_score": latest_checkpoint_score,
        }

    return {
        "version": METRICS_VERSION,
        "updatedAt": firestore.SERVER_TIMESTAMP,
        "status": status,
        "window": {
            "max_checkpoints": MAX_CHECKPOINTS,
            "checkpoints_considered": checkpoints_considered,
            "checkpoints_with_score": checkpoints_with_score,
            "trend_points": len(overall_trend),
        },
        "overall": {
            "headline": headline,
            "trend": overall_trend,
            # v1 compat for one release
            "latest_score": latest_checkpoint_score,
        },
        "issues": {
            "total_by_severity": issues_total,
            "total": sum(issues_total.values()),
            "recent": issues_recent,
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
    limit_checkpoints: int = MAX_CHECKPOINTS,
) -> Dict[str, Any]:
    """
    Reads recent checkpoints for a property, computes metrics, and writes a summary doc.
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
    metrics_ref.set(metrics)
    return metrics
