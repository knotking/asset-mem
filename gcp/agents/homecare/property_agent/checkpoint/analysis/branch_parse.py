"""Branch payload parsing helpers for checkpoint analysis assembly."""

from __future__ import annotations

import json
import re
from typing import Any, Dict, List, Optional

_JSON_FENCE_RE = re.compile(r"```json\s*\n?([\s\S]*?)```", re.IGNORECASE)


def title_from_markdown_first_heading(body: str) -> str:
    for line in (body or "").splitlines():
        s = line.strip()
        if s.startswith("#"):
            return s.lstrip("#").strip() or "Checkpoint analysis"
    return "Checkpoint analysis"


def _safe_json_load(raw: str) -> Optional[Any]:
    if not raw or not str(raw).strip() or str(raw).strip() == "SKIPPED":
        return None
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return None


def _parse_branch_json_blob(raw: str) -> Optional[Any]:
    """Parse optional-branch tool output: raw JSON or fenced JSON."""
    text = (raw or "").strip()
    if not text or text == "SKIPPED":
        return None
    direct = _safe_json_load(text)
    if direct is not None:
        return direct
    for m in _JSON_FENCE_RE.finditer(text):
        inner = _safe_json_load(m.group(1).strip())
        if inner is not None:
            return inner
    return None


def _list_is_empty(val: Any) -> bool:
    return not isinstance(val, list) or len(val) == 0


def _coerce_json_array(val: Any) -> List[Any]:
    if isinstance(val, list):
        return val
    if isinstance(val, str) and val.strip():
        parsed = _safe_json_load(val.strip())
        if isinstance(parsed, list):
            return parsed
    return []


def _is_placeholder_checkpoint_summary(cs: dict) -> bool:
    if not isinstance(cs, dict):
        return True
    analyzed = cs.get("checkpointsAnalyzed", 0)
    try:
        n = int(analyzed) if analyzed is not None else 0
    except (TypeError, ValueError):
        n = 0
    issues = cs.get("issuesDetected")
    locations = cs.get("locations")
    has_issues = isinstance(issues, list) and len(issues) > 0
    has_locs = isinstance(locations, list) and len(locations) > 0
    oc = str(cs.get("overallCondition") or "").strip().lower()
    if "see markdown above" in oc:
        return True
    if n <= 0 and not has_issues and not has_locs:
        return True
    return False


def _coverage_result_empty(val: Any) -> bool:
    if not isinstance(val, dict):
        return True
    return not (str(val.get("warrantyInfo") or "").strip()) and not (
        str(val.get("insuranceInfo") or "").strip()
    )


def _cost_results_empty(val: Any) -> bool:
    if not isinstance(val, dict):
        return True
    estimates = val.get("costEstimates")
    return not isinstance(estimates, dict) or not estimates


def analysis_has_structured_ui_sections(analysis: Dict[str, Any]) -> bool:
    for key in (
        "triageResult",
        "coverageResult",
        "diyResults",
        "serviceResults",
        "costEstimationResults",
        "checkpointDetails",
        "insights",
    ):
        if analysis.get(key):
            return True
    cs = analysis.get("checkpointSummary")
    if isinstance(cs, dict):
        if (
            isinstance(cs.get("checkpointsAnalyzed"), (int, float))
            and cs["checkpointsAnalyzed"] > 0
        ):
            return True
        if cs.get("issuesDetected"):
            return True
        if cs.get("locations"):
            return True
    return False
