"""
Render report HTML to PDF.

Phase 1 uses xhtml2pdf (Cloud Function compatible). Playwright on Cloud Run job
is the production target per PROPERTY_REPORTS_PLAN.md.

xhtml2pdf renders nested bordered <div>s poorly (each child becomes a separate
boxed fragment). Checkpoint sections use a single outer <table> per card.
"""

from __future__ import annotations

import io
import logging
import os
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from jinja2 import Environment, FileSystemLoader, select_autoescape

from common.report.template_presets import (
    purpose_theme,
    resolve_report_template,
)

logger = logging.getLogger(__name__)

TEMPLATES_DIR = Path(__file__).resolve().parent / "templates"

CLASSIC_PHOTO_WIDTH_PX = 200
CLASSIC_PHOTO_HEIGHT_PX = 150
PRO_PHOTO_WIDTH_PX = 240
PRO_PHOTO_HEIGHT_PX = 180

_jinja_env: Environment | None = None


def _get_jinja_env() -> Environment:
    global _jinja_env
    if _jinja_env is None:
        _jinja_env = Environment(
            loader=FileSystemLoader(str(TEMPLATES_DIR)),
            autoescape=select_autoescape(["html"]),
        )
    return _jinja_env


def _layout_template_name(layout_id: str) -> str:
    if layout_id == "classic":
        return "classic_report.html"
    return "professional_report.html"


def _photo_dimensions(layout_id: str) -> tuple[int, int]:
    if layout_id == "classic":
        return CLASSIC_PHOTO_WIDTH_PX, CLASSIC_PHOTO_HEIGHT_PX
    return PRO_PHOTO_WIDTH_PX, PRO_PHOTO_HEIGHT_PX


def _parse_datetime(value: Any) -> datetime | None:
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
    return dt.astimezone(timezone.utc)


def format_timestamp_human(value: Any) -> str:
    """Human-readable UTC timestamp (e.g. June 8, 2026 at 3:45 PM UTC)."""
    dt = _parse_datetime(value)
    if not dt:
        return "—" if not value else str(value)
    hour = dt.strftime("%I").lstrip("0") or "12"
    return (
        f"{dt.strftime('%B')} {dt.day}, {dt.year} "
        f"at {hour}:{dt.strftime('%M %p')} UTC"
    )


def format_date_human(value: Any) -> str | None:
    """Human-readable calendar date (e.g. June 8, 2026)."""
    if value is None:
        return None
    if isinstance(value, str) and len(value) == 10 and value[4] == "-":
        try:
            dt = datetime.strptime(value, "%Y-%m-%d").replace(tzinfo=timezone.utc)
            return f"{dt.strftime('%B')} {dt.day}, {dt.year}"
        except ValueError:
            return value
    dt = _parse_datetime(value)
    if not dt:
        return str(value) if value else None
    return f"{dt.strftime('%B')} {dt.day}, {dt.year}"


def format_captured_label(value: Any) -> str | None:
    """Single-line capture label for checkpoint cards."""
    dt = _parse_datetime(value)
    if not dt:
        return None
    hour = dt.strftime("%I").lstrip("0") or "12"
    return f"Captured {dt.strftime('%B')} {dt.day}, {dt.year} at {hour}:{dt.strftime('%M %p')} UTC"


def _checkpoint_title(name: Any, location: Any) -> str:
    name_s = str(name or "").strip()
    location_s = str(location or "").strip()
    if name_s.lower() == "checkpoint" and location_s:
        return location_s
    if location_s and name_s and location_s.lower() != name_s.lower():
        return f"{location_s} — {name_s}"
    return location_s or name_s or "Checkpoint"


def _checkpoints_index(content_snapshot: dict[str, Any]) -> dict[str, dict[str, Any]]:
    return {
        str(cp.get("checkpointId")): cp
        for cp in content_snapshot.get("checkpoints") or []
        if cp.get("checkpointId")
    }


def _first_photo_url(cp_slice: Optional[dict[str, Any]]) -> Optional[str]:
    if not cp_slice:
        return None
    for media in cp_slice.get("media") or []:
        url = media.get("thumbnailUrl") or media.get("url")
        if url:
            return str(url)
    return None


