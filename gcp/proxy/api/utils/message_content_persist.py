"""Orchestrator V2: split, merge, and finalize assistant message content fields."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from typing import Any, Optional

# Platform contracts (local dev: gcp/agent_framework; Docker: staged next to api/).
_api_root = Path(__file__).resolve().parents[1]
for root in (_api_root.parent.parent, _api_root):
    if (root / "agent_framework" / "__init__.py").is_file() and str(root) not in sys.path:
        sys.path.insert(0, str(root))
        break

from agent_framework.contracts.message_patch_v1 import merge_state_delta_message_keys

_JSON_FENCE_BLOCK_RE = re.compile(r"```json\s*\n.*?```", re.DOTALL)
_JSON_FENCE_OPEN_RE = re.compile(r"```json\s*\n.*", re.DOTALL)

_BRANCH_SECTION_KEYS: tuple[str, ...] = (
    "coverageResult",
    "diyResults",
    "serviceResults",
    "costEstimationResults",
)


def merge_branch_into_content_json(
    existing: dict[str, Any] | None,
    patch: dict[str, Any] | None,
) -> dict[str, Any] | None:
    """
    Merge structured checkpoint patches with last-write-wins per branch section.

    Preserves and merges ``analysis.analysisStatus`` when both sides provide it.
    """
    if patch is None:
        return existing
    if existing is None:
        return json.loads(json.dumps(patch))

    merged: dict[str, Any] = json.loads(json.dumps(existing))
    patch_analysis = patch.get("analysis")
    if not isinstance(patch_analysis, dict):
        return merged

    existing_analysis = merged.get("analysis")
    if not isinstance(existing_analysis, dict):
        existing_analysis = {}
        merged["analysis"] = existing_analysis

    patch_status = patch_analysis.get("analysisStatus")
    if isinstance(patch_status, dict):
        current_status = existing_analysis.get("analysisStatus")
        if isinstance(current_status, dict):
            existing_analysis["analysisStatus"] = {
                **current_status,
                **patch_status,
            }
        else:
            existing_analysis["analysisStatus"] = dict(patch_status)

    for section_key in _BRANCH_SECTION_KEYS:
        if section_key in patch_analysis:
            existing_analysis[section_key] = patch_analysis[section_key]

    for key, value in patch_analysis.items():
        if key == "analysisStatus" or key in _BRANCH_SECTION_KEYS:
            continue
        existing_analysis[key] = value

    for key, value in patch.items():
        if key == "analysis":
            continue
        merged[key] = value

    return merged


def finalize_assistant_message(
    markdown: str | None,
    content_json: dict[str, Any] | None,
) -> tuple[str, dict[str, Any] | None]:
    """
    Produce Firestore-ready ``contentMarkdown`` / ``contentJson`` pair.

    Strips accidental ```json fences from markdown; structured data must come from
    ``contentJson`` / ``state_delta``, not from prose fences.
    """
    md = _strip_json_fences((markdown or "").strip())
    return md, content_json


def apply_message_patch_from_state_delta(
    delta: dict[str, Any],
    current_patch: dict[str, Any] | None,
) -> dict[str, Any]:
    """
    Merge agent ``actions.state_delta`` message fields into an accumulated patch.

    Key names follow ``MessagePatchInputV1`` / ``merge_state_delta_message_keys``;
    ``contentJson`` uses branch-aware merge for checkpoint optional agents.
    """
    merged = merge_state_delta_message_keys(delta, current_patch)
    patch_json = delta.get("contentJson") if isinstance(delta, dict) else None
    if isinstance(patch_json, dict):
        prior_raw = (current_patch or {}).get("contentJson")
        prior_dict = prior_raw if isinstance(prior_raw, dict) else None
        merged["contentJson"] = merge_branch_into_content_json(prior_dict, patch_json)
    return merged


def _strip_json_fences(text: str) -> str:
    without_blocks = _JSON_FENCE_BLOCK_RE.sub("", text)
    without_open = _JSON_FENCE_OPEN_RE.sub("", without_blocks)
    return without_open.strip()


def fence_chars_removed(markdown: str | None) -> int:
    """Return characters removed when stripping accidental ```json fences."""
    md_raw = (markdown or "").strip()
    if not md_raw:
        return 0
    return len(md_raw) - len(_strip_json_fences(md_raw))
