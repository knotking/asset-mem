"""Build, validate, and merge checkpoint dual-format markdown + JSON payloads."""

from __future__ import annotations

import json
import logging
import re
from typing import Any, Dict, List, Optional

from google.adk.models.llm_response import LlmResponse

from ...state_delta_merge import merge_state_delta
from .constants import (
    CHECKPOINT_ANALYSIS_DUAL_FORMAT_STATE_KEY,
    CHECKPOINT_ANALYSIS_PENDING_INPUT_STATE_KEY,
    CHECKPOINT_ANALYSIS_PROGRESS_STATE_KEY,
    CHECKPOINT_BRANCH_COMPLETED_STATE_KEY,
    CHECKPOINT_PROGRESS_EMIT_SEQ_STATE_KEY,
    CHECKPOINT_PROGRESS_LAST_EMITTED_SEQ_STATE_KEY,
    CHECKPOINT_PROGRESS_EVENT_AUTHOR,
    CHECKPOINT_SESSION_INPUT_KEYS,
    OPTIONAL_BRANCH_TO_AGENT_NAME,
    _PARALLEL_KEY_TO_BRANCH,
    _CHECKPOINT_RETRIEVAL_SEARCH_QUERY_KEY,
    _VALID_OPTIONAL_BRANCHES,
    _JSON_FENCE_RE,
)

logger = logging.getLogger(__name__)

def normalize_checkpoint_optional_agents(
    value: Any,
) -> List[str]:
    """Return valid optional branch names from state / tool args."""
    if not isinstance(value, list):
        return []
    return [str(x) for x in value if str(x) in _VALID_OPTIONAL_BRANCHES]


def sync_checkpoint_tool_args_to_state(state: Any, args: Dict[str, Any]) -> None:
    """Persist checkpoint tool args on session state for nested runners and transfer."""
    if not hasattr(state, "__setitem__") or not isinstance(args, dict):
        return
    for key in CHECKPOINT_SESSION_INPUT_KEYS:
        if key in args and args[key] is not None:
            state[key] = args[key]


def build_checkpoint_analysis_pending_payload(state: Any) -> Optional[Dict[str, Any]]:
    """Build CheckpointAnalysisInput dict from session fields when JSON stash is absent."""
    if not hasattr(state, "get"):
        return None
    requested = normalize_checkpoint_optional_agents(
        state.get("checkpoint_optional_agents")
    )
    if not requested:
        return None
    checkpoint_results = state.get("checkpoint_results")
    if not isinstance(checkpoint_results, str) or not checkpoint_results.strip():
        return None
    user_query = state.get("user_query")
    if not isinstance(user_query, str):
        user_query = ""
    search_query = state.get(_CHECKPOINT_RETRIEVAL_SEARCH_QUERY_KEY)
    if not isinstance(search_query, str):
        search_query = ""
    payload: Dict[str, Any] = {
        "checkpoint_results": checkpoint_results.strip(),
        "user_query": user_query,
        "search_query": search_query,
        "checkpoint_optional_agents": requested,
    }
    for key in (
        "context_doc_uris",
        "property_address",
        "property_id",
        "search_location",
    ):
        value = state.get(key)
        if value is not None:
            payload[key] = value
    return payload


def apply_tool_context_state_delta(
    tool_context: Any, delta: Dict[str, Any]
) -> None:
    """Write session fields and merge into outgoing tool ``state_delta`` for parent sync."""
    if not delta or tool_context is None:
        return
    state = getattr(tool_context, "state", None)
    if state is not None and hasattr(state, "update"):
        state.update(delta)
    actions = getattr(tool_context, "actions", None)
    if actions is None:
        return
    existing = getattr(actions, "state_delta", None)
    if isinstance(existing, dict):
        actions.state_delta = merge_state_delta(existing, delta)
    else:
        actions.state_delta = merge_state_delta(None, delta)


def ensure_checkpoint_analysis_pending_stashed(state: Any) -> bool:
    """
    Ensure ``checkpoint_analysis_pending_input`` exists when retrieval + optional agents are set.
    Returns True when pending input is present after this call.
    """
    if not hasattr(state, "get"):
        return False
    existing = state.get(CHECKPOINT_ANALYSIS_PENDING_INPUT_STATE_KEY)
    if isinstance(existing, str) and existing.strip():
        return True
    if isinstance(existing, dict) and existing:
        return True
    payload = build_checkpoint_analysis_pending_payload(state)
    if payload is None:
        return False
    state[CHECKPOINT_ANALYSIS_PENDING_INPUT_STATE_KEY] = json.dumps(
        payload, ensure_ascii=False
    )
    logger.info(
        "checkpoint session: ensured pending analysis input branches=%s blob_len=%d",
        payload.get("checkpoint_optional_agents"),
        len(str(payload.get("checkpoint_results") or "")),
    )
    return True


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


