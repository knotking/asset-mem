"""Unit tests for report PDF HTML rendering."""

from __future__ import annotations

from datetime import datetime, timezone

from pdf_renderer import (
    _checkpoint_title,
    format_captured_label,
    format_date_human,
    format_timestamp_human,
    render_report_html,
)


def test_format_timestamp_human_from_iso():
    assert (
        format_timestamp_human("2026-06-08T15:45:00+00:00")
        == "June 8, 2026 at 3:45 PM UTC"
    )


def test_format_date_human_from_ymd():
    assert format_date_human("2026-06-08") == "June 8, 2026"


def test_format_captured_label():
    assert (
        format_captured_label("2026-06-08T15:27:00+00:00")
        == "Captured June 8, 2026 at 3:27 PM UTC"
    )


def test_checkpoint_title_prefers_location_when_name_is_generic():
    assert _checkpoint_title("Checkpoint", "Garage") == "Garage"


def test_render_report_html_single_checkpoint_card_layout():
    resolved = datetime(2026, 6, 8, 20, 30, tzinfo=timezone.utc)
    html = render_report_html(
        title="Showing snapshot",
        content_snapshot={
            "property": {"name": "Home", "address": "123 Main St"},
            "generatedFor": "realtor_visit",
            "mode": "snapshot",
            "resolvedAt": resolved.isoformat(),
            "dateConfig": {"snapshotRange": {"start": "2026-06-01", "end": "2026-06-08"}},
            "checkpoints": [
                {
                    "name": "Checkpoint",
                    "location": "Garage",
                    "capturedAt": "2026-06-08T15:27:00+00:00",
                    "media": [{"url": "https://example.com/a.jpg"}],
                    "aiAnalysis": {"summary": "Paint damage near the handle."},
                }
            ],
        },
        template={
            "layoutId": "classic",
            "includeCoverPage": True,
            "includePhotos": True,
            "includeIssueTable": False,
        },
        custom_notes=None,
    )

    assert "June 8, 2026 at 8:30 PM UTC" in html
    assert "checkpoint-card" in html
    assert "checkpoint-card-header" in html
    assert "checkpoint-card-body" in html
    assert ">Garage<" in html
    assert "Captured June 8, 2026 at 3:27 PM UTC" in html
    assert "Paint damage near the handle." in html
    assert 'width="200"' in html
    assert 'height="150"' in html
    assert html.count('class="checkpoint-card-header"') == 1


def test_render_report_html_professional_layout():
    resolved = datetime(2026, 6, 8, 20, 30, tzinfo=timezone.utc)
    html = render_report_html(
        title="Insurance snapshot",
        content_snapshot={
            "property": {"name": "Home", "address": "123 Main St"},
            "generatedFor": "insurance",
            "mode": "snapshot",
            "resolvedAt": resolved.isoformat(),
            "dateConfig": {"snapshotRange": {"start": "2026-06-01", "end": "2026-06-08"}},
            "checkpoints": [
                {
                    "name": "Kitchen",
                    "location": "Kitchen",
                    "capturedAt": "2026-06-08T15:27:00+00:00",
                    "media": [{"url": "https://example.com/a.jpg"}],
                    "aiAnalysis": {
                        "summary": "Countertop in good condition.",
                        "issues": [
                            {"severity": "minor", "description": "Scuff on cabinet"}
                        ],
                    },
                }
            ],
        },
        template={"layoutId": "professional"},
        custom_notes="Policy #12345",
    )

    assert "pro-cover" in html
    assert "location-card" in html
    assert "Insurance documentation report" in html
    assert "Executive summary" in html
    assert "Scuff on cabinet" in html


def test_render_report_html_professional_metrics_chart():
    html = render_report_html(
        title="Metrics snapshot",
        content_snapshot={
            "property": {"name": "Home"},
            "generatedFor": "realtor_visit",
            "mode": "snapshot",
            "resolvedAt": "2026-06-08T20:30:00+00:00",
            "dateConfig": {"snapshotRange": {"start": "2026-06-01", "end": "2026-06-08"}},
            "metrics": {
                "checkpointsIncluded": 2,
                "issues": {
                    "total": 3,
                    "total_by_severity": {
                        "critical": 0,
                        "major": 1,
                        "moderate": 1,
                        "minor": 1,
                    },
                },
                "overall": {"headline": {"value": 88}},
            },
            "checkpoints": [],
        },
        template={"layoutId": "professional", "includeMetricsChart": True},
        custom_notes=None,
    )

    assert "Condition metrics" in html
    assert "Headline score" in html