def _visual_diff_url(cp_slice: Optional[dict[str, Any]]) -> Optional[str]:
    if not cp_slice:
        return None
    heatmap = (cp_slice.get("visualDiff") or {}).get("heatmapUrl")
    return str(heatmap) if heatmap else None


def _severity_class(severity: str) -> str:
    normalized = (severity or "minor").strip().lower()
    if normalized in {"critical", "major", "moderate", "minor"}:
        return f"severity-{normalized}"
    return "severity-minor"


def _build_comparison_sections(
    content_snapshot: dict[str, Any],
    template: dict[str, Any],
) -> list[dict[str, Any]]:
    by_id = _checkpoints_index(content_snapshot)
    include_photos = template.get("includePhotos", True)
    include_visual_diff = template.get("includeVisualDiff", False)
    sections: list[dict[str, Any]] = []
    for pair in content_snapshot.get("comparisonPairs") or []:
        baseline = by_id.get(str(pair.get("baselineCheckpointId")))
        comparison = by_id.get(str(pair.get("comparisonCheckpointId")))
        similarity = pair.get("similarityScore")
        semantic_changes = (comparison.get("visualDiff") or {}).get("semanticChanges") or []
        sections.append(
            {
                "location": pair.get("location") or "Location",
                "summary": pair.get("summary"),
                "semantic_changes": [str(c) for c in semantic_changes[:6]],
                "baseline_photo": _first_photo_url(baseline) if include_photos else None,
                "comparison_photo": _first_photo_url(comparison) if include_photos else None,
                "visual_diff_url": (
                    _visual_diff_url(comparison)
                    if include_photos and include_visual_diff
                    else None
                ),
                "similarity_score": (
                    float(similarity) if similarity is not None else None
                ),
            }
        )
    return sections


def _build_unpaired_rooms(
    content_snapshot: dict[str, Any],
    checkpoint_ids: list[str],
    *,
    role_label: str,
    template: dict[str, Any],
) -> list[dict[str, Any]]:
    by_id = _checkpoints_index(content_snapshot)
    include_photos = template.get("includePhotos", True)
    rooms: list[dict[str, Any]] = []
    for cp_id in checkpoint_ids:
        cp = by_id.get(str(cp_id))
        if not cp:
            continue
        photos = []
        if include_photos:
            photo = _first_photo_url(cp)
            if photo:
                photos.append(photo)
        rooms.append(
            {
                "title": f"{_checkpoint_title(cp.get('name'), cp.get('location'))} ({role_label})",
                "captured_label": format_captured_label(cp.get("capturedAt")),
                "summary": (cp.get("aiAnalysis") or {}).get("summary"),
                "photos": photos,
            }
        )
    return rooms


def _issue_rows(content_snapshot: dict[str, Any]) -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    for cp in content_snapshot.get("checkpoints") or []:
        location = cp.get("location") or cp.get("name") or "—"
        analysis = cp.get("aiAnalysis") or {}
        for issue in analysis.get("issues") or []:
            if isinstance(issue, dict):
                severity = str(issue.get("severity") or "minor")
                rows.append(
                    {
                        "location": location,
                        "severity": severity,
                        "severity_class": _severity_class(severity),
                        "description": str(
                            issue.get("description") or issue.get("text") or ""
                        ),
                    }
                )
            else:
                rows.append(
                    {
                        "location": location,
                        "severity": "minor",
                        "severity_class": _severity_class("minor"),
                        "description": str(issue),
                    }
                )
    return rows


def _count_photos(content_snapshot: dict[str, Any], template: dict[str, Any]) -> int:
    if not template.get("includePhotos", True):
        return 0
    count = 0
    for cp in content_snapshot.get("checkpoints") or []:
        for media in cp.get("media") or []:
            if media.get("thumbnailUrl") or media.get("url"):
                count += 1
    return count


def _report_stats(
    *,
    content_snapshot: dict[str, Any],
    template: dict[str, Any],
    issue_rows: list[dict[str, str]],
    section_count: int,
) -> dict[str, int]:
    major_plus = sum(
        1
        for row in issue_rows
        if row.get("severity", "").lower() in {"major", "critical"}
    )
    return {
        "section_count": section_count,
        "issue_count": len(issue_rows),
        "major_count": major_plus,
        "photo_count": _count_photos(content_snapshot, template),
    }


