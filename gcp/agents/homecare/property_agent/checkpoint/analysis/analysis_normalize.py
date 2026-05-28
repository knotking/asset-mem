"""Normalize assembled checkpoint analysis for client JSON quality."""

from __future__ import annotations

import json
import logging
import re
from typing import Any, Dict, List, Optional

from property_agent.checkpoint.analysis.analysis_validate import (
    _coerce_json_array,
    title_from_markdown_first_heading,
)
from property_agent.agents.diy_agent.youtube_relevance import rank_youtube_videos_by_stem

logger = logging.getLogger(__name__)

_GENERIC_ANALYSIS_TITLES = frozenset(
    {"", "checkpoint analysis", "property maintenance analysis"}
)

_SERPAPI_FAILURE_RE = re.compile(
    r"serpapi|run out of searches|search is currently unavailable|"
    r"service provider search not available|upstream_error|serp_api_error",
    re.IGNORECASE,
)

def apply_analysis_title_from_markdown(
    analysis: Dict[str, Any], markdown: str
) -> None:
    """Prefer synthesis heading over generic 'Checkpoint analysis' title."""
    heading = title_from_markdown_first_heading((markdown or "").strip())
    if not heading:
        return
    if heading.strip().lower() in _GENERIC_ANALYSIS_TITLES:
        return
    current = str(analysis.get("title") or "").strip()
    if not current or current.lower() in _GENERIC_ANALYSIS_TITLES:
        analysis["title"] = heading


def normalize_assembled_analysis(
    analysis: Dict[str, Any],
    *,
    property_address: Optional[str] = None,
    retrieval_search_query: Optional[str] = None,
    markdown_source: str = "",
) -> Dict[str, Any]:
    """Apply structural fixes before contentJson is emitted to clients."""
    if not isinstance(analysis, dict):
        return analysis

    apply_analysis_title_from_markdown(analysis, markdown_source)

    _enrich_checkpoint_summary_property(analysis, property_address)
    _normalize_service_results(analysis)
    _normalize_diy_results(analysis, retrieval_search_query=retrieval_search_query)
    _sync_diy_cost_from_cost_branch(analysis)

    return analysis


def _enrich_checkpoint_summary_property(
    analysis: Dict[str, Any], property_address: Optional[str]
) -> None:
    addr = (property_address or "").strip()
    if not addr:
        return
    cs = analysis.get("checkpointSummary")
    if not isinstance(cs, dict):
        cs = {}
        analysis["checkpointSummary"] = cs
    if not str(cs.get("propertyAddress") or "").strip():
        cs["propertyAddress"] = addr[:300]


def _looks_like_serpapi_failure_message(text: str) -> bool:
    s = (text or "").strip()
    if not s:
        return False
    if _SERPAPI_FAILURE_RE.search(s):
        return True
    if len(s) > 80 and not s.startswith("["):
        return True
    return False


def _normalize_provider_object(item: Any) -> Optional[Dict[str, Any]]:
    if isinstance(item, str):
        line = item.strip()
        if not line or _looks_like_serpapi_failure_message(line):
            return None
        try:
            parsed = json.loads(line)
            if isinstance(parsed, dict):
                return _normalize_provider_object(parsed)
        except json.JSONDecodeError:
            pass
        return {"name": line[:200]} if len(line) <= 120 else None

    if not isinstance(item, dict):
        return None

    name = str(
        item.get("name")
        or item.get("provider")
        or item.get("business_name")
        or item.get("title")
        or item.get("company")
        or ""
    ).strip()
    if not name or _looks_like_serpapi_failure_message(name):
        return None

    out: Dict[str, Any] = {"name": name[:200]}
    contact = str(
        item.get("contact_info")
        or item.get("phone")
        or item.get("phoneNumber")
        or item.get("contact")
        or ""
    ).strip()
    if contact:
        out["contact_info"] = contact[:80]
        out["phone"] = contact[:80]

    location = str(
        item.get("location") or item.get("address") or item.get("address_line") or ""
    ).strip()
    if location:
        out["location"] = location[:300]

    for src, dst in (
        ("services", "specialties"),
        ("specialties", "specialties"),
        ("notes", "additional_information"),
        ("details", "additional_information"),
        ("description", "additional_information"),
        ("about", "additional_information"),
    ):
        val = item.get(src)
        if isinstance(val, str) and val.strip():
            existing = str(out.get(dst) or "").strip()
            chunk = val.strip()[:500]
            out[dst] = f"{existing}; {chunk}".strip("; ") if existing else chunk

    rating = item.get("rating") or item.get("ratings")
    if rating is not None and str(rating).strip():
        out["ratings"] = str(rating).strip()[:20]

    reviews = item.get("reviews") or item.get("review_count")
    if reviews is not None and str(reviews).strip():
        out["reviews"] = str(reviews).strip()[:40]

    distance = item.get("distance_miles") or item.get("distance")
    if distance is not None and str(distance).strip():
        out["distance_miles"] = distance

    for url_key in ("website", "url", "link"):
        url = item.get(url_key)
        if isinstance(url, str) and url.strip().startswith(("http://", "https://")):
            out["website"] = url.strip()[:500]
            break

    return out


