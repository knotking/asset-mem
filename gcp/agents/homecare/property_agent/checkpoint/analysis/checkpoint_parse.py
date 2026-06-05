"""Parse checkpoint analysis tool args (JSON normalization helpers)."""

from __future__ import annotations

import json
from typing import Any, Dict, Optional


def parse_checkpoint_analysis_payload(text: str) -> Optional[Dict[str, Any]]:
    """Parse a JSON object for CheckpointAnalysisInput fields."""
    raw = (text or "").strip()
    if not raw.startswith("{"):
        return None
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return None
    return data if isinstance(data, dict) else None


def normalize_checkpoint_analysis_tool_args(
    args: Dict[str, Any],
) -> Dict[str, Any]:
    """Normalize legacy tool args to CheckpointAnalysisInput-shaped fields."""
    if not isinstance(args, dict):
        raise TypeError("checkpoint analysis tool args must be a dict")

    structured_keys = {
        "checkpoint_results",
        "user_query",
        "checkpoint_optional_agents",
    }
    if structured_keys.issubset(args.keys()):
        return dict(args)

    merged: Dict[str, Any] = {
        k: v for k, v in args.items() if k != "request" and v is not None
    }
    request_blob = args.get("request")
    if isinstance(request_blob, str) and request_blob.strip():
        parsed = parse_checkpoint_analysis_payload(request_blob)
        if parsed:
            merged = {**parsed, **merged}
        elif "checkpoint_results" not in merged:
            merged["checkpoint_results"] = request_blob.strip()

    return merged
