"""Redact sensitive fields before logging tool args and user queries."""

from __future__ import annotations

import re
from typing import Any, Dict, Optional

# Keys whose values must not appear in logs (PII, document URIs, full payloads).
_SENSITIVE_ARG_KEYS = frozenset(
    {
        "user_query",
        "search_query",
        "request",
        "checkpoint_results",
        "property_address",
        "context_doc_uris",
        "diagnosis",
        "diagnosis_uris",
        "location",
        "search_location",
        "market_location",
        "query",
        "text",
    }
)

_GCS_URI_RE = re.compile(r"gs://[^\s,]+", re.IGNORECASE)


def safe_text_preview(text: Optional[str], *, max_len: int = 80) -> str:
    """Short, log-safe preview of free text (no full user content)."""
    if not text:
        return ""
    compact = " ".join(str(text).split())
    if len(compact) <= max_len:
        return compact
    return f"{compact[: max_len - 3]}..."


def redact_tool_args_for_log(args: Any) -> Dict[str, Any]:
    """Return a log-safe copy of tool args (keys preserved, sensitive values redacted)."""
    if not isinstance(args, dict):
        return {"_type": type(args).__name__}
    out: Dict[str, Any] = {}
    for key, value in args.items():
        if key in _SENSITIVE_ARG_KEYS:
            out[key] = _redact_value(key, value)
        elif isinstance(value, dict):
            out[key] = redact_tool_args_for_log(value)
        elif isinstance(value, list):
            out[key] = _redact_list(key, value)
        else:
            out[key] = value
    return out


def _redact_list(key: str, value: list) -> Any:
    if key in _SENSITIVE_ARG_KEYS:
        return _redact_value(key, value)
    if key == "checkpoint_ids" and value:
        return f"<{len(value)} ids>"
    return value


def _redact_value(key: str, value: Any) -> Any:
    if value is None:
        return None
    if key == "context_doc_uris":
        if isinstance(value, list):
            return f"<{len(value)} uris>"
        return "<uris>"
    if key == "search_location" and isinstance(value, dict):
        coords = (
            value.get("coordinates")
            if isinstance(value.get("coordinates"), dict)
            else {}
        )
        return {
            "source": value.get("source"),
            "radius_miles": value.get("radius_miles"),
            "has_label": bool((value.get("label") or "").strip()),
            "coordinates": (
                {"lat": coords.get("lat"), "lng": coords.get("lng")} if coords else None
            ),
        }
    if isinstance(value, str):
        if key in ("property_address", "location", "market_location"):
            return "<redacted address>"
        preview = safe_text_preview(value, max_len=60)
        return preview if preview else "<empty>"
    if isinstance(value, list):
        return f"<list len={len(value)}>"
    if isinstance(value, dict):
        return "<redacted object>"
    return "<redacted>"


def redact_gcs_uris(text: str) -> str:
    """Replace ``gs://`` URIs with a placeholder."""
    return _GCS_URI_RE.sub("<gcs-uri>", text or "")
