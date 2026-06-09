"""Purpose and layout presets for property report PDF rendering."""

from __future__ import annotations

from typing import Any

LAYOUT_IDS = frozenset({"professional", "classic"})
DEFAULT_LAYOUT_ID = "professional"

BASE_TEMPLATE: dict[str, Any] = {
    "layoutId": DEFAULT_LAYOUT_ID,
    "includeCoverPage": True,
    "includePhotos": True,
    "includeIssueTable": True,
    "includeMetricsChart": True,
    "includeVisualDiff": True,
    "includeRecommendations": True,
    "includeSignatureBlock": False,
}

PURPOSE_TEMPLATE_OVERRIDES: dict[str, dict[str, Any]] = {
    "rental_security": {},
    "realtor_visit": {},
    "insurance": {},
    "custom": {},
}

PURPOSE_THEME: dict[str, dict[str, str]] = {
    "rental_security": {
        "brand": "Rental condition report",
        "accent": "#0f766e",
        "accent_light": "#ccfbf1",
        "disclaimer": (
            "This document records visible property condition at the dates shown. "
            "It is not a substitute for a licensed home inspection."
        ),
        "signature_label": "Tenant / landlord acknowledgment",
    },
    "realtor_visit": {
        "brand": "Property showing report",
        "accent": "#0369a1",
        "accent_light": "#e0f2fe",
        "disclaimer": (
            "Prepared for real estate showing and marketing. "
            "Condition notes reflect AI-assisted visual review at capture time."
        ),
        "signature_label": "Agent acknowledgment",
    },
    "insurance": {
        "brand": "Insurance documentation report",
        "accent": "#4338ca",
        "accent_light": "#e0e7ff",
        "disclaimer": (
            "Documented for insurance and claims support. "
            "Verify coverage and deductibles with your carrier."
        ),
        "signature_label": "Policyholder acknowledgment",
    },
    "custom": {
        "brand": "Property condition report",
        "accent": "#334155",
        "accent_light": "#f1f5f9",
        "disclaimer": "AI-assisted visual condition summary for the dates shown.",
        "signature_label": "Acknowledgment",
    },
}


def resolve_report_template(
    purpose: str,
    raw_template: dict[str, Any] | None,
) -> dict[str, Any]:
    """Merge base, purpose defaults, and user-selected template flags."""
    raw = dict(raw_template or {})
    layout_id = str(raw.get("layoutId") or DEFAULT_LAYOUT_ID)
    if layout_id not in LAYOUT_IDS:
        layout_id = DEFAULT_LAYOUT_ID
    merged = {
        **BASE_TEMPLATE,
        **PURPOSE_TEMPLATE_OVERRIDES.get(purpose, {}),
        **raw,
    }
    merged["layoutId"] = layout_id
    return merged


def purpose_theme(purpose: str) -> dict[str, str]:
    return dict(PURPOSE_THEME.get(purpose, PURPOSE_THEME["custom"]))