def dual_format_is_passthrough_quality(body: str) -> bool:
    """Markdown + JSON with a non-placeholder summary (or checkpointDetails rows)."""
    if not (body or "").strip():
        return False
    if not strip_json_fences(body).strip():
        return False
    if not dual_format_has_valid_analysis_json(body):
        return False
    analysis = extract_analysis_object_from_dual_format(body)
    if not analysis:
        return False
    cs = analysis.get("checkpointSummary")
    if isinstance(cs, dict) and _is_placeholder_checkpoint_summary(cs):
        return _is_valid_checkpoint_details(analysis.get("checkpointDetails"))
    return True


def stash_checkpoint_dual_format_in_state(state: Any, body: str) -> None:
    """Persist analysis workflow dual-format output for parent-agent passthrough."""
    if not dual_format_is_passthrough_quality(body):
        return
    if not hasattr(state, "get") or not hasattr(state, "__setitem__"):
        return
    state[CHECKPOINT_ANALYSIS_DUAL_FORMAT_STATE_KEY] = body
    state["checkpoint_result"] = body


def _analysis_status_for_branches(
    requested: List[str],
    *,
    completed: List[str],
    pending: List[str],
) -> Dict[str, str]:
    status: Dict[str, str] = {}
    done = set(completed)
    for branch in requested:
        if branch in done:
            status[branch] = "completed"
        elif pending and branch == pending[0]:
            status[branch] = "running"
        else:
            status[branch] = "pending"
    return status


def build_progressive_checkpoint_dual_format(
    *,
    checkpoint_results: str,
    user_query: str,
    parallel_results: Dict[str, str],
    requested_branches: List[str],
    completed_branches: List[str],
    pending_branches: List[str],
    in_progress: bool = True,
) -> str:
    """
    Dual-format body with whatever optional branches have finished so far.

    Used for progressive streaming while asyncio.as_completed finishes each branch.
    """
    parallel_blob = {
        k: parallel_results.get(k, "SKIPPED")
        for k in (
            "checkpoint_parallel_coverage_result",
            "checkpoint_parallel_diy_result",
            "checkpoint_parallel_service_result",
            "checkpoint_parallel_cost_result",
        )
    }
    analysis = build_fallback_analysis(
        parallel_blob=parallel_blob,
        markdown_source="",
        checkpoint_results=checkpoint_results,
    )
    if not (analysis.get("title") or "").strip():
        analysis["title"] = title_from_markdown_first_heading(
            (user_query or "").strip()
        ) or "Checkpoint analysis"
    if in_progress and requested_branches:
        analysis["analysisStatus"] = _analysis_status_for_branches(
            requested_branches,
            completed=completed_branches,
            pending=pending_branches,
        )
    markdown = render_analysis_markdown(analysis)
    if not (user_query or "").strip():
        intro = ""
    else:
        intro = f"{user_query.strip()}\n\n" if markdown else user_query.strip()
    body_md = f"{intro}{markdown}".strip() if intro else markdown
    if not body_md.strip():
        body_md = f"# {analysis.get('title') or 'Checkpoint analysis'}\n"
    payload = {"analysis": analysis}
    return (
        f"{body_md.rstrip()}\n\n```json\n"
        f"{json.dumps(payload, ensure_ascii=False, indent=2)}\n```\n"
    )


def build_phase0_checkpoint_dual_format(
    *,
    checkpoint_results: str,
    user_query: str,
    requested_branches: List[str],
) -> str:
    """Summary-only dual format before optional branches start."""
    empty_parallel = {
        "checkpoint_parallel_coverage_result": "SKIPPED",
        "checkpoint_parallel_diy_result": "SKIPPED",
        "checkpoint_parallel_service_result": "SKIPPED",
        "checkpoint_parallel_cost_result": "SKIPPED",
    }
    return build_progressive_checkpoint_dual_format(
        checkpoint_results=checkpoint_results,
        user_query=user_query,
        parallel_results=empty_parallel,
        requested_branches=requested_branches,
        completed_branches=[],
        pending_branches=list(requested_branches),
        in_progress=bool(requested_branches),
    )


