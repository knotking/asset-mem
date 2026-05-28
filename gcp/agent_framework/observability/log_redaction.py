"""Redact sensitive fields before logging tool args and user queries."""

from __future__ import annotations

import re
from typing import Any, Dict, Optional

from agent_framework.observability.redaction_policy import (
    DEFAULT_LOG_REDACTION_POLICY,
    LogRedactionPolicy,
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


def _policy_redacts_key(key: str, policy: LogRedactionPolicy) -> bool:
    return (
        key in policy.sensitive_keys
        or key in policy.address_keys
        or key in policy.uri_list_keys
        or (key == "search_location" and policy.redact_search_location)
    )


def redact_tool_args_for_log(
    args: Any,
    *,
    policy: LogRedactionPolicy = DEFAULT_LOG_REDACTION_POLICY,
) -> Dict[str, Any]:
    """Return a log-safe copy of tool args (keys preserved, sensitive values redacted)."""
    if not isinstance(args, dict):
        return {"_type": type(args).__name__}
    out: Dict[str, Any] = {}
    for key, value in args.items():
        if _policy_redacts_key(key, policy):
            out[key] = _redact_value(key, value, policy=policy)
        elif isinstance(value, dict):
            out[key] = redact_tool_args_for_log(value, policy=policy)
        elif isinstance(value, list):
            out[key] = _redact_list(key, value, policy=policy)
        else:
            out[key] = value
    return out


def _redact_list(key: str, value: list, *, policy: LogRedactionPolicy) -> Any:
    if _policy_redacts_key(key, policy):
        return _redact_value(key, value, policy=policy)
    if key in policy.list_summary_keys and value:
        return f"<{len(value)} ids>"
    return value


def _redact_value(key: str, value: Any, *, policy: LogRedactionPolicy) -> Any:
    if value is None:
        return None
    if key in policy.uri_list_keys:
        if isinstance(value, list):
            return f"<{len(value)} uris>"
        return "<uris>"
    if key == "search_location" and policy.redact_search_location and isinstance(value, dict):
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
        if key in policy.address_keys:
            return "<redacted address>"
        preview = safe_text_preview(value, max_len=60)
        return preview if preview else "<empty>"
    if isinstance(value, list):
        if key in policy.list_summary_keys:
            return f"<{len(value)} ids>"
        return f"<list len={len(value)}>"
    if isinstance(value, dict):
        return "<redacted object>"
    return "<redacted>"


def redact_gcs_uris(text: str) -> str:
    """Replace ``gs://`` URIs with a placeholder."""
    return _GCS_URI_RE.sub("<gcs-uri>", text or "")
