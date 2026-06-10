"""Session working memory and analysis blob helpers."""

from __future__ import annotations

import json
from typing import Any, Mapping, Optional

from agent_framework.context.memory_merge import merge_memory_maps
from agent_framework.context.prompt.session_memory import (
    format_session_working_memory_block_from_memory,
)

from property_agent.checkpoint.constants import CHECKPOINT_IDS_ANALYZED_STATE_KEY

from ..conversational_intent import prior_checkpoint_analysis_in_session
from ..optional_branches import OPTIONAL_CHECKPOINT_BRANCHES

SESSION_WORKING_MEMORY_SNAPSHOT_KEY = "session_working_memory_snapshot"

def _names_from_service_results_blob(obj: Any) -> list[str]:
    if not isinstance(obj, dict):
        return []
    svc = obj.get("serviceResults")
    if not isinstance(svc, dict):
        analysis = obj.get("analysis")
        if isinstance(analysis, dict):
            svc = analysis.get("serviceResults")
    if not isinstance(svc, dict):
        return []
    local = svc.get("localPros")
    if not isinstance(local, dict):
        return []
    names: list[str] = []
    for key in ("serpAPIResults", "googleSearchResults", "yelpAPIResults"):
        items = local.get(key)
        if not isinstance(items, list):
            continue
        for item in items:
            if not isinstance(item, dict):
                continue
            name = item.get("name") or item.get("title") or item.get("businessName")
            if isinstance(name, str) and name.strip():
                names.append(name.strip())
    return names


def _provider_entry_from_item(item: dict[str, Any]) -> dict[str, Any]:
    entry = {
        k: item.get(k)
        for k in (
            "name",
            "services",
            "notes",
            "website",
            "phone",
            "contact_info",
            "location",
            "rating",
            "reviews",
        )
        if item.get(k) is not None
    }
    raw_service = item.get("service")
    if raw_service is not None and not entry.get("services"):
        if isinstance(raw_service, str) and raw_service.strip():
            entry["services"] = [raw_service.strip()]
        elif isinstance(raw_service, list):
            entry["services"] = raw_service
    name = item.get("name") or item.get("title") or item.get("businessName")
    if isinstance(name, str) and name.strip() and "name" not in entry:
        entry["name"] = name.strip()
    rating = item.get("rating")
    if rating is None:
        rating = item.get("ratings")
    if rating is not None and not entry.get("rating"):
        entry["rating"] = rating
    reviews = item.get("reviews") or item.get("review_count")
    if reviews is not None and not entry.get("reviews"):
        entry["reviews"] = reviews
    if not entry.get("location"):
        address = item.get("address") or item.get("address_line")
        if isinstance(address, str) and address.strip():
            entry["location"] = address.strip()
    return entry


def _merge_provider_details(existing: dict[str, Any], new: dict[str, Any]) -> dict[str, Any]:
    merged = dict(existing)
    for key, value in new.items():
        if value is None:
            continue
        if key not in merged or not merged.get(key):
            merged[key] = value
        elif key == "services" and isinstance(value, list):
            old = merged.get("services")
            if isinstance(old, list):
                merged["services"] = list(dict.fromkeys([*old, *value]))
            else:
                merged["services"] = value
    return merged


def _parse_json_maybe(text: Any) -> Any:
    if not isinstance(text, str) or not text.strip():
        return None
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return None


_ANALYSIS_BRANCH_KEYS = frozenset(
    {
        "checkpointSummary",
        "serviceResults",
        "diyResults",
        "coverageResult",
        "costEstimationResults",
        "analysisStatus",
        "title",
    }
)


def _analysis_dict_from_branch_blob(blob: Any) -> Optional[dict[str, Any]]:
    if not isinstance(blob, dict):
        return None
    inner = blob.get("analysis")
    if isinstance(inner, dict):
        return inner
    if _ANALYSIS_BRANCH_KEYS & blob.keys():
        return blob
    svc = blob.get("serviceResults")
    if isinstance(svc, dict):
        return blob
    return None