def agent_steps_from_progressive_dual_format(body: str) -> List[Dict[str, Any]]:
    """Map analysisStatus in progressive JSON to completed agent step rows."""
    analysis = extract_analysis_object_from_dual_format(body)
    if not isinstance(analysis, dict):
        return []
    status = analysis.get("analysisStatus")
    if not isinstance(status, dict):
        return []
    updates: List[Dict[str, Any]] = []
    for branch, st in status.items():
        if st != "completed":
            continue
        agent_name = OPTIONAL_BRANCH_TO_AGENT_NAME.get(str(branch))
        if agent_name:
            updates.append({"name": agent_name, "status": "completed"})
    return updates


def bump_checkpoint_progress_emit_seq(state: Any) -> int:
    """Increment progress emit sequence; used by doculink streaming callback."""
    if not hasattr(state, "get"):
        return 0
    current = state.get(CHECKPOINT_PROGRESS_EMIT_SEQ_STATE_KEY, 0)
    try:
        seq = int(current) + 1
    except (TypeError, ValueError):
        seq = 1
    state[CHECKPOINT_PROGRESS_EMIT_SEQ_STATE_KEY] = seq
    return seq


def format_checkpoints_for_analysis_blob(
    formatted_results: List[Dict[str, Any]],
) -> str:
    """Build checkpoint_results prose for optional analysis branches."""
    blocks: list[str] = []
    for fc in formatted_results or ():
        if not isinstance(fc, dict):
            continue
        lines: list[str] = []
        name = (fc.get("checkpointName") or "Checkpoint").strip()
        if name:
            lines.append(f"Checkpoint Name: {name}")
        loc = (fc.get("location") or "").strip()
        if loc:
            lines.append(f"Location/Asset: {loc}")
        text = (fc.get("text") or "").strip()
        if text:
            for line in text.splitlines():
                s = line.strip()
                if s and s not in lines:
                    lines.append(s)
        if lines:
            blocks.append("\n".join(lines))
    return "\n\n".join(blocks).strip()


def resolve_passthrough_dual_format_from_state(state: Any) -> Optional[str]:
    """Return stashed dual-format body when present."""
    if not hasattr(state, "get"):
        return None
    for key in (
        CHECKPOINT_ANALYSIS_PROGRESS_STATE_KEY,
        CHECKPOINT_ANALYSIS_DUAL_FORMAT_STATE_KEY,
        "checkpoint_result",
    ):
        raw = state.get(key)
        if isinstance(raw, str) and dual_format_is_passthrough_quality(raw):
            return raw
    return None


def build_checkpoint_summary_from_results_blob(
    checkpoint_results: str,
    *,
    markdown_source: str = "",
) -> Dict[str, Any]:
    """Derive checkpointSummary fields from retrieval / checkpoint_results prose."""
    text = (checkpoint_results or "").strip()
    md = (markdown_source or "").strip()

    names = re.findall(r"(?im)^\s*checkpoint\s+name\s*:", text)
    n = len(names)
    if n == 0 and text:
        n = max(1, len(re.findall(r"(?im)location(?:/asset)?\s*:", text)))

    locations: list[str] = []
    for m in re.finditer(
        r"(?im)(?:^|\n)\s*(?:Location/Asset|Location)\s*:\s*(.+)$",
        text,
    ):
        loc = re.sub(r"\s+", " ", m.group(1).strip()).rstrip(".,;")
        if loc and loc not in locations:
            locations.append(loc)

    issues: list[str] = []
    for m in re.finditer(r"(?im)(?:^|\n)\s*Issues\s*:\s*(.+)$", text):
        chunk = re.sub(r"\s+", " ", m.group(1).strip()).rstrip(".,;")
        if not chunk:
            continue
        for part in re.split(r"[.;]\s+", chunk):
            s = part.strip()
            if s and s not in issues:
                issues.append(s)

    conditions: list[str] = []
    for m in re.finditer(r"(?im)(?:^|\n)\s*Conditions\s*:\s*(.+)$", text):
        chunk = re.sub(r"\s+", " ", m.group(1).strip()).rstrip(".,;")
        if chunk:
            for part in re.split(r",\s*", chunk):
                s = part.strip()
                if s and s not in conditions:
                    conditions.append(s)

    overall = ", ".join(conditions[:4]) if conditions else ""
    if not overall and issues:
        overall = "Issues detected"
    if not overall and locations:
        overall = "See checkpoint details"
    if not overall and md:
        overall = "See markdown above for details."

    return {
        "checkpointsAnalyzed": n,
        "issuesDetected": issues[:20],
        "overallCondition": overall or "Unknown",
        "locations": locations[:10],
    }


