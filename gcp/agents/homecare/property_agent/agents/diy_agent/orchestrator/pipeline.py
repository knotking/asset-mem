"""DIY orchestrator pipeline entrypoints."""

from __future__ import annotations

import json
import logging
import time
from concurrent.futures import Future, ThreadPoolExecutor, as_completed
from typing import Any, Dict, Optional

from property_agent.shared.inputs import SearchLocation
from agent_platform.core.execution.thread_context import executor_submit, to_thread
from agent_platform.core.observability.logging_context import get_auth_uid
from property_agent.geo.search_location_utils import market_label
from .cache import (
    _CACHE_LOCK,
    _DIY_CACHE,
    _cache_key,
    _cache_ttl_seconds,
    _prune_cache_unlocked,
)
from .checkpoint_parse import resolve_pipeline_diagnosis, _web_grounding_query
from property_agent.agents.cost_agent.agent import cost_estimation_diy_from_library
from .prefetch import (
    _cost_query,
    _diy_web_search_grounded,
    _market_location_string,
    _product_recommendations_log_summary,
    _products_for_checkpoint_retrieval_seed,
    _products_for_diagnosis,
    _youtube_for_checkpoint_retrieval_seed,
    _youtube_for_diagnosis,
)
from property_agent.checkpoint.branch_search_intents import BranchSearchIntents
from .steps_llm import _run_pool_phase, _synthesize_diy_json

logger = logging.getLogger(__name__)