def _analysis_object_from_state(state: Mapping[str, Any] | None) -> Optional[dict[str, Any]]:
    if not state:
        return None
    structured = state.get("checkpoint_analysis")
    if isinstance(structured, dict):
        parsed = _analysis_dict_from_branch_blob(structured)
        if parsed is not None:
            return parsed
    parallel = _parse_json_maybe(state.get("checkpoint_parallel_results"))
    if isinstance(parallel, dict):
        merged: dict[str, Any] = {}
        for key, value in parallel.items():
            if not any(token in str(key).lower() for token in ("diy", "cost", "coverage", "service")):
                continue
            inner = _parse_json_maybe(value) if isinstance(value, str) else value
            branch_analysis = _analysis_dict_from_branch_blob(inner)
            if branch_analysis is None:
                continue
            for branch_key, branch_value in branch_analysis.items():
                if branch_value is not None:
                    merged[branch_key] = branch_value
        if merged:
            return merged
    snapshot = state.get(SESSION_WORKING_MEMORY_SNAPSHOT_KEY)
    if isinstance(snapshot, dict):
        digest = snapshot.get("analysis_digest")
        if isinstance(digest, dict):
            return digest
    return None


def _branch_payload_has_content(branch: str, analysis: dict[str, Any]) -> bool:
    if branch == "diy":
        diy = analysis.get("diyResults")
        if not isinstance(diy, dict):
            return False
        steps = diy.get("diySteps")
        if isinstance(steps, dict) and steps.get("steps"):
            return True
        videos = (diy.get("youtubeSearch") or {}).get("videos")
        return isinstance(videos, list) and len(videos) > 0
    if branch == "cost":
        cost = analysis.get("costEstimationResults")
        if not isinstance(cost, dict):
            return False
        estimates = cost.get("costEstimates")
        return isinstance(estimates, dict) and bool(estimates)
    if branch == "coverage":
        cov = analysis.get("coverageResult")
        return isinstance(cov, dict) and bool(cov)
    if branch == "service":
        svc = analysis.get("serviceResults")
        if not isinstance(svc, dict):
            return False
        local = svc.get("localPros")
        if not isinstance(local, dict):
            return False
        for key in ("serpAPIResults", "googleSearchResults", "yelpAPIResults"):
            items = local.get(key)
            if isinstance(items, list) and items:
                return True
        return False
    return False


def _iter_service_result_blobs(state: Mapping[str, Any]) -> list[dict[str, Any]]:
    blobs: list[dict[str, Any]] = []
    snapshot = state.get(SESSION_WORKING_MEMORY_SNAPSHOT_KEY)
    if isinstance(snapshot, dict):
        raw = snapshot.get("service_results_blob")
        if isinstance(raw, dict):
            blobs.append(raw)
    parallel = _parse_json_maybe(state.get("checkpoint_parallel_results"))
    if isinstance(parallel, dict):
        for key, value in parallel.items():
            if "service" not in str(key).lower():
                continue
            inner = _parse_json_maybe(value) if isinstance(value, str) else value
            if isinstance(inner, dict):
                blobs.append(inner)
    structured = state.get("checkpoint_analysis")
    if isinstance(structured, dict):
        blobs.append(structured)
    return blobs


def extract_known_service_providers(state: Mapping[str, Any] | None) -> list[str]:
    if not state:
        return []
    seen: dict[str, str] = {}
    def _add(names: list[str]) -> None:
        for n in names:
            key = n.lower()
            if key not in seen:
                seen[key] = n
    for blob in _iter_service_result_blobs(state):
        _add(_names_from_service_results_blob(blob))
    snapshot = state.get(SESSION_WORKING_MEMORY_SNAPSHOT_KEY)
    if isinstance(snapshot, dict):
        for name in snapshot.get("service_providers_mentioned") or []:
            if isinstance(name, str) and name.strip():
                _add([name.strip()])
    return sorted(seen.values(), key=len, reverse=True)