def dual_format_has_valid_analysis_json(body: str) -> bool:
    """True if any ```json fence contains parseable ``analysis`` in a known shape."""
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
        if _analysis_object_is_valid(analysis):
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


def _join_display_list(items: Any, *, limit: int = 15) -> str:
    if not isinstance(items, list):
        return str(items) if items is not None else ""
    parts = [str(x).strip() for x in items if str(x).strip()]
    return ", ".join(parts[:limit])


def render_analysis_markdown(analysis: Dict[str, Any]) -> str:
    """Build prompt-style rich markdown (## sections) from the analysis JSON object."""
    title = str(analysis.get("title") or "").strip() or "Checkpoint analysis"
    lines: list[str] = [f"# {title}", ""]

    cs = analysis.get("checkpointSummary")
    if isinstance(cs, dict):
        lines.extend(["## Checkpoint Summary"])
        analyzed = cs.get("checkpointsAnalyzed")
        if analyzed is not None:
            lines.append(f"- **Checkpoints Analyzed**: {analyzed}")
        issues = cs.get("issuesDetected")
        if isinstance(issues, list) and issues:
            lines.append(f"- **Issues Detected**: {_join_display_list(issues)}")
        locations = cs.get("locations")
        if isinstance(locations, list) and locations:
            lines.append(f"- **Locations**: {_join_display_list(locations)}")
        overall = cs.get("overallCondition")
        if overall:
            lines.append(f"- **Overall Condition**: {overall}")
        lines.append("")

    cov = analysis.get("coverageResult")
    if isinstance(cov, dict) and (
        str(cov.get("warrantyInfo") or "").strip()
        or str(cov.get("insuranceInfo") or "").strip()
    ):
        lines.extend(["## Coverage"])
        if cov.get("warrantyInfo"):
            lines.append(f"**Warranty:** {cov['warrantyInfo']}")
        if cov.get("insuranceInfo"):
            lines.append(f"**Insurance:** {cov['insuranceInfo']}")
        lines.append("")

    diy = analysis.get("diyResults")
    if isinstance(diy, dict):
        lines.extend(["## DIY Recommendations"])
        steps_block = diy.get("diySteps")
        if isinstance(steps_block, dict):
            summary = str(steps_block.get("summary") or "").strip()
            if summary:
                lines.append(summary)
                lines.append("")
            steps = steps_block.get("steps")
            if isinstance(steps, list):
                for step in steps:
                    if not isinstance(step, dict):
                        continue
                    num = step.get("stepNumber", "")
                    desc = str(step.get("description") or "").strip()
                    if desc:
                        prefix = f"{num}. " if num != "" else "- "
                        lines.append(f"{prefix}{desc}")
        yt = diy.get("youtubeSearch")
        if isinstance(yt, dict) and isinstance(yt.get("videos"), list) and yt["videos"]:
            lines.append("")
            lines.append("**Helpful videos:**")
            for vid in yt["videos"][:10]:
                if not isinstance(vid, dict):
                    continue
                vtitle = str(vid.get("title") or "Video").strip()
                url = str(vid.get("url") or "").strip()
                lines.append(f"- [{vtitle}]({url})" if url else f"- {vtitle}")
        products = diy.get("recommendedProducts")
        if isinstance(products, dict) and isinstance(products.get("products"), list):
            prods = products["products"]
            if prods:
                lines.append("")
                lines.append("**Recommended products:**")
                for p in prods[:10]:
                    if not isinstance(p, dict):
                        continue
                    name = str(p.get("item_name") or p.get("name") or "Product").strip()
                    vendor = str(p.get("vendor") or "").strip()
                    line = f"- {name}" + (f" ({vendor})" if vendor else "")
                    lines.append(line)
        diy_cost = diy.get("diyCostEstimates")
        if isinstance(diy_cost, dict):
            diy_band = diy_cost.get("DIY")
            if isinstance(diy_band, dict) and diy_band.get("cost_range"):
                lines.append("")
                lines.append(
                    f"**Estimated DIY cost:** {diy_band['cost_range']}"
                )
        if diy.get("hireProfessionalRecommended") is True:
            lines.append("")
            lines.append(
                "*Professional help is recommended for this repair.*"
            )
        lines.append("")

    svc = analysis.get("serviceResults")
    if isinstance(svc, dict):
        local = svc.get("localPros")
        serp: list[Any] = []
        if isinstance(local, dict):
            serp = _coerce_json_array(local.get("serpAPIResults"))
        if serp:
            lines.extend(["## Service Providers"])
            for pro in serp[:10]:
                if not isinstance(pro, dict):
                    continue
                name = str(pro.get("name") or "Provider").strip()
                phone = str(pro.get("phone") or "").strip()
                rating = pro.get("rating")
                notes = str(pro.get("notes") or "").strip()
                entry = f"- **{name}**"
                if rating is not None:
                    entry += f" (rating {rating})"
                if phone:
                    entry += f" — {phone}"
                lines.append(entry)
                if notes:
                    lines.append(f"  - {notes}")
            lines.append("")

    cost_wrap = analysis.get("costEstimationResults")
    estimates = None
    if isinstance(cost_wrap, dict):
        estimates = cost_wrap.get("costEstimates")
    if isinstance(estimates, dict):
        lines.extend(["## Cost Estimates"])
        repair_type = str(estimates.get("repair_type") or "").strip()
        if repair_type:
            lines.append(f"**Repair type:** {repair_type}")
        for band_key, label in (("DIY", "DIY"), ("Service", "Professional service")):
            band = estimates.get(band_key)
            if not isinstance(band, dict):
                continue
            cr = band.get("cost_range")
            if cr:
                lines.append(f"- **{label}:** {cr}")
            includes = band.get("includes")
            if isinstance(includes, list) and includes:
                lines.append(f"  - Includes: {_join_display_list(includes, limit=8)}")
        comparison = estimates.get("comparison")
        if isinstance(comparison, dict):
            for key, heading in (
                ("diy_savings", "DIY savings"),
                ("professional_benefits", "Professional benefits"),
                ("considerations", "Considerations"),
            ):
                val = str(comparison.get(key) or "").strip()
                if val:
                    lines.append(f"- **{heading}:** {val}")
        lines.append("")

    details = analysis.get("checkpointDetails")
    if isinstance(details, list) and details and not isinstance(cs, dict):
        lines.extend(["## Checkpoint Details"])
        for row in details[:10]:
            if not isinstance(row, dict):
                continue
            name = str(row.get("name") or "Checkpoint").strip()
            loc = str(row.get("location") or "").strip()
            issues_row = row.get("issues")
            line = f"- **{name}**"
            if loc:
                line += f" ({loc})"
            lines.append(line)
            if isinstance(issues_row, list) and issues_row:
                lines.append(f"  - Issues: {_join_display_list(issues_row, limit=6)}")
        lines.append("")

    return "\n".join(lines).strip()