def run_diy_pipeline_sync(
    user_query: str,
    property_address: Optional[str] = None,
    search_location: Optional[SearchLocation] = None,
    context_doc_uris: Optional[list[str]] = None,
    checkpoint_retrieval_search_query: Optional[str] = None,
    prefetched_web_summary: Optional[str] = None,
    branch_search_intents: Optional[BranchSearchIntents] = None,
) -> str:
    """
    Runs the optimized DIY pipeline: parallel grounded web search, YouTube, shopping,
    library-only DIY cost, then steps-only LLM + Python assembly.

    Args:
        user_query: Diagnosis or issue text (checkpoint branch usually embeds checkpoint context here).
        property_address: Property record address (identity only; not used for market geo when search_location is set).
        search_location: Unified market/geo for web, cost, and shopping locality.
        context_doc_uris: Reserved for future RAG; ignored for now.
        checkpoint_retrieval_search_query: When set, grounded web search, YouTube, shopping,
            and library DIY cost use this retrieval phrase (after strip). Synthesis uses
            ``user_query`` (full checkpoint / diagnosis text). When ``None``, web/YouTube/products
            derive from compacted ``user_query``.
        branch_search_intents: Optional per-branch queries (YouTube, shopping materials).

    Returns:
        JSON string suitable for clients (includes hire_professional_recommended and diyResults).
    """
    del context_doc_uris  # reserved
    diagnosis, api_seed = resolve_pipeline_diagnosis(
        user_query, checkpoint_retrieval_search_query
    )
    if not diagnosis:
        return json.dumps(
            {
                "hire_professional_recommended": False,
                "diyResults": {
                    "diySteps": {"summary": "No issue text provided.", "steps": []},
                    "youtubeSearch": {"videos": []},
                    "recommendedProducts": {"products": []},
                    "diyCostEstimates": {},
                },
            }
        )

    market_loc = _market_location_string(search_location, property_address)
    ttl = _cache_ttl_seconds()
    intents_dict = branch_search_intents.to_dict() if branch_search_intents else None
    ck = _cache_key(
        diagnosis,
        market_loc,
        checkpoint_retrieval_search_query=api_seed,
        branch_search_intents=intents_dict,
    )
    if ttl > 0:
        with _CACHE_LOCK:
            hit = _DIY_CACHE.get(ck)
            if hit and (time.time() - hit[0]) <= ttl:
                logger.info("DIY orchestrator cache hit key=%s", ck[:16])
                return hit[1]

    t0 = time.monotonic()
    cost_source = api_seed or diagnosis
    web_query = _web_grounding_query(diagnosis, api_seed)
    cost_q = _cost_query(cost_source, market_loc)

    logger.info(
        "DIY orchestrator: pipeline_start diagnosis_chars=%d web_query_chars=%d "
        "cost_query_chars=%d market_location_set=%s retrieval_seed_len=%d cache_ttl_s=%.0f",
        len(diagnosis),
        len(web_query),
        len(cost_source),
        bool(market_loc and market_loc != "not provided"),
        -1 if api_seed is None else len(api_seed),
        ttl,
    )

    web_text = (prefetched_web_summary or "").strip()
    yt: list[Dict[str, Any]] = []
    products_raw = ""
    cost_raw = ""

    future_map: Dict[Future[Any], str] = {}
    submit_at: Dict[Future[Any], float] = {}
    max_workers = 3 if web_text else 4
    with ThreadPoolExecutor(max_workers=max_workers) as pool:
        submit_uid = get_auth_uid()

        def submit_phase(phase: str, fn, *args: Any) -> None:
            fut = executor_submit(pool, _run_pool_phase, fn, args, submit_uid)
            future_map[fut] = phase
            submit_at[fut] = time.monotonic()

        if web_text:
            logger.info(
                "DIY orchestrator: skipping web prefetch (checkpoint shared summary chars=%d)",
                len(web_text),
            )
        else:
            submit_phase("web", _diy_web_search_grounded, web_query, market_loc)
        if api_seed:
            logger.debug(
                "DIY orchestrator: web+YouTube+shopping use checkpoint retrieval search_query "
                "stem len=%d query=%r",
                len(api_seed),
                api_seed,
            )
            submit_phase(
                "youtube",
                _youtube_for_checkpoint_retrieval_seed,
                api_seed,
                search_location,
                branch_search_intents,
            )
            submit_phase(
                "products",
                _products_for_checkpoint_retrieval_seed,
                api_seed,
                search_location,
                property_address,
                branch_search_intents,
            )
        else:
            submit_phase(
                "youtube",
                _youtube_for_diagnosis,
                diagnosis,
                search_location,
                branch_search_intents,
            )
            submit_phase(
                "products",
                _products_for_diagnosis,
                diagnosis,
                search_location,
                property_address,
                branch_search_intents,
            )
        submit_phase("cost", cost_estimation_diy_from_library, cost_q)

        for fut in as_completed(future_map):
            name = future_map[fut]
            t_submit = submit_at[fut]
            try:
                result = fut.result()
            except Exception as exc:
                logger.exception(
                    "DIY orchestrator phase=%s failed (%s: %s)",
                    name,
                    type(exc).__name__,
                    exc,
                )
                continue
            dur_ms = int((time.monotonic() - t_submit) * 1000)
            if name == "youtube":
                vcount = len(result) if isinstance(result, list) else 0
                full_yt = (
                    json.dumps(result, ensure_ascii=False)
                    if isinstance(result, list)
                    else repr(result)
                )
                logger.debug(
                    "DIY orchestrator phase=youtube duration_ms=%d videos=%d full_results=%s",
                    dur_ms,
                    vcount,
                    full_yt,
                )
                logger.info(
                    "DIY orchestrator phase=youtube duration_ms=%d videos=%d",
                    dur_ms,
                    vcount,
                )
            elif name == "products":
                pj = result if isinstance(result, str) else ""
                logger.debug(
                    "DIY orchestrator phase=products duration_ms=%d %s full_json=%s",
                    dur_ms,
                    _product_recommendations_log_summary(pj),
                    pj if (pj or "").strip() else "(empty)",
                )
                logger.info(
                    "DIY orchestrator phase=products duration_ms=%d %s",
                    dur_ms,
                    _product_recommendations_log_summary(pj),
                )
            else:
                logger.info(
                    "DIY orchestrator phase=%s duration_ms=%d",
                    name,
                    dur_ms,
                )
            if name == "web" and isinstance(result, str):
                web_text = result
            elif name == "youtube" and isinstance(result, list):
                yt = result
            elif name == "products" and isinstance(result, str):
                products_raw = result
            elif name == "cost" and isinstance(result, str):
                cost_raw = result

    prefetch_ms = int((time.monotonic() - t0) * 1000)
    logger.info(
        "DIY orchestrator: prefetch_parallel_done wall_ms=%d "
        "(web+youtube+products+cost thread pool complete)",
        prefetch_ms,
    )

    if not cost_raw:
        cost_raw = cost_estimation_diy_from_library(cost_q)
    if not isinstance(products_raw, str):
        products_raw = json.dumps({"recommendedProducts": {}})

    t_syn = time.monotonic()
    merged = _synthesize_diy_json(
        diagnosis,
        web_text,
        yt,
        products_raw,
        cost_raw,
        retrieval_search_query=api_seed or checkpoint_retrieval_search_query,
    )
    syn_ms = int((time.monotonic() - t_syn) * 1000)

    logger.info(
        "DIY orchestrator phase=steps_synthesis duration_ms=%d",
        syn_ms,
    )
    logger.info(
        "DIY orchestrator total_duration_ms=%d prefetch_ms=%d synthesis_ms=%d "
        "diagnosis_chars=%d",
        int((time.monotonic() - t0) * 1000),
        prefetch_ms,
        syn_ms,
        len(diagnosis),
    )

    if ttl > 0:
        with _CACHE_LOCK:
            _DIY_CACHE[ck] = (time.time(), merged)
            _prune_cache_unlocked()

    return merged


async def run_diy_pipeline(
    user_query: str,
    property_address: Optional[str] = None,
    search_location: Optional[SearchLocation] = None,
    context_doc_uris: Optional[list[str]] = None,
    checkpoint_retrieval_search_query: Optional[str] = None,
    prefetched_web_summary: Optional[str] = None,
    branch_search_intents: Optional[BranchSearchIntents] = None,
) -> str:
    """Async ADK tool entrypoint; heavy sync pipeline runs in a worker thread."""
    logger.debug(
        "DIY run_diy_pipeline async entry user_query_len=%d address_set=%s "
        "checkpoint_retrieval_seed=%s context_doc_uris=%d",
        len((user_query or "").strip()),
        bool(market_label(search_location) or (property_address or "").strip()),
        checkpoint_retrieval_search_query is not None,
        len(context_doc_uris or []),
    )
    return await to_thread(
        run_diy_pipeline_sync,
        user_query,
        property_address,
        search_location,
        context_doc_uris,
        checkpoint_retrieval_search_query,
        prefetched_web_summary,
        branch_search_intents,
    )
