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
    elif isinstance(created_at, str):
        try:
            dt = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
        except ValueError:
            return None
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

    scored_sum = 0.0
    if scored_checkpoints:
        scored_sum = sum(s for _, s, _ in scored_checkpoints)
        headline_value = scored_sum / float(len(scored_checkpoints))
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
            "scored_sum": scored_sum,
            "last_applied_checkpoint_id": latest_checkpoint_id,
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


def should_use_full_aggregation(
    existing: Optional[Dict[str, Any]],
    checkpoint: Dict[str, Any],
) -> bool:
    """Fall back to a full checkpoint scan when incremental state may be stale."""
    if not existing:
        return False
    if existing.get("version") != METRICS_VERSION:
        return True
    window = existing.get("window") or {}
    if window.get("checkpoints_considered", 0) >= MAX_CHECKPOINTS:
        return True
    if window.get("last_applied_checkpoint_id") == checkpoint.get("id"):
        return True
    if window.get("checkpoints_considered", 0) > 0 and window.get("scored_sum") is None:
        return True
    return False


def _deterioration_from_trend(trend: List[Dict[str, Any]]) -> Dict[str, Any]:
    deterioration_rate = None
    deterioration_trend = "unknown"
    if len(trend) >= 2:
        prev = trend[-2]
        last = trend[-1]
        prev_score = _safe_float(prev.get("score"))
        last_score = _safe_float(last.get("score"))
        prev_dt = _checkpoint_datetime(prev.get("t"))
        last_dt = _checkpoint_datetime(last.get("t"))
        if (
            prev_score is not None
            and last_score is not None
            and prev_dt is not None
            and last_dt is not None
        ):
            days = (last_dt - prev_dt).total_seconds() / 86400.0
            if days > 0:
                deterioration_rate = (prev_score - last_score) / days
                if deterioration_rate > 0.05:
                    deterioration_trend = "deteriorating"
                elif deterioration_rate < -0.05:
                    deterioration_trend = "improving"
                else:
                    deterioration_trend = "stable"
    return {
        "rate_points_per_day": deterioration_rate,
        "trend": deterioration_trend,
    }


def apply_incremental_checkpoint_to_metrics(
    existing: Optional[Dict[str, Any]],
    checkpoint: Dict[str, Any],
    trend_points: int = TREND_POINTS,
) -> Dict[str, Any]:
    """
    Patch property metrics summary with one newly completed checkpoint.
    """
    if not existing:
        return compute_property_metrics_from_checkpoints([checkpoint], trend_points=trend_points)

    if (checkpoint.get("analysisStatus") != "completed") and not checkpoint.get("aiAnalysis"):
        return existing

    window = dict(existing.get("window") or {})
    if window.get("last_applied_checkpoint_id") == checkpoint.get("id"):
        return existing

    ai = checkpoint.get("aiAnalysis") or {}
    sev_counts = _extract_issues_by_severity(ai)
    overall = _extract_overall_condition(ai)
    created_dt = _checkpoint_datetime(checkpoint.get("createdAt"))

    issues_total = dict(existing.get("issues", {}).get("total_by_severity") or {})
    for sev in ("critical", "major", "moderate", "minor"):
        issues_total[sev] = int(issues_total.get(sev, 0) or 0) + int(sev_counts.get(sev, 0) or 0)

    issues_recent = list(existing.get("issues", {}).get("recent") or [])
    issues_recent = issues_recent + _issue_rows_from_checkpoint(checkpoint)
    issues_recent.sort(key=lambda r: r.get("createdAt", ""), reverse=True)
    issues_recent = issues_recent[:ISSUES_RECENT_MAX]

    overall_section = dict(existing.get("overall") or {})
    trend = list(overall_section.get("trend") or [])
    if overall is not None and created_dt is not None:
        trend.append(
            {
                "t": created_dt.isoformat(),
                "score": overall,
                "checkpointId": checkpoint.get("id", ""),
            }
        )
        trend.sort(key=lambda p: p.get("t", ""))
        trend = trend[-trend_points:]

    considered = int(window.get("checkpoints_considered", 0) or 0) + 1
    scored_count = int(window.get("checkpoints_with_score", 0) or 0)
    scored_sum = _safe_float(window.get("scored_sum")) or 0.0
    if overall is not None:
        scored_count += 1
        scored_sum += overall

    status = _compute_status(considered, scored_count)
    headline = None
    latest_checkpoint_score = None
    if scored_count > 0:
        headline_value = scored_sum / float(scored_count)
        latest_checkpoint_score = overall if overall is not None else None
        headline = {
            "value": headline_value,
            "source": "weighted_mean",
            "latest_checkpoint_id": checkpoint.get("id"),
            "latest_checkpoint_score": latest_checkpoint_score,
        }

    deterioration = _deterioration_from_trend(trend)

    return {
        "version": METRICS_VERSION,
        "updatedAt": firestore.SERVER_TIMESTAMP,
        "status": status,
        "window": {
            "max_checkpoints": MAX_CHECKPOINTS,
            "checkpoints_considered": considered,
            "checkpoints_with_score": scored_count,
            "trend_points": len(trend),
            "scored_sum": scored_sum,
            "last_applied_checkpoint_id": checkpoint.get("id"),
        },
        "overall": {
            "headline": headline,
            "trend": trend,
            "latest_score": latest_checkpoint_score,
        },
        "issues": {
            "total_by_severity": issues_total,
            "total": sum(int(v or 0) for v in issues_total.values()),
            "recent": issues_recent,
        },
        "deterioration": deterioration,
    }


def increment_property_metrics(
    db: firestore.Client,
    user_id: str,
    property_id: str,
    checkpoint: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Incrementally update metrics/summary from one checkpoint (1 read + 1 write).
    Falls back to aggregate_property_metrics when a full scan is required.
    """
    metrics_ref = (
        db.collection("users")
        .document(user_id)
        .collection("properties")
        .document(property_id)
        .collection("metrics")
        .document("summary")
    )
    existing_snap = metrics_ref.get()
    existing = existing_snap.to_dict() if existing_snap.exists else None

    if should_use_full_aggregation(existing, checkpoint):
        logger.info(
            "metrics.incremental.fallback user=%s property=%s checkpoint=%s",
            user_id,
            property_id,
            checkpoint.get("id"),
        )
        return aggregate_property_metrics(db=db, user_id=user_id, property_id=property_id)

    metrics = apply_incremental_checkpoint_to_metrics(existing, checkpoint)
    metrics_ref.set(metrics)
    return metrics


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