def _extract_markdown_intro(markdown: str) -> str:
    """Prose intro from model markdown (exclude duplicate H1 and ## sections)."""
    intro: list[str] = []
    for line in (markdown or "").splitlines():
        stripped = line.strip()
        if stripped.startswith("##"):
            break
        if stripped.startswith("# ") and not intro:
            continue
        intro.append(line)
    return "\n".join(intro).strip()


def rebuild_dual_format_from_analysis(
    analysis: Dict[str, Any],
    *,
    markdown_source: str = "",
    user_query: str = "",
) -> str:
    """Rebuild markdown + ```json fence from a complete analysis object."""
    md = strip_json_fences(markdown_source).strip()
    intro = _extract_markdown_intro(md)
    uq = (user_query or "").strip()
    if uq and uq not in intro:
        intro = f"{uq}\n\n{intro}".strip() if intro else uq
    rendered = render_analysis_markdown(analysis)
    if intro:
        rendered_lines = rendered.splitlines()
        if rendered_lines and rendered_lines[0].startswith("# "):
            rendered = (
                rendered_lines[0]
                + "\n\n"
                + intro
                + "\n\n"
                + "\n".join(rendered_lines[1:])
            )
        else:
            rendered = intro + "\n\n" + rendered
    fence = (
        "\n\n```json\n"
        + json.dumps({"analysis": analysis}, ensure_ascii=False, indent=2)
        + "\n```\n"
    )
    return rendered.rstrip() + fence