def extract_service_provider_details(state: Mapping[str, Any] | None) -> dict[str, dict[str, Any]]:
    if not state:
        return {}
    out: dict[str, dict[str, Any]] = {}
    def _add_from_blob(blob: dict[str, Any]) -> None:
        svc = blob.get("serviceResults")
        if not isinstance(svc, dict):
            analysis = blob.get("analysis")
            if isinstance(analysis, dict):
                svc = analysis.get("serviceResults")
        if not isinstance(svc, dict):
            return
        local = svc.get("localPros")
        if not isinstance(local, dict):
            return
        for key in ("serpAPIResults", "googleSearchResults", "yelpAPIResults"):
            items = local.get(key)
            if not isinstance(items, list):
                continue
            for item in items:
                if not isinstance(item, dict):
                    continue
                name = item.get("name") or item.get("title") or item.get("businessName")
                if not isinstance(name, str) or not name.strip():
                    continue
                k = name.strip()
                entry = _provider_entry_from_item(item)
                out[k] = _merge_provider_details(out.get(k, {}), entry) if k in out else entry
    for blob in _iter_service_result_blobs(state):
        _add_from_blob(blob)
    snapshot = state.get(SESSION_WORKING_MEMORY_SNAPSHOT_KEY)
    if isinstance(snapshot, dict):
        stored = snapshot.get("service_provider_details")
        if isinstance(stored, dict):
            for name, detail in stored.items():
                if name not in out and isinstance(detail, dict):
                    out[str(name)] = detail
    return out
def _service_results_blob_for_snapshot(state: Mapping[str, Any]) -> Optional[dict[str, Any]]:
    structured = state.get("checkpoint_analysis")
    if isinstance(structured, dict) and _names_from_service_results_blob(structured):
        return structured
    parallel = _parse_json_maybe(state.get("checkpoint_parallel_results"))
    if isinstance(parallel, dict):
        for key, value in parallel.items():
            if "service" not in str(key).lower():
                continue
            inner = _parse_json_maybe(value) if isinstance(value, str) else value
            if isinstance(inner, dict) and _names_from_service_results_blob(inner):
                return inner
    return None


def _truncate_text(value: Any, limit: int) -> str:
    if not isinstance(value, str):
        return ""
    text = value.strip()
    if len(text) <= limit:
        return text
    return text[: limit - 3].rstrip() + "..."


def _branches_completed_from_analysis(analysis: dict[str, Any]) -> list[str]:
    status = analysis.get("analysisStatus")
    if isinstance(status, dict):
        completed = [
            str(branch)
            for branch, st in status.items()
            if str(st).lower() == "completed" and branch in OPTIONAL_CHECKPOINT_BRANCHES
        ]
        if completed:
            return completed
    return [
        branch
        for branch in OPTIONAL_CHECKPOINT_BRANCHES
        if _branch_payload_has_content(branch, analysis)
    ]


def _diy_steps_summary_from_analysis(analysis: dict[str, Any]) -> list[str]:
    diy = analysis.get("diyResults")
    if not isinstance(diy, dict):
        return []
    steps_obj = diy.get("diySteps")
    if not isinstance(steps_obj, dict):
        return []
    steps = steps_obj.get("steps")
    if not isinstance(steps, list):
        return []
    titles: list[str] = []
    for step in steps[:16]:
        if not isinstance(step, dict):
            continue
        title = step.get("title") or step.get("name")
        if isinstance(title, str) and title.strip():
            titles.append(title.strip())
            continue
        desc = step.get("description")
        if isinstance(desc, str) and desc.strip():
            titles.append(_truncate_text(desc, 120))
    return titles


def _coverage_summary_from_analysis(analysis: dict[str, Any]) -> dict[str, str]:
    cov = analysis.get("coverageResult")
    if not isinstance(cov, dict):
        return {}
    out: dict[str, str] = {}
    for key in ("warrantyInfo", "insuranceInfo"):
        text = _truncate_text(cov.get(key), 600)
        if text:
            out[key] = text
    return out