def _executive_summary(
    content_snapshot: dict[str, Any],
    *,
    issue_rows: list[dict[str, str]],
    section_count: int,
    is_comparison: bool,
) -> Optional[str]:
    narrative = content_snapshot.get("narrative") or {}
    for key in ("executiveSummary", "comparisonSummary"):
        text = narrative.get(key)
        if text and str(text).strip():
            return str(text).strip()

    prop = content_snapshot.get("property") or {}
    property_name = prop.get("name") or "This property"
    issue_count = len(issue_rows)
    if is_comparison:
        return (
            f"{property_name} comparison covers {section_count} paired location(s). "
            f"{issue_count} issue(s) were noted across included checkpoints."
        )
    return (
        f"{property_name} snapshot includes {section_count} checkpoint(s) "
        f"with {issue_count} documented issue(s)."
    )


def _recommendation_lines(
    content_snapshot: dict[str, Any],
    purpose: str,
) -> list[str]:
    lines: list[str] = []
    seen: set[str] = set()

    def add(line: str) -> None:
        normalized = line.strip()
        if normalized and normalized not in seen:
            seen.add(normalized)
            lines.append(normalized)

    for cp in content_snapshot.get("checkpoints") or []:
        analysis = cp.get("aiAnalysis") or {}
        location = cp.get("location") or cp.get("name") or "Location"
        for issue in analysis.get("issues") or []:
            if isinstance(issue, dict):
                severity = str(issue.get("severity") or "").lower()
                if severity in {"major", "critical"}:
                    desc = issue.get("description") or issue.get("text")
                    if desc:
                        add(f"Address {severity} issue in {location}: {desc}")
        for change in (cp.get("visualDiff") or {}).get("semanticChanges") or []:
            add(f"Review change in {location}: {change}")

    if purpose == "rental_security":
        add("Retain signed copies for deposit disposition and lease records.")
    elif purpose == "realtor_visit":
        add("Share highlights with buyers; verify disclosures with your brokerage.")
    elif purpose == "insurance":
        add("Forward this report to your carrier when filing or updating coverage.")
    return lines[:12]


def _metrics_chart_data(content_snapshot: dict[str, Any]) -> Optional[dict[str, Any]]:
    metrics = content_snapshot.get("metrics")
    if not metrics:
        return None
    issues = metrics.get("issues") or {}
    by_sev = issues.get("total_by_severity") or {}
    if not by_sev and not issues.get("total"):
        return None
    total = int(issues.get("total") or sum(int(by_sev.get(k) or 0) for k in by_sev))
    if total <= 0 and (metrics.get("overall") or {}).get("headline", {}).get("value") is None:
        return None

    max_count = max(int(by_sev.get(k) or 0) for k in ("critical", "major", "moderate", "minor")) or 1
    bars = []
    for key, label, color in (
        ("critical", "Critical", "#b91c1c"),
        ("major", "Major", "#c2410c"),
        ("moderate", "Moderate", "#b45309"),
        ("minor", "Minor", "#64748b"),
    ):
        count = int(by_sev.get(key) or 0)
        bars.append(
            {
                "label": label,
                "count": count,
                "color": color,
                "width_pct": int(round((count / max_count) * 100)) if count else 0,
            }
        )

    headline = (metrics.get("overall") or {}).get("headline") or {}
    raw_score = headline.get("value")
    score_display = None
    if raw_score is not None:
        score_display = int(round(float(raw_score)))

    trend_points = (metrics.get("overall") or {}).get("trend") or []
    trend_max = max((int(p.get("score") or 0) for p in trend_points), default=0) or 100
    trend_rows = []
    for point in trend_points:
        score = int(point.get("score") or 0)
        trend_rows.append(
            {
                "label": point.get("label") or "—",
                "score": score,
                "width_pct": int(round((score / trend_max) * 100)) if trend_max else 0,
            }
        )

    return {
        "total_issues": total,
        "headline_score": score_display,
        "deterioration_trend": (metrics.get("deterioration") or {}).get("trend"),
        "bars": bars,
        "trend_points": trend_rows,
    }