def _normalize_provider_list(raw: Any) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    if isinstance(raw, str):
        if _looks_like_serpapi_failure_message(raw):
            return []
        try:
            parsed = json.loads(raw)
            return _normalize_provider_list(parsed)
        except json.JSONDecodeError:
            one = _normalize_provider_object(raw)
            return [one] if one else []

    for item in _coerce_json_array(raw):
        row = _normalize_provider_object(item)
        if row:
            rows.append(row)

    seen: set[str] = set()
    deduped: List[Dict[str, Any]] = []
    for row in rows:
        key = row.get("name", "").lower()
        if not key or key in seen:
            continue
        seen.add(key)
        deduped.append(row)
    return deduped[:10]


def _merge_service_provider_lists(
    serp: List[Dict[str, Any]], google: List[Dict[str, Any]], *, max_results: int = 10
) -> List[Dict[str, Any]]:
    """Prefer grounded web pros first, then Maps listings; dedupe by name."""
    merged: List[Dict[str, Any]] = []
    seen: set[str] = set()
    for row in google + serp:
        if not isinstance(row, dict):
            continue
        name = str(row.get("name") or "").strip()
        if not name:
            continue
        key = name.casefold()
        if key in seen:
            continue
        seen.add(key)
        merged.append(row)
        if len(merged) >= max_results:
            break
    return merged


def _normalize_service_results(analysis: Dict[str, Any]) -> None:
    service = analysis.get("serviceResults")
    if not isinstance(service, dict):
        return
    local = service.get("localPros")
    if not isinstance(local, dict):
        local = {}
        service["localPros"] = local

    serp_raw = local.get("serpAPIResults")
    if isinstance(serp_raw, str) and _looks_like_serpapi_failure_message(serp_raw):
        logger.info(
            "analysis normalize: coerced serpAPIResults error string to [] chars=%d",
            len(serp_raw),
        )
        serp_list: List[Dict[str, Any]] = []
    else:
        serp_list = _normalize_provider_list(serp_raw)

    google_list = _normalize_provider_list(local.get("googleSearchResults"))
    local["googleSearchResults"] = google_list
    local["serpAPIResults"] = _merge_service_provider_lists(
        serp_list, google_list, max_results=10
    )


def filter_relevant_youtube_videos(
    videos: List[Dict[str, Any]],
    retrieval_stem: str,
    *,
    search_query: Optional[str] = None,
    max_results: int = 5,
) -> List[Dict[str, Any]]:
    """Re-rank YouTube rows by token overlap with the checkpoint issue stem."""
    stem = (retrieval_stem or "").strip()
    if not videos:
        return []
    if not stem:
        out: List[Dict[str, Any]] = []
        for video in videos:
            if not isinstance(video, dict):
                continue
            if not str(video.get("url") or "").strip():
                continue
            out.append(video)
            if len(out) >= max_results:
                break
        return out
    return rank_youtube_videos_by_stem(
        videos,
        stem,
        search_query=search_query,
        max_results=max_results,
    )


def _normalize_diy_results(
    analysis: Dict[str, Any], *, retrieval_search_query: Optional[str]
) -> None:
    _ = retrieval_search_query
    diy = analysis.get("diyResults")
    if not isinstance(diy, dict):
        return
    yt = diy.get("youtubeSearch")
    if not isinstance(yt, dict):
        return
    raw_videos = yt.get("videos")
    if not isinstance(raw_videos, list) or not raw_videos:
        return
    yt["videos"] = filter_relevant_youtube_videos(
        raw_videos,
        (retrieval_search_query or "").strip(),
        max_results=5,
    )


def _sync_diy_cost_from_cost_branch(analysis: Dict[str, Any]) -> None:
    """Use cost agent DIY estimate as canonical diyCostEstimates when both exist."""
    cost_block = analysis.get("costEstimationResults")
    if not isinstance(cost_block, dict):
        return
    estimates = cost_block.get("costEstimates")
    if not isinstance(estimates, dict):
        return
    cost_diy = estimates.get("DIY")
    if not isinstance(cost_diy, dict) or not cost_diy:
        return

    diy = analysis.get("diyResults")
    if not isinstance(diy, dict):
        diy = {}
        analysis["diyResults"] = diy

    repair_type = str(estimates.get("repair_type") or "").strip()
    synced: Dict[str, Any] = {"DIY": dict(cost_diy)}
    if repair_type:
        synced["repair_type"] = repair_type[:500]
    diy["diyCostEstimates"] = synced
