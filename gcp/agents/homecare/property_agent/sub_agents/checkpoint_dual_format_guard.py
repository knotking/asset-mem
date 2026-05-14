"""Server-side guard: checkpoint flows must return markdown + a valid ```json analysis block."""

from __future__ import annotations

import json
import logging
import re
from typing import Any, Dict, Optional

from google.adk.agents.callback_context import CallbackContext
from google.adk.models.llm_response import LlmResponse
from google.genai import types

logger = logging.getLogger(__name__)

_JSON_FENCE_RE = re.compile(r"```json\s*\n?([\s\S]*?)```", re.IGNORECASE)


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
    if not llm_response or not llm_response.content or not llm_response.content.parts:
        return False
    for part in llm_response.content.parts:
        if getattr(part, "function_call", None) is not None:
            return True
        if getattr(part, "functionCall", None) is not None:
            return True
    return False


def dual_format_has_valid_analysis_json(body: str) -> bool:
    """True if any ```json fence contains parseable ``analysis`` + ``checkpointSummary``."""
    if not (body or "").strip():
        return False
    for m in _JSON_FENCE_RE.finditer(body):
        raw = m.group(1).strip()
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            continue
        if not isinstance(data, dict):
            continue
        analysis = data.get("analysis")
        if not isinstance(analysis, dict):
            continue
        title = analysis.get("title")
        if not isinstance(title, str) or not title.strip():
            continue
        cs = analysis.get("checkpointSummary")
        if not isinstance(cs, dict):
            continue
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
            continue
        if not isinstance(cs.get("issuesDetected"), list):
            continue
        if not isinstance(cs.get("locations"), list):
            continue
        if not isinstance(cs.get("overallCondition"), str):
            continue
        if not isinstance(cs.get("checkpointsAnalyzed"), (int, float)):
            continue
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


def _merge_diy_into(analysis: Dict[str, Any], raw: str) -> None:
    obj = _parse_branch_json_blob(raw or "")
    if not isinstance(obj, dict):
        return
    inner = obj.get("diyResults")
    if isinstance(inner, dict):
        analysis["diyResults"] = inner
        return
    if "diySteps" in obj or "youtubeSearch" in obj:
        analysis["diyResults"] = obj


def _merge_cost_into(analysis: Dict[str, Any], raw: str) -> None:
    obj = _parse_branch_json_blob(raw or "")
    if not isinstance(obj, dict):
        return
    if "costEstimationResults" in obj and isinstance(obj["costEstimationResults"], dict):
        analysis["costEstimationResults"] = obj["costEstimationResults"]
        return
    if "costEstimates" in obj and isinstance(obj["costEstimates"], dict):
        analysis["costEstimationResults"] = {"costEstimates": obj["costEstimates"]}
        return
    if "diyCostEstimates" in obj and isinstance(obj["diyCostEstimates"], dict):
        analysis["costEstimationResults"] = {"costEstimates": obj["diyCostEstimates"]}


def _merge_coverage_into(analysis: Dict[str, Any], raw: str) -> None:
    text = (raw or "").strip()
    if not text or text == "SKIPPED":
        return
    obj = _parse_branch_json_blob(text)
    if not isinstance(obj, dict):
        analysis["coverageResult"] = {"warrantyInfo": text[:8000], "insuranceInfo": ""}
        return
    inner = obj.get("coverageResult")
    if isinstance(inner, dict) and ("warrantyInfo" in inner or "insuranceInfo" in inner):
        analysis["coverageResult"] = {
            "warrantyInfo": str(inner.get("warrantyInfo") or ""),
            "insuranceInfo": str(inner.get("insuranceInfo") or ""),
        }
        return
    if "warrantyInfo" in obj or "insuranceInfo" in obj:
        analysis["coverageResult"] = {
            "warrantyInfo": str(obj.get("warrantyInfo") or ""),
            "insuranceInfo": str(obj.get("insuranceInfo") or ""),
        }
        return
    analysis["coverageResult"] = {"warrantyInfo": text[:8000], "insuranceInfo": ""}