def render_report_html(
    *,
    title: str,
    content_snapshot: dict[str, Any],
    template: dict[str, Any],
    custom_notes: str | None,
) -> str:
    prop = content_snapshot.get("property") or {}
    purpose = str(content_snapshot.get("generatedFor") or "custom")
    template_data = resolve_report_template(purpose, template)
    theme = purpose_theme(purpose)
    layout_id = str(template_data.get("layoutId") or "professional")
    photo_width, photo_height = _photo_dimensions(layout_id)

    date_cfg = content_snapshot.get("dateConfig") or {}
    is_comparison = content_snapshot.get("mode") == "comparison"
    snap = date_cfg.get("snapshotRange") or {}
    baseline = date_cfg.get("baselineRange") or {}
    comparison = date_cfg.get("comparisonRange") or {}

    def _range_label(range_cfg: dict[str, Any]) -> Optional[str]:
        if not range_cfg.get("start") or not range_cfg.get("end"):
            return None
        start_label = format_date_human(range_cfg.get("start")) or range_cfg.get("start")
        end_label = format_date_human(range_cfg.get("end")) or range_cfg.get("end")
        return start_label if start_label == end_label else f"{start_label} — {end_label}"

    date_label = _range_label(snap) if snap else None
    baseline_label = _range_label(baseline) if is_comparison else None
    comparison_label = _range_label(comparison) if is_comparison else None

    comparison_sections: list[dict[str, Any]] = []
    appendix_rooms: list[dict[str, Any]] = []
    if is_comparison:
        comparison_sections = _build_comparison_sections(content_snapshot, template_data)
        appendix_rooms = (
            _build_unpaired_rooms(
                content_snapshot,
                content_snapshot.get("baselineOnlyCheckpointIds") or [],
                role_label="baseline only",
                template=template_data,
            )
            + _build_unpaired_rooms(
                content_snapshot,
                content_snapshot.get("comparisonOnlyCheckpointIds") or [],
                role_label="comparison only",
                template=template_data,
            )
        )

    rooms = []
    for cp in content_snapshot.get("checkpoints") or []:
        analysis = cp.get("aiAnalysis") or {}
        photos = []
        if template_data.get("includePhotos", True):
            for m in cp.get("media") or []:
                url = m.get("thumbnailUrl") or m.get("url")
                if url:
                    photos.append(url)
        rooms.append(
            {
                "title": _checkpoint_title(cp.get("name"), cp.get("location")),
                "captured_label": format_captured_label(cp.get("capturedAt")),
                "summary": analysis.get("summary"),
                "photos": photos[:3],
            }
        )

    section_count = len(comparison_sections) if is_comparison else len(rooms)
    issues = _issue_rows(content_snapshot)
    stats = _report_stats(
        content_snapshot=content_snapshot,
        template=template_data,
        issue_rows=issues,
        section_count=section_count,
    )
    executive_summary = _executive_summary(
        content_snapshot,
        issue_rows=issues,
        section_count=section_count,
        is_comparison=is_comparison,
    )
    recommendations = (
        _recommendation_lines(content_snapshot, purpose)
        if template_data.get("includeRecommendations")
        else []
    )
    metrics_chart = (
        _metrics_chart_data(content_snapshot)
        if template_data.get("includeMetricsChart")
        else None
    )

    jinja_template = _get_jinja_env().get_template(_layout_template_name(layout_id))
    return jinja_template.render(
        title=title,
        property_name=prop.get("name"),
        property_address=prop.get("address"),
        date_label=date_label,
        baseline_label=baseline_label,
        comparison_label=comparison_label,
        custom_notes=custom_notes,
        generated_at=format_timestamp_human(content_snapshot.get("resolvedAt")),
        template=template_data,
        theme=theme,
        purpose=purpose,
        issue_rows=issues,
        rooms=rooms,
        is_comparison=is_comparison,
        comparison_sections=comparison_sections,
        appendix_rooms=appendix_rooms,
        section_count=section_count,
        stats=stats,
        executive_summary=executive_summary,
        recommendations=recommendations,
        metrics_chart=metrics_chart,
        photo_width=photo_width,
        photo_height=photo_height,
    )