def patch_dual_format_from_state(body: str, state: Any) -> str:
    """
    Repair checkpoint_agent / synthesis dual-format using session fields.

    - Fills missing ``analysisStatus`` when optional branches were requested.
    - Replaces placeholder ``checkpointSummary`` (e.g. checkpointsAnalyzed: 0) from
      stashed ``checkpoint_results``.
    """
    if not (body or "").strip():
        stashed = resolve_passthrough_dual_format_from_state(state)
        return stashed if stashed else body

    analysis = extract_analysis_object_from_dual_format(body)
    if not analysis:
        stashed = resolve_passthrough_dual_format_from_state(state)
        return stashed if stashed else body

    changed = False
    ck_blob = state.get("checkpoint_results") if hasattr(state, "get") else None
    if isinstance(ck_blob, str) and ck_blob.strip():
        cs = analysis.get("checkpointSummary")
        if isinstance(cs, dict) and _is_placeholder_checkpoint_summary(cs):
            _enrich_checkpoint_summary_from_results(
                analysis, ck_blob, markdown_source=body
            )
            cs_after = analysis.get("checkpointSummary")
            if isinstance(cs_after, dict) and not _is_placeholder_checkpoint_summary(
                cs_after
            ):
                changed = True

    requested = normalize_checkpoint_optional_agents(
        state.get("checkpoint_optional_agents") if hasattr(state, "get") else None
    )
    if requested:
        status = analysis.get("analysisStatus")
        if not isinstance(status, dict) or not status:
            prog = (
                state.get(CHECKPOINT_ANALYSIS_PROGRESS_STATE_KEY)
                if hasattr(state, "get")
                else None
            )
            prog_analysis: Optional[Dict[str, Any]] = None
            if isinstance(prog, str):
                prog_analysis = extract_analysis_object_from_dual_format(prog)
            if isinstance(prog_analysis, dict) and isinstance(
                prog_analysis.get("analysisStatus"), dict
            ):
                analysis["analysisStatus"] = dict(prog_analysis["analysisStatus"])
            else:
                analysis["analysisStatus"] = _analysis_status_for_branches(
                    requested,
                    completed=[],
                    pending=list(requested),
                )
            changed = True

    if not changed:
        return body

    uq = state.get("user_query") if hasattr(state, "get") else ""
    user_query = uq if isinstance(uq, str) else ""
    return rebuild_dual_format_from_analysis(
        analysis, markdown_source=body, user_query=user_query
    )


def enrich_dual_format_markdown(body: str) -> str:
    """
    Ensure dual-format bodies include rich ## sections derived from analysis JSON.

    Synthesis often emits a short intro + JSON; branch merge fills JSON but keeps thin markdown.
    """
    analysis = extract_analysis_object_from_dual_format(body)
    if not analysis:
        return body
    cs = analysis.get("checkpointSummary")
    if isinstance(cs, dict) and _is_placeholder_checkpoint_summary(cs):
        return body
    md = strip_json_fences(body).strip()
    if markdown_has_rich_analysis_sections(md):
        return body

    intro = _extract_markdown_intro(md)
    rendered = render_analysis_markdown(analysis)
    if intro:
        rendered_lines = rendered.splitlines()
        if rendered_lines and rendered_lines[0].startswith("# "):
            rendered = (
                rendered_lines[0]
                + "\n\n"
                + intro
                + "\n\n"
                + "\n".join(rendered_lines[1:])
            )
        else:
            rendered = intro + "\n\n" + rendered

    fence = (
        "\n\n```json\n"
        + json.dumps({"analysis": analysis}, ensure_ascii=False, indent=2)
        + "\n```\n"
    )
    return rendered.rstrip() + fence


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


def _extract_diy_results_from_branch(raw: str) -> Optional[Dict[str, Any]]:
    """DIY branch JSON → inner diyResults object (includes hireProfessionalRecommended when set)."""
    obj = _parse_branch_json_blob(raw or "")
    if not isinstance(obj, dict):
        return None
    hire = obj.get("hire_professional_recommended")
    inner = obj.get("diyResults")
    if isinstance(inner, dict):
        out = dict(inner)
        if hire is not None and "hireProfessionalRecommended" not in out:
            out["hireProfessionalRecommended"] = bool(hire)
        return out
    if "diySteps" in obj or "youtubeSearch" in obj or "recommendedProducts" in obj:
        return dict(obj)
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