def _cost_summary_from_analysis(analysis: dict[str, Any]) -> dict[str, Any]:
    cost = analysis.get("costEstimationResults")
    if not isinstance(cost, dict):
        return {}
    estimates = cost.get("costEstimates")
    if not isinstance(estimates, dict):
        return {}
    summary: dict[str, Any] = {}
    for key, value in estimates.items():
        if isinstance(value, dict):
            summary[str(key)] = {
                k: value.get(k)
                for k in ("min", "max", "average", "currency", "description")
                if value.get(k) is not None
            }
        elif value is not None:
            summary[str(key)] = value
    return summary


def _analysis_digest_from_analysis(analysis: dict[str, Any]) -> dict[str, Any]:
    digest: dict[str, Any] = {}
    for branch in _branches_completed_from_analysis(analysis):
        digest.setdefault("branches_completed", []).append(branch)
    diy_steps = _diy_steps_summary_from_analysis(analysis)
    if diy_steps:
        digest["diy_steps_summary"] = diy_steps
    coverage = _coverage_summary_from_analysis(analysis)
    if coverage:
        digest["coverage_summary"] = coverage
    cost = _cost_summary_from_analysis(analysis)
    if cost:
        digest["cost_summary"] = cost
    svc = analysis.get("serviceResults")
    if isinstance(svc, dict):
        digest["serviceResults"] = svc
    return digest


def _build_session_working_memory_from_live(state: Mapping[str, Any]) -> dict[str, Any]:
    memory: dict[str, Any] = {}
    providers = extract_known_service_providers(state)
    if providers:
        memory["service_providers_mentioned"] = providers[:12]
    details = extract_service_provider_details(state)
    if details:
        memory["service_provider_details"] = details
    blob = _service_results_blob_for_snapshot(state)
    if blob:
        memory["service_results_blob"] = blob
    analysis = _analysis_object_from_state(state)
    if isinstance(analysis, dict):
        summary = analysis.get("checkpointSummary")
        if isinstance(summary, dict):
            memory["checkpoint_summary"] = {
                k: summary.get(k)
                for k in (
                    "overallCondition",
                    "issuesDetected",
                    "locations",
                    "checkpointsAnalyzed",
                )
                if summary.get(k) is not None
            }
        title = analysis.get("title")
        if isinstance(title, str) and title.strip():
            memory["analysis_title"] = title.strip()
        branches = _branches_completed_from_analysis(analysis)
        if branches:
            memory["branches_completed"] = branches
        digest = _analysis_digest_from_analysis(analysis)
        if digest:
            memory["analysis_digest"] = digest
        diy_steps = digest.get("diy_steps_summary") if digest else None
        if isinstance(diy_steps, list) and diy_steps:
            memory["diy_steps_summary"] = diy_steps
        coverage = digest.get("coverage_summary") if digest else None
        if isinstance(coverage, dict) and coverage:
            memory["coverage_summary"] = coverage
        cost = digest.get("cost_summary") if digest else None
        if isinstance(cost, dict) and cost:
            memory["cost_summary"] = cost
    if state.get("checkpoint_last_response_kind"):
        memory["last_response_kind"] = state.get("checkpoint_last_response_kind")
    if state.get("analysisRunId"):
        memory["analysis_run_id"] = state.get("analysisRunId")
    if state.get("property_id"):
        memory["property_id"] = state.get("property_id")
    analyzed_ids = state.get(CHECKPOINT_IDS_ANALYZED_STATE_KEY)
    if isinstance(analyzed_ids, list) and analyzed_ids:
        memory[CHECKPOINT_IDS_ANALYZED_STATE_KEY] = [
            str(x) for x in analyzed_ids if x is not None and str(x).strip()
        ]
    return memory