def _html_to_pdf_xhtml2pdf(html: str) -> bytes:
    try:
        from xhtml2pdf import pisa
    except ImportError as e:
        raise RuntimeError("xhtml2pdf is required for report PDF rendering") from e

    buffer = io.BytesIO()
    result = pisa.CreatePDF(html, dest=buffer)
    if result.err:
        raise RuntimeError(f"PDF rendering failed with {result.err} error(s)")
    return buffer.getvalue()


def _playwright_browser_diagnostics() -> str:
    """Human-readable summary for Cloud Logging (WARNING level — INFO is often dropped)."""
    browsers_path = (os.environ.get("PLAYWRIGHT_BROWSERS_PATH") or "").strip()
    if not browsers_path:
        return "PLAYWRIGHT_BROWSERS_PATH unset (playwright default cache)"
    if not os.path.isdir(browsers_path):
        return f"PLAYWRIGHT_BROWSERS_PATH={browsers_path} (directory missing)"
    binary_names = ("chrome-headless-shell", "chrome")
    for root, _dirs, files in os.walk(browsers_path):
        for name in files:
            if name in binary_names:
                return f"PLAYWRIGHT_BROWSERS_PATH={browsers_path} (found {os.path.join(root, name)})"
    return f"PLAYWRIGHT_BROWSERS_PATH={browsers_path} (no chrome-headless-shell/chrome binary)"


def _escape_pdf_template_text(value: str) -> str:
    return (
        (value or "")
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def _html_to_pdf_playwright(
    html: str,
    *,
    document_title: str | None = None,
    property_name: str | None = None,
) -> bytes:
    from playwright.sync_api import sync_playwright

    title_text = _escape_pdf_template_text(document_title or "Property report")
    property_text = _escape_pdf_template_text(property_name or "")
    if property_text:
        header_template = (
            '<div style="font-size:8px;width:100%;margin:0 0.75in;color:#64748b;'
            'display:flex;justify-content:space-between;">'
            f"<span>{property_text}</span><span>{title_text}</span></div>"
        )
    else:
        header_template = (
            '<div style="font-size:8px;width:100%;margin:0 0.75in;color:#64748b;">'
            f"{title_text}</div>"
        )
    footer_template = (
        '<div style="font-size:8px;width:100%;margin:0 0.75in;text-align:center;color:#64748b;">'
        '<span class="pageNumber"></span> / <span class="totalPages"></span></div>'
    )

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-dev-shm-usage"],
        )
        try:
            page = browser.new_page()
            page.set_content(html, wait_until="networkidle")
            return page.pdf(
                format="Letter",
                display_header_footer=True,
                header_template=header_template,
                footer_template=footer_template,
                margin={
                    "top": "1in",
                    "bottom": "0.85in",
                    "left": "0.75in",
                    "right": "0.75in",
                },
                print_background=True,
            )
        finally:
            browser.close()


def html_to_pdf_bytes(
    html: str,
    *,
    document_title: str | None = None,
    property_name: str | None = None,
) -> bytes:
    started = time.monotonic()
    renderer = (os.environ.get("REPORT_PDF_RENDERER") or "xhtml2pdf").strip().lower()
    logger.warning(
        "Report PDF render start renderer=%s %s",
        renderer,
        _playwright_browser_diagnostics() if renderer == "playwright" else "",
    )
    if renderer == "playwright":
        try:
            pdf_bytes = _html_to_pdf_playwright(
                html,
                document_title=document_title,
                property_name=property_name,
            )
            logger.warning(
                "Report PDF rendered with playwright bytes=%d elapsed=%.2fs",
                len(pdf_bytes),
                time.monotonic() - started,
            )
            return pdf_bytes
        except Exception as exc:
            logger.warning(
                "Playwright PDF render failed; falling back to xhtml2pdf: %s",
                exc,
            )
    pdf_bytes = _html_to_pdf_xhtml2pdf(html)
    logger.warning(
        "Report PDF rendered with xhtml2pdf bytes=%d elapsed=%.2fs",
        len(pdf_bytes),
        time.monotonic() - started,
    )
    return pdf_bytes
