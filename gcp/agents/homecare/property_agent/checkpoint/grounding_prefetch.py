"""Checkpoint web grounding prefetch (DIY steps vs cost pricing)."""

from __future__ import annotations

import logging
import os
from typing import Any, Dict, Sequence

from property_agent.agents.diy_agent.orchestrator.checkpoint_parse import (
    _web_grounding_query,
    resolve_pipeline_diagnosis,
)
from property_agent.agents.diy_agent.orchestrator.prefetch import fetch_repair_web_context
from property_agent.geo.search_location_utils import market_label, search_location_from_payload

logger = logging.getLogger(__name__)

# DIY steps/tools/materials summary (Google Search grounding).
CHECKPOINT_GROUNDING_SUMMARY_KEY = "checkpoint_grounding_web_summary"
# Cost market-pricing summary (separate prompt; not shared with DIY).
CHECKPOINT_PRICING_GROUNDING_SUMMARY_KEY = "checkpoint_pricing_grounding_web_summary"


def should_prefetch_diy_grounding(requested_branches: Sequence[str]) -> bool:
    """Prefetch DIY web summary when the DIY branch runs."""
    if os_prefetch_disabled():
        return False
    return "diy" in set(requested_branches or [])


def should_prefetch_cost_pricing_grounding(requested_branches: Sequence[str]) -> bool:
    """Prefetch pricing-focused web summary when the cost branch runs."""
    if os_prefetch_disabled():
        return False
    return "cost" in set(requested_branches or [])


def should_prefetch_checkpoint_grounding(requested_branches: Sequence[str]) -> bool:
    """Deprecated alias for DIY prefetch (tests / callers)."""
    return should_prefetch_diy_grounding(requested_branches)


def os_prefetch_disabled() -> bool:
    raw = os.getenv("CHECKPOINT_GROUNDING_PREFETCH", "true").strip().lower()
    return raw in ("0", "false", "no", "off")


def grounding_summary_from_payload(payload: Dict[str, Any]) -> str:
    return str(payload.get(CHECKPOINT_GROUNDING_SUMMARY_KEY) or "").strip()


def pricing_grounding_summary_from_payload(payload: Dict[str, Any]) -> str:
    return str(payload.get(CHECKPOINT_PRICING_GROUNDING_SUMMARY_KEY) or "").strip()


def checkpoint_cost_diagnosis(payload: Dict[str, Any]) -> str:
    """Same diagnosis stem the cost branch passes to the estimator."""
    seed = (payload.get("checkpoint_retrieval_search_query") or "").strip()
    if seed:
        return seed
    branch_q = (payload.get("user_query") or "").strip()
    if branch_q:
        return branch_q
    ck = (payload.get("checkpoint_results") or "").strip()
    if ck:
        from property_agent.checkpoint.analysis.search_query import (
            optional_branch_search_user_query,
        )

        return optional_branch_search_user_query(ck)
    return "Property maintenance"


def checkpoint_grounding_diagnosis(payload: Dict[str, Any]) -> str:
    """Same diagnosis text DIY uses for web grounding."""
    branch_q = (payload.get("user_query") or "").strip()
    ck = (payload.get("checkpoint_results") or "").strip()
    if ck and branch_q:
        user_query = f"{branch_q}\n\nCheckpoint context:\n{ck[:6000]}"
    elif ck:
        user_query = ck[:8000]
    else:
        user_query = branch_q or "Property maintenance"
    seed = (payload.get("checkpoint_retrieval_search_query") or "").strip() or None
    diagnosis, _api_seed = resolve_pipeline_diagnosis(user_query, seed)
    return diagnosis or user_query


def checkpoint_market_location(payload: Dict[str, Any]) -> str:
    sl = search_location_from_payload(payload)
    pa = (payload.get("property_address") or "").strip() or None
    label = market_label(sl, property_address=pa)
    return label or pa or "not provided"


def prefetch_checkpoint_web_context(payload: Dict[str, Any]) -> str:
    """
    One grounded (or dynamic-retrieval) web fetch for the checkpoint repair issue.

    Returns trimmed web summary text (may be empty on failure).
    """
    branch_q = (payload.get("user_query") or "").strip()
    ck = (payload.get("checkpoint_results") or "").strip()
    if ck and branch_q:
        user_query = f"{branch_q}\n\nCheckpoint context:\n{ck[:6000]}"
    elif ck:
        user_query = ck[:8000]
    else:
        user_query = branch_q or "Property maintenance"
    seed = (payload.get("checkpoint_retrieval_search_query") or "").strip() or None
    diagnosis, api_seed = resolve_pipeline_diagnosis(user_query, seed)
    market = checkpoint_market_location(payload)
    web_query = _web_grounding_query(diagnosis, api_seed)
    summary = fetch_repair_web_context(web_query, market)
    if summary:
        logger.info(
            "checkpoint grounding prefetch: ok web_query_chars=%d summary_chars=%d",
            len(web_query),
            len(summary),
        )
    else:
        logger.info(
            "checkpoint grounding prefetch: empty web_query_chars=%d",
            len(web_query),
        )
    return summary


def prefetch_checkpoint_pricing_context(payload: Dict[str, Any]) -> str:
    """
    Pricing-focused Google Search grounding for the cost branch.

    Uses the same prompt as ``_fetch_market_pricing_context`` in the cost agent.
    """
    from property_agent.agents.cost_agent.agent import fetch_market_pricing_context

    diagnosis = checkpoint_cost_diagnosis(payload)
    market = checkpoint_market_location(payload)
    location = market if market != "not provided" else None
    summary = fetch_market_pricing_context(diagnosis, location) or ""
    if summary:
        logger.info(
            "checkpoint pricing prefetch: ok diagnosis_chars=%d summary_chars=%d",
            len(diagnosis),
            len(summary),
        )
    else:
        logger.info(
            "checkpoint pricing prefetch: empty diagnosis_chars=%d",
            len(diagnosis),
        )
    return summary