def _merge_service_into(analysis: Dict[str, Any], raw: str) -> None:
    text = (raw or "").strip()
    if not text or text == "SKIPPED":
        return
    obj = _parse_branch_json_blob(text)
    if isinstance(obj, dict) and "localPros" in obj:
        analysis["serviceResults"] = obj
        return
    if isinstance(obj, dict) and "serviceResults" in obj and isinstance(obj["serviceResults"], dict):
        analysis["serviceResults"] = obj["serviceResults"]
        return
    analysis["serviceResults"] = {
        "localPros": {"serpAPIResults": [], "googleSearchResults": []},
    }


def build_fallback_analysis(
    *,
    parallel_blob: Optional[Dict[str, Any]],
    markdown_source: str,
) -> Dict[str, Any]:
    """Minimal analysis object + merged optional-branch payloads when JSON is missing."""
    title = title_from_markdown_first_heading(markdown_source)
    analysis: Dict[str, Any] = {
        "title": title,
        "checkpointSummary": {
            "checkpointsAnalyzed": 0,
            "issuesDetected": [],
            "overallCondition": "See markdown above for details.",
            "locations": [],
        },
    }
    if not isinstance(parallel_blob, dict):
        return analysis

    _merge_coverage_into(analysis, str(parallel_blob.get("checkpoint_parallel_coverage_result") or ""))
    _merge_diy_into(analysis, str(parallel_blob.get("checkpoint_parallel_diy_result") or ""))
    _merge_service_into(analysis, str(parallel_blob.get("checkpoint_parallel_service_result") or ""))
    _merge_cost_into(analysis, str(parallel_blob.get("checkpoint_parallel_cost_result") or ""))
    return analysis


def ensure_dual_format_body(
    body: str,
    *,
    parallel_results_json: Optional[str] = None,
) -> str:
    """Ensure a valid ```json fence; strip invalid fences, then append a corrected one if needed."""
    if dual_format_has_valid_analysis_json(body):
        return body
    base = strip_json_fences(body)
    parallel: Optional[Dict[str, Any]] = None
    if parallel_results_json and parallel_results_json.strip():
        try:
            parallel = json.loads(parallel_results_json)
        except json.JSONDecodeError:
            parallel = None
    analysis = build_fallback_analysis(parallel_blob=parallel, markdown_source=body)
    fence = (
        "\n\n```json\n"
        + json.dumps({"analysis": analysis}, ensure_ascii=False, indent=2)
        + "\n```\n"
    )
    return base.rstrip() + fence


def synthesis_after_model_callback(
    callback_context: CallbackContext,
    llm_response: LlmResponse,
) -> Optional[LlmResponse]:
    """ADK hook: checkpoint analysis synthesizer must emit markdown + valid analysis JSON."""
    if llm_response_declares_tool_use(llm_response):
        return None
    text = extract_text_from_llm_response(llm_response)
    if dual_format_has_valid_analysis_json(text):
        return None
    parallel = callback_context.state.get("checkpoint_parallel_results")
    par_str = parallel if isinstance(parallel, str) else None
    fixed = ensure_dual_format_body(text, parallel_results_json=par_str)
    logger.warning(
        "checkpoint_analysis_synthesis: model output missing valid ```json``` block; "
        "appending fallback analysis (parallel_state=%s)",
        "yes" if par_str else "no",
    )
    new_content = types.Content(role="model", parts=[types.Part(text=fixed)])
    return llm_response.model_copy(update={"content": new_content})


def checkpoint_agent_after_model_callback(
    callback_context: CallbackContext,
    llm_response: LlmResponse,
) -> Optional[LlmResponse]:
    """ADK hook: checkpoint_agent (simple query or passthrough) must keep dual format."""
    if llm_response_declares_tool_use(llm_response):
        return None
    text = extract_text_from_llm_response(llm_response)
    if dual_format_has_valid_analysis_json(text):
        return None
    parallel = callback_context.state.get("checkpoint_parallel_results")
    par_str = parallel if isinstance(parallel, str) else None
    fixed = ensure_dual_format_body(text, parallel_results_json=par_str)
    logger.warning(
        "checkpoint_agent: model output missing valid ```json``` block; "
        "appending fallback analysis (parallel_state=%s)",
        "yes" if par_str else "no",
    )
    new_content = types.Content(role="model", parts=[types.Part(text=fixed)])
    return llm_response.model_copy(update={"content": new_content})