def _overlay_branch_array(existing: Any, branch: Any) -> List[Any]:
    """Prefer non-empty branch arrays so synthesis cannot trim branch payloads."""
    branch_items = _coerce_json_array(branch)
    if branch_items:
        return list(branch_items)
    return list(_coerce_json_array(existing))


def _extract_service_results_from_branch(raw: str) -> Optional[Dict[str, Any]]:
    obj = _parse_branch_json_blob(raw or "")
    if not isinstance(obj, dict):
        return None
    inner = obj.get("serviceResults")
    if isinstance(inner, dict):
        return inner
    if isinstance(obj.get("localPros"), dict):
        return obj
    return None


def _enrich_service_results_from_branch(
    existing: Dict[str, Any], branch: Dict[str, Any]
) -> None:
    """Overlay service branch localPros arrays onto synthesis (branch wins when non-empty)."""
    branch_local = branch.get("localPros")
    if not isinstance(branch_local, dict):
        return
    ex_local = existing.get("localPros")
    if not isinstance(ex_local, dict):
        ex_local = {}
        existing["localPros"] = ex_local
    for key in ("serpAPIResults", "googleSearchResults"):
        if key not in branch_local:
            continue
        merged = _overlay_branch_array(ex_local.get(key), branch_local.get(key))
        if merged:
            ex_local[key] = merged


def _enrich_diy_results_from_branch(
    existing: Dict[str, Any], branch: Dict[str, Any]
) -> None:
    """Fill synthesis diyResults gaps from the DIY orchestrator branch (videos, products, steps)."""
    branch_steps = branch.get("diySteps")
    if isinstance(branch_steps, dict):
        ex_steps = existing.get("diySteps")
        if not isinstance(ex_steps, dict):
            existing["diySteps"] = branch_steps
        else:
            if branch_steps.get("steps") and _list_is_empty(ex_steps.get("steps")):
                ex_steps["steps"] = branch_steps["steps"]
            if branch_steps.get("summary") and not (ex_steps.get("summary") or "").strip():
                ex_steps["summary"] = branch_steps["summary"]

    for block_key, items_key in (
        ("youtubeSearch", "videos"),
        ("recommendedProducts", "products"),
    ):
        branch_block = branch.get(block_key)
        if not isinstance(branch_block, dict):
            continue
        branch_items = branch_block.get(items_key)
        ex_block = existing.get(block_key)
        if not isinstance(ex_block, dict):
            ex_block = {}
            existing[block_key] = ex_block
        merged = _overlay_branch_array(ex_block.get(items_key), branch_items)
        if merged:
            ex_block[items_key] = merged

    if isinstance(branch.get("diyCostEstimates"), dict) and not isinstance(
        existing.get("diyCostEstimates"), dict
    ):
        existing["diyCostEstimates"] = branch["diyCostEstimates"]
    if branch.get("hireProfessionalRecommended") is not None:
        existing["hireProfessionalRecommended"] = bool(
            branch["hireProfessionalRecommended"]
        )


def _merge_diy_into(analysis: Dict[str, Any], raw: str) -> None:
    inner = _extract_diy_results_from_branch(raw or "")
    if isinstance(inner, dict):
        analysis["diyResults"] = inner


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
    extracted = _extract_service_results_from_branch(text)
    if isinstance(extracted, dict):
        analysis["serviceResults"] = extracted
        return
    analysis["serviceResults"] = {
        "localPros": {"serpAPIResults": [], "googleSearchResults": []},
    }


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
        if isinstance(cs.get("checkpointsAnalyzed"), (int, float)) and cs["checkpointsAnalyzed"] > 0:
            return True
        if cs.get("issuesDetected"):
            return True
        if cs.get("locations"):
            return True
    return False


def _enrich_checkpoint_summary_from_results(
    analysis: Dict[str, Any],
    checkpoint_results: str,
    *,
    markdown_source: str = "",
) -> None:
    cs = analysis.get("checkpointSummary")
    if not isinstance(cs, dict) or not _is_placeholder_checkpoint_summary(cs):
        return
    derived = build_checkpoint_summary_from_results_blob(
        checkpoint_results, markdown_source=markdown_source
    )
    if derived.get("checkpointsAnalyzed", 0) > 0 or derived.get("issuesDetected") or derived.get("locations"):
        analysis["checkpointSummary"] = derived


