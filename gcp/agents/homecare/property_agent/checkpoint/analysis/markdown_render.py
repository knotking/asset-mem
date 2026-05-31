"""Markdown rendering and merge for checkpoint analysis (V2 structured output)."""

from __future__ import annotations

import json
import logging
import re
from typing import Any, Dict, List, Optional

from google.adk.models.llm_response import LlmResponse

from property_agent.checkpoint.constants import (
    CHECKPOINT_ANALYSIS_STATE_KEY,
    CHECKPOINT_ANALYSIS_PENDING_INPUT_STATE_KEY,
    CHECKPOINT_ANALYSIS_PROGRESS_STATE_KEY,
    CHECKPOINT_PROGRESS_EMIT_SEQ_STATE_KEY,
    CHECKPOINT_SESSION_INPUT_KEYS,
    OPTIONAL_BRANCH_TO_AGENT_NAME,
    CHECKPOINT_RETRIEVAL_SEARCH_QUERY_KEY as _CHECKPOINT_RETRIEVAL_SEARCH_QUERY_KEY,
    _VALID_OPTIONAL_BRANCHES,
    _JSON_FENCE_RE,
)

logger = logging.getLogger(__name__)

from .analysis_validate import (  # noqa: E402
    _coerce_json_array,
    _is_placeholder_checkpoint_summary,
    _list_is_empty,
    _parse_branch_json_blob,
    analysis_has_structured_ui_sections,
    strip_json_fences,
    title_from_markdown_first_heading,
)

_PRODUCT_LINK_PLACEHOLDERS = frozenset(
    {"n/a", "na", "none", "null", "not available", "-", "tbd"}
)


def _join_display_list(items: Any, *, limit: int = 15) -> str:
    if not isinstance(items, list):
        return str(items) if items is not None else ""
    parts = [str(x).strip() for x in items if str(x).strip()]
    return ", ".join(parts[:limit])


def _resolve_product_store_url(product: Dict[str, Any]) -> Optional[str]:
    """http(s) store link for markdown / clients; ignores DIY placeholder values."""
    for key in ("store_url", "url"):
        raw = product.get(key)
        if raw is None:
            continue
        trimmed = str(raw).strip()
        if not trimmed or trimmed.lower() in _PRODUCT_LINK_PLACEHOLDERS:
            continue
        if not trimmed.lower().startswith(("http://", "https://")):
            trimmed = f"https://{trimmed}"
        return trimmed
    return None


def _format_distance_label(miles: Any) -> Optional[str]:
    """e.g. ``4.5`` → ``4.5 mi``; pass through if ``mi`` already present."""
    if miles is None or miles == "":
        return None
    text = str(miles).strip()
    if not text:
        return None
    if re.search(r"\bmi\b", text, re.IGNORECASE):
        return text
    try:
        n = float(text)
    except ValueError:
        return None
    return f"{n:g} mi"


def _format_review_count_label(reviews: Any) -> Optional[str]:
    """e.g. ``91`` → ``91 reviews``; pass through if label already present."""
    if reviews is None or reviews == "":
        return None
    text = str(reviews).strip()
    if not text:
        return None
    if re.search(r"review", text, re.IGNORECASE):
        return text
    return f"{text} reviews"


def _format_recommended_product_markdown_line(product: Dict[str, Any]) -> str:
    """Markdown bullet: name, optional vendor, optional price, optional store link."""
    name = str(product.get("item_name") or product.get("name") or "Product").strip()
    vendor = str(product.get("vendor") or "").strip()
    label = name
    if vendor:
        label += f" ({vendor})"
    price = product.get("item_price") or product.get("price")
    if price is not None and str(price).strip():
        label += f" — {str(price).strip()}"
    store_url = _resolve_product_store_url(product)
    if store_url:
        return f"- [{label}]({store_url})"
    return f"- {label}"