def snapshot_session_analysis_context(state: Any) -> None:
    if state is None or not hasattr(state, "__setitem__"):
        return
    memory = _build_session_working_memory_from_live(state)
    memory.pop("service_results_blob", None)
    if not memory:
        return
    existing = state.get(SESSION_WORKING_MEMORY_SNAPSHOT_KEY)
    if isinstance(existing, dict):
        merged = dict(existing)
        for key, value in memory.items():
            if key == "service_providers_mentioned":
                names = set(merged.get(key) or [])
                names.update(value or [])
                merged[key] = sorted(names, key=str.lower)
            elif key == "service_provider_details":
                details = dict(merged.get(key) or {})
                if isinstance(value, dict):
                    details.update(value)
                merged[key] = details
            elif key == "branches_completed":
                branches = set(merged.get(key) or [])
                branches.update(value or [])
                merged[key] = sorted(branches)
            elif key == "analysis_digest" and isinstance(value, dict):
                existing_digest = dict(merged.get(key) or {})
                existing_digest.update(value)
                merged[key] = existing_digest
            elif value:
                merged[key] = value
        memory = merged
    state[SESSION_WORKING_MEMORY_SNAPSHOT_KEY] = memory


def _format_provider_lines(memory: Mapping[str, Any]) -> list[str]:
    details = memory.get("service_provider_details")
    if not isinstance(details, dict) or not details:
        names = memory.get("service_providers_mentioned")
        if not isinstance(names, list):
            return []
        return [f"- {name}" for name in names[:12] if isinstance(name, str) and name.strip()]
    lines: list[str] = ["**Service providers (from prior analysis):**"]
    for name, detail in list(details.items())[:12]:
        if not isinstance(detail, dict):
            lines.append(f"- **{name}**")
            continue
        parts = [f"**{name}**"]
        for label, key in (
            ("phone", "phone"),
            ("contact", "contact_info"),
            ("location", "location"),
            ("website", "website"),
        ):
            val = detail.get(key)
            if val is not None and str(val).strip():
                parts.append(f"{label}: {val}")
        rating = detail.get("rating")
        if rating is None:
            rating = detail.get("ratings")
        if rating is not None and str(rating).strip():
            parts.append(f"rating: {rating}")
        reviews = detail.get("reviews")
        if reviews is not None and str(reviews).strip():
            parts.append(f"reviews: {reviews}")
        lines.append("- " + " | ".join(parts))
    return lines


def session_has_checkpoint_answer_context(state: Mapping[str, Any] | None) -> bool:
    """True when session memory or live analysis can ground a checkpoint follow-up."""
    if not state:
        return False
    if prior_checkpoint_analysis_in_session(state):
        return True
    memory = build_session_working_memory(state)
    if not memory:
        return False
    if memory.get("checkpoint_summary"):
        return True
    if memory.get("analysis_digest"):
        return True
    if memory.get("branches_completed"):
        return True
    if memory.get("analysis_title"):
        return True
    analyzed_ids = memory.get(CHECKPOINT_IDS_ANALYZED_STATE_KEY)
    if isinstance(analyzed_ids, list) and analyzed_ids:
        return True
    return False


def build_session_working_memory(state: Mapping[str, Any] | None) -> dict[str, Any]:
    if not state:
        return {}
    memory: dict[str, Any] = {}
    snapshot = state.get(SESSION_WORKING_MEMORY_SNAPSHOT_KEY)
    if isinstance(snapshot, dict):
        memory.update(snapshot)
    live = _build_session_working_memory_from_live(state)
    return merge_memory_maps(memory, live, list_union_keys=("service_providers_mentioned",), dict_merge_keys=("service_provider_details",))


def format_session_working_memory_block(
    state: Mapping[str, Any] | None,
    *,
    max_chars: int | None = None,
) -> str:
    memory = build_session_working_memory(state)
    if not memory:
        return ""
    provider_lines = _format_provider_lines(memory)
    kwargs: dict[str, int] = {}
    if max_chars is not None:
        kwargs["max_chars"] = max_chars
    base = format_session_working_memory_block_from_memory(memory, **kwargs)
    if not provider_lines:
        return base
    prefix = "\n".join(provider_lines) + "\n\n"
    if not base:
        return prefix.strip()
    return prefix + base
