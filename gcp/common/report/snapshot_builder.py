"""Build frozen contentSnapshot and chatMarkdown for snapshot reports."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional


def _iso_timestamp(value: Any) -> Optional[str]:
    if value is None:
        return None
    if hasattr(value, "to_datetime"):
        dt = value.to_datetime()
    elif hasattr(value, "seconds"):
        dt = datetime.fromtimestamp(value.seconds, tz=timezone.utc)
    elif isinstance(value, datetime):
        dt = value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    elif isinstance(value, str):
        try:
            dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return None
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
    else:
        return None
    return dt.astimezone(timezone.utc).isoformat()


def _media_slice(media_list: list[Any]) -> list[dict[str, str]]:
    out: list[dict[str, str]] = []
    for item in media_list or []:
        if not isinstance(item, dict):
            continue
        url = item.get("url") or item.get("downloadURL")
        if not url:
            continue
        entry: dict[str, str] = {"url": str(url)}
        thumb = item.get("thumbnailUrl")
        if thumb:
            entry["thumbnailUrl"] = str(thumb)
        out.append(entry)
    return out


def build_snapshot_report_content(
    *,
    property_doc: dict[str, Any],
    property_id: str,
    checkpoints: list[dict[str, Any]],
    purpose: str,
    snapshot_range: Optional[dict[str, str]],
) -> tuple[dict[str, Any], str]:
    slices = []
    for cp in checkpoints:
        slices.append(
            {
                "checkpointId": cp.get("id"),
                "name": cp.get("name") or "Checkpoint",
                "location": cp.get("location"),
                "capturedAt": _iso_timestamp(cp.get("capturedAt") or cp.get("createdAt")),
                "media": _media_slice(cp.get("media") or []),
                "aiAnalysis": cp.get("aiAnalysis"),
                "visualDiff": cp.get("visualDiff"),
            }
        )

    date_config: dict[str, Any] = {}
    if snapshot_range:
        date_config["snapshotRange"] = {
            "start": snapshot_range.get("start"),
            "end": snapshot_range.get("end"),
        }

    content_snapshot: dict[str, Any] = {
        "schemaVersion": 1,
        "property": {
            "id": property_id,
            "address": property_doc.get("address"),
            "name": property_doc.get("name"),
        },
        "mode": "snapshot",
        "generatedFor": purpose,
        "resolvedAt": datetime.now(timezone.utc).isoformat(),
        "dateConfig": date_config,
        "checkpoints": slices,
    }

    lines = [
        f"# {property_doc.get('name') or 'Property'} — Condition Snapshot",
        "",
    ]
    if property_doc.get("address"):
        lines.append(f"**Address:** {property_doc['address']}")
        lines.append("")
    if snapshot_range:
        lines.append(
            f"**Date range:** {snapshot_range.get('start')} — {snapshot_range.get('end')}"
        )
        lines.append("")

    for sl in slices:
        lines.append(f"## {sl.get('location') or sl.get('name')}")
        analysis = sl.get("aiAnalysis") or {}
        if analysis.get("summary"):
            lines.append(str(analysis["summary"]))
        issues = analysis.get("issues") or []
        if issues:
            lines.append("")
            lines.append("**Issues:**")
            for issue in issues[:10]:
                if isinstance(issue, dict):
                    desc = issue.get("description") or issue.get("text") or str(issue)
                    sev = issue.get("severity")
                    lines.append(f"- [{sev}] {desc}" if sev else f"- {desc}")
                else:
                    lines.append(f"- {issue}")
        lines.append("")

    chat_markdown = "\n".join(lines).strip()
    return content_snapshot, chat_markdown


def _checkpoint_slice(cp: dict[str, Any]) -> dict[str, Any]:
    return {
        "checkpointId": cp.get("id"),
        "name": cp.get("name") or "Checkpoint",
        "location": cp.get("location"),
        "capturedAt": _iso_timestamp(cp.get("capturedAt") or cp.get("createdAt")),
        "media": _media_slice(cp.get("media") or []),
        "aiAnalysis": cp.get("aiAnalysis"),
        "visualDiff": cp.get("visualDiff"),
    }


def build_comparison_report_content(
    *,
    property_doc: dict[str, Any],
    property_id: str,
    checkpoints_by_id: dict[str, dict[str, Any]],
    purpose: str,
    baseline_range: Optional[dict[str, str]],
    comparison_range: Optional[dict[str, str]],
    comparison_pairs: list[dict[str, str]],
    baseline_only_ids: Optional[list[str]] = None,
    comparison_only_ids: Optional[list[str]] = None,
) -> tuple[dict[str, Any], str]:
    pair_rows: list[dict[str, Any]] = []
    for pair in comparison_pairs:
        baseline = checkpoints_by_id.get(pair.get("baselineCheckpointId") or "")
        comparison = checkpoints_by_id.get(pair.get("comparisonCheckpointId") or "")
        visual_diff = (comparison or {}).get("visualDiff") or {}
        summary = visual_diff.get("summary")
        if not summary and pair.get("_geminiSummary"):
            summary = pair.get("_geminiSummary")
        if not summary:
            summary = (comparison or {}).get("aiAnalysis", {}).get("summary")
        pair_rows.append(
            {
                "location": pair.get("location"),
                "baselineCheckpointId": pair.get("baselineCheckpointId"),
                "comparisonCheckpointId": pair.get("comparisonCheckpointId"),
                "summary": summary,
                "similarityScore": visual_diff.get("similarityScore"),
                "narrativeSource": (
                    "visualDiff"
                    if visual_diff.get("summary")
                    else ("gemini" if pair.get("_geminiSummary") else None)
                ),
            }
        )

    slices = [
        _checkpoint_slice(cp)
        for cp in checkpoints_by_id.values()
    ]

    date_config: dict[str, Any] = {}
    if baseline_range:
        date_config["baselineRange"] = {
            "start": baseline_range.get("start"),
            "end": baseline_range.get("end"),
        }
    if comparison_range:
        date_config["comparisonRange"] = {
            "start": comparison_range.get("start"),
            "end": comparison_range.get("end"),
        }

    content_snapshot: dict[str, Any] = {
        "schemaVersion": 1,
        "property": {
            "id": property_id,
            "address": property_doc.get("address"),
            "name": property_doc.get("name"),
        },
        "mode": "comparison",
        "generatedFor": purpose,
        "resolvedAt": datetime.now(timezone.utc).isoformat(),
        "dateConfig": date_config,
        "comparisonPairs": pair_rows,
        "baselineOnlyCheckpointIds": baseline_only_ids or [],
        "comparisonOnlyCheckpointIds": comparison_only_ids or [],
        "checkpoints": slices,
    }

    lines = [
        f"# {property_doc.get('name') or 'Property'} — Condition Comparison",
        "",
    ]
    if property_doc.get("address"):
        lines.append(f"**Address:** {property_doc['address']}")
        lines.append("")
    if baseline_range and comparison_range:
        lines.append(
            f"**Baseline:** {baseline_range.get('start')} — {baseline_range.get('end')}"
        )
        lines.append(
            f"**Comparison:** {comparison_range.get('start')} — {comparison_range.get('end')}"
        )
        lines.append("")

    for row in pair_rows:
        lines.append(f"## {row.get('location') or 'Location'}")
        if row.get("summary"):
            lines.append(str(row["summary"]))
        lines.append("")

    chat_markdown = "\n".join(lines).strip()
    return content_snapshot, chat_markdown