def render_analysis_markdown(analysis: Dict[str, Any]) -> str:
    """Build prompt-style rich markdown (## sections) from the analysis JSON object."""
    title = str(analysis.get("title") or "").strip() or "Checkpoint analysis"
    lines: list[str] = [f"# {title}", ""]

    cs = analysis.get("checkpointSummary")
    if isinstance(cs, dict):
        lines.extend(["## Checkpoint Summary"])
        prop_addr = str(cs.get("propertyAddress") or "").strip()
        if prop_addr:
            lines.append(f"- **Property**: {prop_addr}")
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
                    lines.append(_format_recommended_product_markdown_line(p))
        diy_cost = diy.get("diyCostEstimates")
        if isinstance(diy_cost, dict):
            diy_band = diy_cost.get("DIY")
            if isinstance(diy_band, dict) and diy_band.get("cost_range"):
                lines.append("")
                lines.append(f"**Estimated DIY cost:** {diy_band['cost_range']}")
        if diy.get("hireProfessionalRecommended") is True:
            lines.append("")
            lines.append("*Professional help is recommended for this repair.*")
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
                review_label = _format_review_count_label(pro.get("reviews"))
                distance_label = _format_distance_label(
                    pro.get("distance_miles")
                    if pro.get("distance_miles") is not None
                    else pro.get("_distance_miles")
                )
                notes = str(pro.get("notes") or "").strip()
                entry = f"- **{name}**"
                meta: list[str] = []
                if rating is not None:
                    meta.append(f"rating {rating}")
                if distance_label:
                    meta.append(distance_label)
                if review_label:
                    meta.append(review_label)
                if meta:
                    entry += f" ({', '.join(meta)})"
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
            if (
                branch_steps.get("summary")
                and not (ex_steps.get("summary") or "").strip()
            ):
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
    if "costEstimationResults" in obj and isinstance(
        obj["costEstimationResults"], dict
    ):
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
    if isinstance(inner, dict) and (
        "warrantyInfo" in inner or "insuranceInfo" in inner
    ):
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


def _user_facing_service_search_error(raw_error: str) -> str:
    """Map internal tool errors to a short message for contentJson + UI."""
    err = (raw_error or "").strip()
    if not err:
        return "Service provider search did not complete. Please try again."
    lower = err.lower()
    if "run out of searches" in lower or "quota" in lower:
        return (
            "Service provider search is temporarily unavailable. "
            "Please try again later."
        )
    if "missing api key" in lower or "not available" in lower:
        return "Service provider search is not configured for this environment."
    if "no coordinates" in lower:
        return (
            "Could not resolve a search location for providers. "
            "Check the property address or try again."
        )
    if len(err) > 280:
        return err[:277].rstrip() + "…"
    return err


def _failed_service_results(raw_error: str = "") -> Dict[str, Any]:
    return {
        "localPros": {"serpAPIResults": [], "googleSearchResults": []},
        "searchStatus": "failed",
        "searchError": _user_facing_service_search_error(raw_error),
    }


def _merge_service_into(analysis: Dict[str, Any], raw: str) -> None:
    text = (raw or "").strip()
    if not text or text == "SKIPPED":
        return
    if text.startswith("SKIPPED:"):
        reason = text[len("SKIPPED:") :].strip()
        analysis["serviceResults"] = _failed_service_results(reason)
        return
    extracted = _extract_service_results_from_branch(text)
    if isinstance(extracted, dict):
        analysis["serviceResults"] = extracted
        return
    analysis["serviceResults"] = {
        "localPros": {"serpAPIResults": [], "googleSearchResults": []},
    }


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
    if (
        derived.get("checkpointsAnalyzed", 0) > 0
        or derived.get("issuesDetected")
        or derived.get("locations")
    ):
        analysis["checkpointSummary"] = derived


def build_fallback_analysis(
    *,
    parallel_blob: Optional[Dict[str, Any]],
    markdown_source: str,
    checkpoint_results: str = "",
    property_address: Optional[str] = None,
    retrieval_search_query: Optional[str] = None,
) -> Dict[str, Any]:
    """Analysis object from parallel-branch merges (used only when UI sections exist)."""
    from property_agent.checkpoint.analysis.analysis_normalize import (
        normalize_assembled_analysis,
    )

    title = title_from_markdown_first_heading(markdown_source)
    analysis: Dict[str, Any] = {
        "title": title,
        "checkpointSummary": build_checkpoint_summary_from_results_blob(
            checkpoint_results, markdown_source=markdown_source
        ),
    }
    if isinstance(parallel_blob, dict):
        _merge_coverage_into(
            analysis, str(parallel_blob.get("checkpoint_parallel_coverage_result") or "")
        )
        _merge_diy_into(
            analysis, str(parallel_blob.get("checkpoint_parallel_diy_result") or "")
        )
        _merge_service_into(
            analysis, str(parallel_blob.get("checkpoint_parallel_service_result") or "")
        )
        _merge_cost_into(
            analysis, str(parallel_blob.get("checkpoint_parallel_cost_result") or "")
        )
        _enrich_checkpoint_summary_from_results(
            analysis, checkpoint_results, markdown_source=markdown_source
        )

    return normalize_assembled_analysis(
        analysis,
        property_address=property_address,
        retrieval_search_query=retrieval_search_query,
        markdown_source=markdown_source,
    )


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