def build_fallback_analysis(
    *,
    parallel_blob: Optional[Dict[str, Any]],
    markdown_source: str,
    checkpoint_results: str = "",
) -> Dict[str, Any]:
    """Analysis object from parallel-branch merges (used only when UI sections exist)."""
    title = title_from_markdown_first_heading(markdown_source)
    analysis: Dict[str, Any] = {
        "title": title,
        "checkpointSummary": build_checkpoint_summary_from_results_blob(
            checkpoint_results, markdown_source=markdown_source
        ),
    }
    if not isinstance(parallel_blob, dict):
        return analysis

    _merge_coverage_into(analysis, str(parallel_blob.get("checkpoint_parallel_coverage_result") or ""))
    _merge_diy_into(analysis, str(parallel_blob.get("checkpoint_parallel_diy_result") or ""))
    _merge_service_into(analysis, str(parallel_blob.get("checkpoint_parallel_service_result") or ""))
    _merge_cost_into(analysis, str(parallel_blob.get("checkpoint_parallel_cost_result") or ""))
    _enrich_checkpoint_summary_from_results(
        analysis, checkpoint_results, markdown_source=markdown_source
    )
    return analysis


def extract_analysis_object_from_dual_format(body: str) -> Optional[Dict[str, Any]]:
    """First valid ``analysis`` object from a dual-format body."""
    for m in _JSON_FENCE_RE.finditer(body or ""):
        data = _safe_json_load(m.group(1).strip())
        if isinstance(data, dict) and isinstance(data.get("analysis"), dict):
            return dict(data["analysis"])
    return None


def _service_results_empty(val: Any) -> bool:
    if not isinstance(val, dict):
        return True
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


def merge_parallel_results_into_dual_format(
    body: str,
    *,
    parallel_results_json: Optional[str],
) -> str:
    """
    Merge checkpoint_parallel_* branch payloads into an existing dual-format response.

    Used after synthesis when the model emits valid JSON but empty or trimmed branch
    sections (youtubeSearch, recommendedProducts, service localPros, etc.).
    """
    if not (parallel_results_json or "").strip():
        return body

    try:
        parallel_blob = json.loads(parallel_results_json)
    except json.JSONDecodeError:
        return body
    if not isinstance(parallel_blob, dict):
        return body

    analysis = extract_analysis_object_from_dual_format(body)
    if analysis is None:
        return ensure_dual_format_body(body, parallel_results_json=parallel_results_json)

    branch_merged = build_fallback_analysis(
        parallel_blob=parallel_blob, markdown_source=body
    )

    cs = analysis.get("checkpointSummary")
    if isinstance(cs, dict) and _is_placeholder_checkpoint_summary(cs):
        branch_cs = branch_merged.get("checkpointSummary")
        if isinstance(branch_cs, dict) and not _is_placeholder_checkpoint_summary(branch_cs):
            analysis["checkpointSummary"] = branch_cs

    branch_diy = branch_merged.get("diyResults")
    if isinstance(branch_diy, dict):
        if not isinstance(analysis.get("diyResults"), dict):
            analysis["diyResults"] = branch_diy
        else:
            _enrich_diy_results_from_branch(analysis["diyResults"], branch_diy)

    branch_cov = branch_merged.get("coverageResult")
    if isinstance(branch_cov, dict) and _coverage_result_empty(
        analysis.get("coverageResult")
    ):
        analysis["coverageResult"] = branch_cov

    branch_svc = branch_merged.get("serviceResults")
    if isinstance(branch_svc, dict):
        if not isinstance(analysis.get("serviceResults"), dict):
            analysis["serviceResults"] = branch_svc
        else:
            _enrich_service_results_from_branch(analysis["serviceResults"], branch_svc)

    branch_cost = branch_merged.get("costEstimationResults")
    if isinstance(branch_cost, dict) and _cost_results_empty(
        analysis.get("costEstimationResults")
    ):
        analysis["costEstimationResults"] = branch_cost

    merged_body = (
        "\n\n```json\n"
        + json.dumps({"analysis": analysis}, ensure_ascii=False, indent=2)
        + "\n```\n"
    )
    merged_body = strip_json_fences(body).rstrip() + merged_body
    enriched = enrich_dual_format_markdown(merged_body)
    if enriched != merged_body:
        logger.info(
            "checkpoint_dual_format: enriched markdown sections after parallel merge"
        )
    return enriched


