"""Validation helpers for checkpoint structured analysis payloads."""

from __future__ import annotations

import json
import logging
import re
from typing import Any, Dict, List, Optional

from google.adk.models.llm_response import LlmResponse

from property_agent.checkpoint.constants import _JSON_FENCE_RE

logger = logging.getLogger(__name__)


def extract_text_from_llm_response(llm_response: LlmResponse) -> str:
    """Concatenate text parts from the first model candidate."""
    if not llm_response or not llm_response.content or not llm_response.content.parts:
        return ""
    out: list[str] = []
    for part in llm_response.content.parts:
        if part.text:
            out.append(part.text)
    return "".join(out)


def llm_response_declares_tool_use(llm_response: LlmResponse) -> bool:
    """True when this model turn includes tool/function calls (content must not be replaced)."""
    if not llm_response:
        return False
    return bool(llm_response.get_function_calls())


def llm_response_has_function_responses(llm_response: LlmResponse) -> bool:
    """True when this model turn includes tool/function responses."""
    if not llm_response:
        return False
    return bool(llm_response.get_function_responses())


def llm_response_is_streaming_partial(llm_response: LlmResponse) -> bool:
    """True while ADK/Gemini is still streaming tokens (after_model runs per chunk)."""
    if not llm_response:
        return False
    if getattr(llm_response, "partial", None) is True:
        return True
    if getattr(llm_response, "turn_complete", None) is False:
        return True
    return False


def _is_valid_synthesis_checkpoint_summary(cs: dict) -> bool:
    """Analysis/synthesis mode: full checkpointSummary (issuesDetected, overallCondition, …)."""
    missing = any(
        key not in cs
        for key in (
            "checkpointsAnalyzed",
            "issuesDetected",
            "overallCondition",
            "locations",
        )
    )
    if missing:
        return False
    if not isinstance(cs.get("issuesDetected"), list):
        return False
    if not isinstance(cs.get("locations"), list):
        return False
    if not isinstance(cs.get("overallCondition"), str):
        return False
    if not isinstance(cs.get("checkpointsAnalyzed"), (int, float)):
        return False
    return True


def _is_valid_simple_query_checkpoint_summary(cs: dict) -> bool:
    """Simple retrieval mode: count + locations (queryType/dateRange optional)."""
    if not isinstance(cs.get("checkpointsAnalyzed"), (int, float)):
        return False
    if not isinstance(cs.get("locations"), list):
        return False
    return True


def _is_valid_checkpoint_details(details: Any) -> bool:
    """Simple retrieval mode may put per-checkpoint rows in checkpointDetails."""
    if not isinstance(details, list) or not details:
        return False
    return any(isinstance(item, dict) for item in details)


def _is_placeholder_checkpoint_summary(cs: dict) -> bool:
    """True for the generic fallback stub, not a real synthesis/retrieval summary."""
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


def _analysis_object_is_valid(analysis: dict) -> bool:
    title = analysis.get("title")
    if not isinstance(title, str) or not title.strip():
        return False
    cs = analysis.get("checkpointSummary")
    if isinstance(cs, dict):
        if not _is_placeholder_checkpoint_summary(cs):
            if _is_valid_synthesis_checkpoint_summary(cs):
                return True
            if _is_valid_simple_query_checkpoint_summary(cs):
                return True
    if _is_valid_checkpoint_details(analysis.get("checkpointDetails")):
        return True
    return False


def strip_json_fences(body: str) -> str:
    """Remove all ```json ... ``` blocks (used before appending a corrected fence)."""
    return _JSON_FENCE_RE.sub("", body or "").strip()


def title_from_markdown_first_heading(body: str) -> str:
    for line in (body or "").splitlines():
        s = line.strip()
        if s.startswith("#"):
            return s.lstrip("#").strip() or "Checkpoint analysis"
    return "Checkpoint analysis"


def markdown_has_rich_analysis_sections(markdown: str) -> bool:
    """True when markdown includes structured section headings from the synthesis template."""
    low = (markdown or "").lower()
    markers = (
        "## checkpoint",
        "## coverage",
        "## diy",
        "## service",
        "## cost",
    )
    return any(m in low for m in markers)


def _safe_json_load(raw: str) -> Optional[Any]:
    if not raw or not str(raw).strip() or str(raw).strip() == "SKIPPED":
        return None
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return None


def _parse_branch_json_blob(raw: str) -> Optional[Any]:
    """Parse optional-branch tool output: raw JSON, or ```json ... ``` (as coverage agent often returns)."""
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
    """Normalize branch/synthesis list fields (list or JSON-encoded string)."""
    if isinstance(val, list):
        return val
    if isinstance(val, str) and val.strip():
        parsed = _safe_json_load(val.strip())
        if isinstance(parsed, list):
            return parsed
    return []


def analysis_has_structured_ui_sections(analysis: Dict[str, Any]) -> bool:
    """True when JSON is worth emitting (branch agents or real checkpoint data, not empty stub)."""
    for key in (
        "triageResult",
        "coverageResult",
        "diyResults",
        "serviceResults",
        "costEstimationResults",
        "checkpointDetails",
        "insights",
    ):
        val = analysis.get(key)
        if val:
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


def _service_results_empty(val: Any) -> bool:
    if not isinstance(val, dict):
        return True
    if str(val.get("searchStatus") or "").strip().lower() == "failed":
        return False
    local = val.get("localPros")
    if not isinstance(local, dict):
        return True
    return _list_is_empty(local.get("serpAPIResults")) and _list_is_empty(
        local.get("googleSearchResults")
    )


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

