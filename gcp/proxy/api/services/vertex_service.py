import os
import logging
import re
import time
import vertexai
from vertexai import agent_engines
from vertexai.agent_engines import AgentEngine
from typing import Optional, Dict, Any, List, Callable, Mapping
import json
from google.cloud import pubsub_v1
from google.cloud import firestore
from google.cloud.firestore_v1 import FieldFilter

from schemas.agent import AgentRequest
from services.token_usage_service import (
    accumulate_usage_from_stream_event,
    persist_user_token_usage,
)
from services.stream_persist_throttle import StreamPersistThrottle
from utils.agent_steps_state import complete_pending_specialists, merge_step_update
from utils.message_content_persist import (
    apply_message_patch_from_state_delta,
    finalize_assistant_message,
    fence_chars_removed,
)
from utils.message_patch_state import (
    constrain_content_json_size,
    validate_assistant_message_patch,
    build_assistant_message_patch,
    is_stale_revision,
    next_revision,
    normalize_revision,
)
from utils.message_patch_metrics import (
    StreamPatchTracker,
    record_fence_strip,
    record_patch_apply,
    record_stale_revision_reject,
    record_ttf_structured_patch_ms,
)
from common.observability.logging_context import (
    get_correlation_id,
    pubsub_payload_with_correlation,
)
from common.token import TokenQuotaExceeded, check_token_quota_or_raise
from common.lifecycle.events import (
    PHASE_PROXY_ENGINE_INVOKE,
    PHASE_PROXY_REQUEST_ACCEPTED,
    build_lifecycle_payload,
    extract_lifecycle_payload,
    is_lifecycle_stream_event,
    log_lifecycle_payload,
)
 
# Configure logging
logger = logging.getLogger(__name__)

# Router/orchestrator agents — one stable user-facing label (see agent-display.ts).
_COORDINATING_AGENTS = {
    "property_agent",
}

_COORDINATING_LABEL = "Understanding your request…"

_DEFAULT_DISPLAY_LABEL = "Working on it…"
_MAX_CONTENT_JSON_BYTES = int(os.environ.get("MAX_CONTENT_JSON_BYTES", "200000"))

def _reasoning_payload_summary(payload: Dict[str, Any]) -> str:
    uq = payload.get("user_query") or ""
    prev = uq[:120] + ("…" if len(uq) > 120 else "")
    return (
        f"user_query_len={len(uq)} user_query_preview={prev!r} "
        f"context_doc_uris={len(payload.get('context_doc_uris') or [])} "
        f"checkpoint_ids={len(payload.get('checkpoint_ids') or [])} "
        f"has_property_id={bool(payload.get('property_id'))} "
        f"primary_agent={payload.get('primary_agent')!r} "
        f"chip_action={payload.get('chip_action')!r} "
        f"search_location_source={((payload.get('search_location') or {}).get('source'))!r}"
    )


_DISPLAY_NAME_MAP = {
    "diagnostic_agent": "Diagnosing the issue…",
    "user_docs_retrieval": "Searching your documents…",
    "analyse_multimodal_data": "Reviewing your photo or video…",
    "research_agent": "Researching options…",
    "service_provider_agent": "Finding pros near you…",
    "service_agent": "Finding pros near you…",
    "product_recommendations_agent": "Finding recommended products…",
    "shopping_agent": "Finding recommended products…",
    "cost_estimation_agent": "Estimating repair costs…",
    "cost_agent": "Estimating repair costs…",
    "coverage_agent": "Checking warranty & insurance…",
    "diy_agent": "Building DIY steps…",
    "run_checkpoint_pipeline": "Loading your checkpoints…",
    "report_retrieval": "Reading your saved report…",
    # Legacy stream authors (pre-V2 ADK workflow); not root tools — see property_agent/ARCHITECTURE.md
    "checkpoint_analysis_agent": "Analyzing your checkpoints…",
    "checkpoint_analysis_synthesis_agent": "Writing your summary…",
    "checkpoint_optional_agents_parallel_runner": "Finishing your analysis…",
    "checkpoint_analysis_progress": "Updating your analysis…",
    "agent_stream": "Almost done…",
    "agent_response": "Done",
}

_CHECKPOINT_ROLLUP_TOOLS = {
    "run_checkpoint_pipeline",
    "checkpoint_analysis_agent",
}

_CHECKPOINT_PROGRESS_AUTHORS = {
    "checkpoint_analysis_progress",
    "checkpoint_optional_agents_parallel_runner",
}


def _proxy_lifecycle_elapsed_ms(stream_started_at: float) -> int:
    return int((time.monotonic() - stream_started_at) * 1000)


def _agent_lifecycle_firestore_doc(payload: Mapping[str, Any]) -> dict[str, Any]:
    """Persisted subset of lifecycle payload (UI strip only)."""
    doc: dict[str, Any] = {
        "phase": str(payload.get("phase") or ""),
        "message": str(payload.get("message") or ""),
    }
    ts = payload.get("ts")
    if isinstance(ts, str) and ts.strip():
        doc["ts"] = ts.strip()
    return doc


def _persist_agent_lifecycle_to_message(
    assistant_message_ref: Any,
    payload: Mapping[str, Any],
) -> None:
    if assistant_message_ref is None:
        return
    log_lifecycle_payload(payload)
    try:
        assistant_message_ref.set(
            {
                "agentLifecycle": _agent_lifecycle_firestore_doc(payload),
                "updatedAt": firestore.SERVER_TIMESTAMP,
            },
            merge=True,
        )
    except Exception as exc:
        logger.warning("Failed to persist agentLifecycle: %s", exc, exc_info=True)


def _persist_proxy_lifecycle(
    *,
    phase: str,
    stream_started_at: float,
    correlation_id: Optional[str],
    session_id: Optional[str],
    primary_agent: Optional[str],
    checkpoint_ids: Optional[List[str]],
    checkpoint_optional_agents: Optional[List[str]],
    context_doc_uris: Optional[List[str]],
    assistant_message_ref: Any,
    agent_steps_by_name: Mapping[str, Any],
) -> None:
    if assistant_message_ref is None or agent_steps_by_name:
        return
    payload = build_lifecycle_payload(
        phase,
        elapsed_ms=_proxy_lifecycle_elapsed_ms(stream_started_at),
        correlation_id=correlation_id,
        session_id=session_id,
        primary_agent=primary_agent,
        checkpoint_ids=checkpoint_ids,
        checkpoint_optional_agents=checkpoint_optional_agents,
        context_doc_uris=context_doc_uris,
    )
    _persist_agent_lifecycle_to_message(assistant_message_ref, payload)

# Authors that emit full checkpoint snapshots — replace, never append.
_CHECKPOINT_CONTENT_REPLACE_AUTHORS = _CHECKPOINT_PROGRESS_AUTHORS | {
    "checkpoint_analysis_synthesis_agent",
}

_CHECKPOINT_OPTIONAL_AGENT_BY_KEY = {
    "coverage": "coverage_agent",
    "diy": "diy_agent",
    "service": "service_agent",
    "cost": "cost_agent",
}

_CHECKPOINT_OPTIONAL_AGENT_NAMES = set(_CHECKPOINT_OPTIONAL_AGENT_BY_KEY.values())

def _display_name_for(name: str) -> str:
    """Resolve a friendly label for an agent/tool name (mirrors agent-display.ts)."""
    if not name:
        return ""
    if name in _COORDINATING_AGENTS:
        return _COORDINATING_LABEL
    mapped = _DISPLAY_NAME_MAP.get(name)
    if mapped:
        return mapped
    return _DEFAULT_DISPLAY_LABEL

# --- Environment Variables ---
GCP_PROJECT_ID = os.environ.get("GCP_PROJECT_ID")
GCP_REGION = os.environ.get("GCP_REGION")
REASONING_ENGINE_ID = os.environ.get("REASONING_ENGINE_ID")


# --- Vertex AI Reasoning Engine Client (Global) ---
reasoning_engine_resource:AgentEngine = None
try:
    if GCP_PROJECT_ID and GCP_REGION and REASONING_ENGINE_ID:
        vertexai.init(project=GCP_PROJECT_ID, location=GCP_REGION)
        reasoning_engine_resource = agent_engines.get(REASONING_ENGINE_ID)
        logger.info(f"Vertex AI Reasoning Engine client initialized for: {REASONING_ENGINE_ID}")
    else:
        logger.warning("Missing GCP_PROJECT_ID, GCP_REGION, or REASONING_ENGINE_ID. Vertex AI client or Session Service not initialized.")
except Exception as e:
    logger.error(f"Failed to initialize Vertex AI client or Session Service: {e}", exc_info=True)
    reasoning_engine_resource = None

def publish_doc_to_secure_store(
    gcs_urls: list[str],
    user_query: str,
    user_id: str,
    context_doc_ids: list[str] | None = None,
) -> dict:
    """Publishes a structured payload to a secure storage."""
    try:
        publisher = pubsub_v1.PublisherClient()
        
        topic_path = publisher.topic_path(os.environ.get("GCP_PROJECT_ID"), os.environ.get("USER_UPLOAD_TOPIC")) # Assuming only topic name, or pass full path
        payload = pubsub_payload_with_correlation({
            "gcs_urls": gcs_urls,
            "user_id": user_id,
            "user_query": user_query,
            "source": "rag-file-upload",
            "context_doc_ids": context_doc_ids or [],
        })
        data = json.dumps(payload).encode("utf-8")
        future = publisher.publish(topic_path, data)
        return "Data published to Pub/Sub successfully with ID: {}".format(future.result())
    except Exception as e:
        logger.exception("Failed to publish data to Pub/Sub (rag-file-upload): %s", e)
        return {"error": str(e)}  

# --- Property ID Retrieval from Firestore Session ---
def get_property_id_from_session_by_agent_id(user_id: str, agent_session_id: str) -> Optional[str]:
    """
    Retrieves property_id from Firestore session document by querying for agentSessionId.
    
    Option 2: Retrieve property_id from session metadata stored in Firestore.
    Session documents are stored at: users/{user_id}/chats/{session_id}
    and have an agentSessionId field that matches the Vertex AI agent session ID.
    
    Args:
        user_id: User ID
        agent_session_id: Vertex AI agent session ID (used to find Firestore session document)
        
    Returns:
        property_id if found in session document, None otherwise
    """
    try:
        db = firestore.Client()
        # Query Firestore sessions collection to find document with matching agentSessionId
        chats_ref = db.collection("users").document(user_id).collection("chats")
        query = chats_ref.where(
            filter=FieldFilter("agentSessionId", "==", agent_session_id)
        ).limit(1)
        docs = query.stream()
        
        for doc in docs:
            session_data = doc.to_dict()
            property_id = session_data.get("propertyId") or session_data.get("property_id")
            if property_id:
                logger.debug(f"Found property_id '{property_id}' in Firestore session document")
                return property_id
            else:
                logger.debug(f"No property_id found in Firestore session document")
                return None
        
        logger.debug(f"No Firestore session document found with agentSessionId: {agent_session_id}")
        return None
    except Exception as e:
        logger.debug(f"Error retrieving property_id from Firestore session (non-critical): {e}")
        return None


def get_chat_id_from_session_by_agent_id(user_id: str, agent_session_id: str) -> Optional[str]:
    """
    Retrieves Firestore chat document ID by matching agentSessionId.
    Session documents are stored at: users/{user_id}/chats/{chat_id}
    """
    try:
        db = firestore.Client()
        chats_ref = db.collection("users").document(user_id).collection("chats")
        query = chats_ref.where(
            filter=FieldFilter("agentSessionId", "==", agent_session_id)
        ).limit(1)
        docs = query.stream()
        for doc in docs:
            return doc.id
        return None
    except Exception as e:
        logger.debug(f"Error retrieving chat_id from Firestore session (non-critical): {e}")
        return None


_CHECKPOINT_BRANCH_COMPLETED_STATE_KEY = "checkpoint_branch_completed"


def _event_state_delta(event: Dict[str, Any]) -> Dict[str, Any]:
    actions = event.get("actions")
    if not isinstance(actions, dict):
        return {}
    delta = actions.get("state_delta") or actions.get("stateDelta")
    return delta if isinstance(delta, dict) else {}


def _checkpoint_progress_display_text(event: Dict[str, Any], event_text: str) -> str:
    delta = _event_state_delta(event)
    patch_md = delta.get("contentMarkdown")
    if isinstance(patch_md, str) and patch_md.strip():
        return patch_md
    return event_text


def _should_replace_assistant_content(event: Dict[str, Any], event_text: str) -> bool:
    _ = event_text
    author = event.get("author")
    return isinstance(author, str) and author in _CHECKPOINT_CONTENT_REPLACE_AUTHORS


def _strip_user_query_echoes(content: str, user_query: str) -> str:
    """Remove echoed user_query lines duplicated in model output."""
    content = (content or "").strip()
    uq = (user_query or "").strip()
    if not content or not uq:
        return content
    if content == uq:
        return ""
    if content.startswith(uq + "\n"):
        content = content[len(uq) + 1 :].lstrip()
    elif content.startswith(uq + "\n\n"):
        content = content[len(uq) + 2 :].lstrip()
    lines = content.splitlines()
    filtered = [line for line in lines if line.strip() != uq]
    return "\n".join(filtered).strip()


def _normalize_assistant_content_for_persist(
    content: str,
    user_query: str,
    *,
    agent_steps_by_name: Optional[Dict[str, Dict[str, Any]]] = None,
    optional_agent_keys: Optional[List[str]] = None,
    finalize: bool = False,
    prose_only_persist: bool = False,
) -> str:
    _ = (agent_steps_by_name, optional_agent_keys, finalize)
    normalized = _strip_user_query_echoes(content, user_query)
    if prose_only_persist:
        from utils.message_content_persist import _strip_json_fences

        normalized = _strip_json_fences(normalized)
    return normalized


def _has_structured_message_patch(message_content_patch: Dict[str, Any]) -> bool:
    if not message_content_patch:
        return False
    if isinstance(message_content_patch.get("contentJson"), dict):
        return True
    if isinstance(message_content_patch.get("contentMarkdown"), str):
        return True
    return False


def _resolve_assistant_message_fields_for_persist(
    *,
    assistant_content_accumulated: str,
    user_query: str,
    message_content_patch: Dict[str, Any],
    prose_only_persist: bool,
    finalize: bool,
    agent_steps_by_name: Optional[Dict[str, Dict[str, Any]]],
    optional_agent_keys: Optional[List[str]],
) -> tuple[str, str, Optional[Dict[str, Any]]]:
    """Return (persist_content, content_markdown, content_json)."""
    normalized_accumulated = _normalize_assistant_content_for_persist(
        assistant_content_accumulated,
        user_query,
        agent_steps_by_name=agent_steps_by_name,
        optional_agent_keys=optional_agent_keys,
        finalize=finalize,
        prose_only_persist=prose_only_persist,
    )

    if _has_structured_message_patch(message_content_patch):
        patch_markdown = message_content_patch.get("contentMarkdown")
        if not isinstance(patch_markdown, str) or not patch_markdown.strip():
            patch_markdown = normalized_accumulated
        elif normalized_accumulated.strip():
            patch_stripped = patch_markdown.strip()
            accum_stripped = normalized_accumulated.strip()
            # Checkpoint progress replaces accumulated text with the structured
            # summary; the executor appends its brief prose answer afterward.
            if accum_stripped != patch_stripped and accum_stripped.startswith(
                patch_stripped
            ):
                patch_markdown = normalized_accumulated
        patch_json = message_content_patch.get("contentJson")
        patch_json_dict = patch_json if isinstance(patch_json, dict) else None
        content_markdown, content_json = finalize_assistant_message(
            patch_markdown,
            patch_json_dict,
        )
    else:
        content_markdown, content_json = finalize_assistant_message(
            normalized_accumulated,
            None,
        )

    persist_content = content_markdown if prose_only_persist else normalized_accumulated
    return persist_content, content_markdown, content_json


def _coerce_result_to_dict(result: Any) -> Optional[Dict[str, Any]]:
    """Best-effort decode of a function_response.result payload to a dict.

    Sub-agents in this repo return data in three shapes that we need to
    tolerate:
      1. A plain dict (e.g. when ADK returned a structured result).
      2. A JSON string.
      3. A string containing one balanced JSON object.
    """
    if isinstance(result, dict):
        return result
    if not isinstance(result, str):
        return None
    s = result.strip()
    if not s:
        return None

    # 1. Try parsing the whole string as JSON.
    try:
        decoded = json.loads(s)
        if isinstance(decoded, dict):
            return decoded
    except Exception:
        pass

    # 2. Last resort: take the first balanced { ... } substring.
    first = s.find("{")
    last = s.rfind("}")
    if 0 <= first < last:
        try:
            decoded = json.loads(s[first : last + 1])
            if isinstance(decoded, dict):
                return decoded
        except Exception:
            pass

    return None


def _unwrap_analysis(data: Dict[str, Any]) -> Dict[str, Any]:
    """Many of our sub-agents nest payloads under an "analysis" key; this
    helper returns that inner object when present so the per-section formatters
    don't have to special-case it."""
    if isinstance(data, dict):
        inner = data.get("analysis")
        if isinstance(inner, dict):
            return inner
    return data


def _truncate(text: str, max_len: int = 80) -> str:
    text = (text or "").strip()
    if len(text) <= max_len:
        return text
    return text[: max_len - 1].rstrip() + "…"


def _coverage_preview(data: Dict[str, Any]) -> Optional[str]:
    root = _unwrap_analysis(data)
    coverage = (root.get("coverageResult") if isinstance(root, dict) else None) or root
    if not isinstance(coverage, dict):
        return None
    has_warranty = bool((coverage.get("warrantyInfo") or "").strip()) if isinstance(coverage.get("warrantyInfo"), str) else bool(coverage.get("warrantyInfo"))
    has_insurance = bool((coverage.get("insuranceInfo") or "").strip()) if isinstance(coverage.get("insuranceInfo"), str) else bool(coverage.get("insuranceInfo"))
    if has_warranty and has_insurance:
        return "Found warranty + insurance terms"
    if has_warranty:
        return "Found warranty terms"
    if has_insurance:
        return "Found insurance terms"
    return None


def _diy_preview(data: Dict[str, Any]) -> Optional[str]:
    # DIY agent may return {"hire_professional_recommended": ..., "diyResults": {...}}
    root = _unwrap_analysis(data)
    diy = (root.get("diyResults") if isinstance(root, dict) else None) or root
    if not isinstance(diy, dict):
        return None
    steps = (((diy.get("diySteps") or {}).get("steps")) or [])
    videos = (((diy.get("youtubeSearch") or {}).get("videos")) or [])
    products = (((diy.get("recommendedProducts") or {}).get("products")) or [])
    parts: List[str] = []
    if isinstance(steps, list) and len(steps) > 0:
        parts.append(f"{len(steps)} DIY step{'s' if len(steps) != 1 else ''}")
    if isinstance(videos, list) and len(videos) > 0:
        parts.append(f"{len(videos)} tutorial{'s' if len(videos) != 1 else ''}")
    if isinstance(products, list) and len(products) > 0:
        parts.append(f"{len(products)} product{'s' if len(products) != 1 else ''}")
    if data.get("hire_professional_recommended") or diy.get("hireProfessionalRecommended"):
        parts.append("pro recommended")
    return _truncate(" · ".join(parts)) if parts else None


def _service_preview(data: Dict[str, Any]) -> Optional[str]:
    root = _unwrap_analysis(data)
    service = (root.get("serviceResults") if isinstance(root, dict) else None) or root
    local_pros = (service.get("localPros") if isinstance(service, dict) else None) or {}
    total = 0
    # serpAPIResults / yelpAPIResults are real provider lists.
    # googleSearchResults are usually generic web links — count them only as a fallback.
    for key in ("serpAPIResults", "yelpAPIResults"):
        bucket = local_pros.get(key) if isinstance(local_pros, dict) else None
        if isinstance(bucket, list):
            total += len(bucket)
    if total == 0 and isinstance(local_pros, dict):
        bucket = local_pros.get("googleSearchResults")
        if isinstance(bucket, list):
            total += len(bucket)
    if total == 0 and isinstance(service, dict):
        for fallback in ("providers", "localProviders", "nearbyProviders", "results"):
            bucket = service.get(fallback)
            if isinstance(bucket, list):
                total += len(bucket)
    if total <= 0:
        return None
    return f"Found {total} local pro{'s' if total != 1 else ''}"


def _cost_preview(data: Dict[str, Any]) -> Optional[str]:
    root = _unwrap_analysis(data)
    cost = (root.get("costEstimationResults") if isinstance(root, dict) else None) or root
    if isinstance(cost, dict):
        estimates = cost.get("costEstimates") or cost
    else:
        estimates = None
    if not isinstance(estimates, dict):
        return None
    diy_range = ((estimates.get("DIY") or {}).get("cost_range"))
    pro_range = ((estimates.get("Service") or {}).get("cost_range"))
    pieces: List[str] = []
    if isinstance(diy_range, str) and diy_range.strip():
        pieces.append(f"DIY {diy_range.strip()}")
    if isinstance(pro_range, str) and pro_range.strip():
        pieces.append(f"Pro {pro_range.strip()}")
    if not pieces:
        return None
    return _truncate(" · ".join(pieces))


def _checkpoint_preview(data: Dict[str, Any]) -> Optional[str]:
    root = _unwrap_analysis(data)
    if not isinstance(root, dict):
        return None
    # Primary signal: a numeric checkpointsAnalyzed under checkpointSummary.
    summary = root.get("checkpointSummary")
    if isinstance(summary, dict):
        count = summary.get("checkpointsAnalyzed")
        if isinstance(count, (int, float)) and count:
            return f"Reviewed {int(count)} checkpoint{'s' if int(count) != 1 else ''}"
    checkpoints = root.get("checkpoints") or root.get("checkpointDetails")
    if isinstance(checkpoints, list) and checkpoints:
        return f"Reviewed {len(checkpoints)} checkpoint{'s' if len(checkpoints) != 1 else ''}"
    # Fallback: if run_checkpoint_pipeline rolled up coverage / service into its result,
    # surface that instead so the row isn't blank.
    for fallback in (_service_preview, _coverage_preview):
        try:
            preview = fallback(data)
        except Exception:
            preview = None
        if preview:
            return preview
    return None


def _docs_preview(data: Dict[str, Any]) -> Optional[str]:
    # user_docs outputs vary; surface a coarse signal.
    root = _unwrap_analysis(data)
    if isinstance(root, dict):
        for key in ("documents", "results", "matches", "snippets", "passages"):
            bucket = root.get(key)
            if isinstance(bucket, list) and bucket:
                return f"Pulled {len(bucket)} reference{'s' if len(bucket) != 1 else ''}"
        text = root.get("text")
        if isinstance(text, str) and text.strip():
            return _truncate(text.replace("\n", " "), max_len=80)
    return None


_PREVIEW_FORMATTERS: Dict[str, Callable[[Dict[str, Any]], Optional[str]]] = {
    "coverage_agent": _coverage_preview,
    "diy_agent": _diy_preview,
    "service_agent": _service_preview,
    "service_provider_agent": _service_preview,
    "cost_agent": _cost_preview,
    "cost_estimation_agent": _cost_preview,
    "run_checkpoint_pipeline": _checkpoint_preview,
    "checkpoint_analysis_agent": _checkpoint_preview,
    "user_docs_retrieval": _docs_preview,
}


def _preview_for_response(tool_name: str, response_payload: Any) -> Optional[str]:
    """Format a one-line preview from a sub-agent's function_response result."""
    formatter = _PREVIEW_FORMATTERS.get(tool_name)
    if not formatter:
        return None
    # function_response.response is typically a dict; result lives at "result".
    candidates: List[Any] = []
    if isinstance(response_payload, dict):
        if "result" in response_payload:
            candidates.append(response_payload.get("result"))
        candidates.append(response_payload)
    else:
        candidates.append(response_payload)
    for candidate in candidates:
        data = _coerce_result_to_dict(candidate)
        if not data:
            continue
        try:
            preview = formatter(data)
        except Exception:
            logger.debug("Preview formatter %s raised; skipping preview", tool_name, exc_info=True)
            preview = None
        if preview:
            return _truncate(preview)
    return None


def _step_update(
    name: str,
    status: str,
    preview: Optional[str] = None,
) -> Dict[str, Any]:
    step: Dict[str, Any] = {
        "name": name,
        "status": status,
        "displayName": _display_name_for(name),
    }
    if preview:
        step["preview"] = preview
    return step


def _extract_checkpoint_optional_agent_names(args: Any) -> List[str]:
    if not isinstance(args, dict):
        return []
    requested = args.get("checkpoint_optional_agents") or []
    if not isinstance(requested, list):
        return []
    agent_names: List[str] = []
    for key in requested:
        if not isinstance(key, str):
            continue
        agent_name = _CHECKPOINT_OPTIONAL_AGENT_BY_KEY.get(key)
        if agent_name:
            agent_names.append(agent_name)
    return agent_names


def _checkpoint_optional_completed_steps(response_payload: Any) -> List[Dict[str, Any]]:
    data: Optional[Dict[str, Any]] = None
    if isinstance(response_payload, dict):
        data = _coerce_result_to_dict(response_payload.get("result"))
        if not data:
            data = _coerce_result_to_dict(response_payload)
    else:
        data = _coerce_result_to_dict(response_payload)
    if not data:
        return []

    root = _unwrap_analysis(data)
    if not isinstance(root, dict):
        return []

    section_by_agent = {
        "coverage_agent": "coverageResult",
        "diy_agent": "diyResults",
        "service_agent": "serviceResults",
        "cost_agent": "costEstimationResults",
    }
    updates: List[Dict[str, Any]] = []
    for agent_name, section_key in section_by_agent.items():
        if section_key not in root:
            continue
        preview = _preview_for_response(agent_name, response_payload)
        updates.append(_step_update(agent_name, "completed", preview=preview))
    return updates


def _progressive_checkpoint_step_updates_from_state_delta(
    event: Dict[str, Any],
) -> List[Dict[str, Any]]:
    """Mark optional specialist rows completed when branch name is on the event delta."""
    delta = _event_state_delta(event)
    branch = delta.get(_CHECKPOINT_BRANCH_COMPLETED_STATE_KEY)
    if not isinstance(branch, str) or not branch.strip():
        return []
    agent_name = _CHECKPOINT_OPTIONAL_AGENT_BY_KEY.get(branch.strip())
    if not agent_name:
        return []
    return [_step_update(agent_name, "completed")]


def _synthesis_step_updates_from_state_delta(
    event: Dict[str, Any],
) -> List[Dict[str, Any]]:
    """Reflect ``analysisStatus.synthesis`` as a first-class agentSteps row."""
    status = _analysis_status_from_delta(_event_state_delta(event))
    if not status:
        return []
    phase = status.get("synthesis")
    if phase == "running":
        return [_step_update("checkpoint_analysis_synthesis_agent", "executing")]
    if phase == "completed":
        return [_step_update("checkpoint_analysis_synthesis_agent", "completed")]
    return []


def _is_checkpoint_progress_event(event: Dict[str, Any], event_text: str) -> bool:
    if not event_text:
        return False
    author = event.get("author")
    return isinstance(author, str) and author in _CHECKPOINT_PROGRESS_AUTHORS


def _stream_event_kind(event: Dict[str, Any]) -> str:
    """Compact event classification for logs (avoids dumping full stream payloads)."""
    parts = event.get("content", {}).get("parts", []) or []
    for part in parts:
        if not isinstance(part, dict):
            continue
        function_call = part.get("function_call")
        if isinstance(function_call, dict):
            name = function_call.get("name") or "?"
            return f"function_call:{name}"
        function_response = part.get("function_response")
        if isinstance(function_response, dict):
            name = function_response.get("name") or "?"
            return f"function_response:{name}"
    author = event.get("author")
    if isinstance(author, str) and author == "homeapp_lifecycle":
        return "lifecycle"
    if isinstance(author, str) and author in _CHECKPOINT_PROGRESS_AUTHORS:
        return "checkpoint_progress"
    for part in parts:
        if isinstance(part, dict) and isinstance(part.get("text"), str) and part["text"]:
            return "text"
    return "other"


def _analysis_status_from_delta(delta: Dict[str, Any]) -> Optional[Dict[str, str]]:
    for container_key in ("checkpoint_analysis", "contentJson"):
        container = delta.get(container_key)
        if not isinstance(container, dict):
            continue
        analysis = container.get("analysis")
        if not isinstance(analysis, dict):
            continue
        status = analysis.get("analysisStatus")
        if isinstance(status, dict):
            return {
                str(key): str(value)
                for key, value in status.items()
                if key in _CHECKPOINT_OPTIONAL_AGENT_BY_KEY or key == "synthesis"
            }
    return None


def stream_event_log_summary(event: Dict[str, Any]) -> Dict[str, Any]:
    """Small dict for INFO/DEBUG stream logs (full events stay at DEBUG elsewhere)."""
    delta = _event_state_delta(event)
    text = extract_text_from_event(event)
    return {
        "author": event.get("author"),
        "invocation_id": event.get("invocation_id"),
        "kind": _stream_event_kind(event),
        "text_chars": len(text),
        "delta_keys": sorted(delta.keys())[:16],
        "branch_completed": delta.get(_CHECKPOINT_BRANCH_COMPLETED_STATE_KEY),
        "analysis_status": _analysis_status_from_delta(delta),
        "has_content_json": "contentJson" in delta,
        "has_content_markdown": bool(
            isinstance(delta.get("contentMarkdown"), str) and delta["contentMarkdown"].strip()
        ),
    }


def _step_updates_log_slice(
    step_updates: List[Dict[str, Any]],
) -> List[Dict[str, Optional[str]]]:
    return [
        {
            "name": step.get("name"),
            "status": step.get("status"),
            "preview": (step.get("preview") or "")[:80] or None,
        }
        for step in step_updates
    ]


def extract_agent_step_updates_from_event(event: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Extract agent step updates in the same shape used by mapp/webapp messages.

    A single checkpoint rollup event can synthesize multiple specialist rows
    (coverage/diy/service/cost) because those sub-agents run behind AgentTool
    and do not emit their own events to the parent Reasoning Engine stream.
    """
    parts = event.get("content", {}).get("parts", [])
    for part in parts:
        if not isinstance(part, dict):
            continue
        function_call = part.get("function_call")
        if isinstance(function_call, dict):
            tool_name = function_call.get("name")
            if tool_name:
                tool_name_str = str(tool_name)
                # Only the rollup tool is "executing" here; optional specialists
                # get agentSteps rows from progressive checkpoint_analysis_progress
                # events (completed per branch) so the UI is not biased to cost_agent.
                return [_step_update(tool_name_str, "executing")]

        function_response = part.get("function_response")
        if isinstance(function_response, dict):
            tool_name = function_response.get("name")
            if tool_name:
                tool_name_str = str(tool_name)
                preview = _preview_for_response(
                    tool_name_str, function_response.get("response")
                )
                updates = [_step_update(tool_name_str, "completed", preview=preview)]
                if tool_name_str in _CHECKPOINT_ROLLUP_TOOLS:
                    updates.extend(
                        _checkpoint_optional_completed_steps(
                            function_response.get("response")
                        )
                    )
                return updates
    return []


def extract_text_from_event(event: Dict[str, Any]) -> str:
    """Extract concatenated text parts from a single stream event."""
    text_parts: List[str] = []
    for part in event.get("content", {}).get("parts", []):
        if isinstance(part, dict) and isinstance(part.get("text"), str) and part["text"]:
            text_parts.append(part["text"])
    return "".join(text_parts)


# --- Reasoning Engine Session Management Functions ---
def get_or_create_reasoning_engine_session(chat_id: str) -> Dict[str, Any]:
    if not reasoning_engine_resource:
        logger.error("Reasoning Engine not initialized. Cannot manage sessions.")
        raise RuntimeError("AI Agent service not ready.")
    sessionsObj = reasoning_engine_resource.list_sessions(user_id=chat_id)
    sessions = sessionsObj.get("sessions", [])
    session = None
    if not sessions:
        logger.info(f"No sessions found for user_id {chat_id}, creating new session.")
        session = reasoning_engine_resource.create_session(user_id=chat_id)
    else:
        session = sessions[-1]
    return session

def create_reasoning_engine_session(user_id: str) -> Dict[str, Any]:
    if not reasoning_engine_resource:
        raise RuntimeError("AI Agent service not ready.")
    check_token_quota_or_raise(firestore.Client(), user_id)
    session = reasoning_engine_resource.create_session(user_id=user_id)
    return session

def delete_reasoning_engine_session(user_id: str, session_id: str):
    reasoning_engine_resource.delete_session(user_id=user_id, session_id=session_id)


def build_reasoning_engine_payload(
    request: AgentRequest,
    *,
    property_id: Optional[str] = None,
    resolved_search_location: Optional[Any] = None,
    correlation_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Build the stream_query message payload from the validated agent request."""
    payload: Dict[str, Any] = {"user_query": request.user_query}

    if request.user_id:
        payload["user_id"] = request.user_id

    if request.context_doc_uris:
        payload["context_doc_uris"] = request.context_doc_uris

    # Include checkpoint_ids if provided (context for run_checkpoint_pipeline)
    checkpoint_ids = request.checkpoint_ids
    if checkpoint_ids:
        payload["checkpoint_ids"] = checkpoint_ids
        logger.info(f"Including checkpoint_ids in agent payload: {checkpoint_ids} (count: {len(checkpoint_ids)})")
    else:
        logger.debug("No checkpoint_ids to include in agent payload")

    if request.report_ids:
        payload["report_ids"] = request.report_ids
        logger.info("Including report_ids in agent payload: %s", request.report_ids)
    if request.report_revisions:
        payload["report_revisions"] = request.report_revisions
        logger.info("Including report_revisions in agent payload: %s", request.report_revisions)

    # Include property_id if available (for checkpoint queries, etc.)
    if property_id:
        logger.info(f"Including property_id in agent payload: {property_id}")
        payload["property_id"] = property_id

    # Include primary_agent if provided (for explicit routing)
    if request.primary_agent:
        payload["primary_agent"] = request.primary_agent
        logger.info(f"Including primary_agent in agent payload: {request.primary_agent}")

    # Include checkpoint_optional_agents if provided
    checkpoint_optional_agents = request.checkpoint_optional_agents or []
    if checkpoint_optional_agents:
        payload["checkpoint_optional_agents"] = checkpoint_optional_agents
        logger.info(f"Including checkpoint_optional_agents in payload: {checkpoint_optional_agents}")

    if request.chat_intent:
        payload["chat_intent"] = request.chat_intent
        logger.info("Including chat_intent in payload: %s", request.chat_intent)

    if request.chip_action is not None:
        payload["chip_action"] = request.chip_action.model_dump(exclude_none=True)
        logger.info("Including chip_action in payload: %s", payload["chip_action"])

    # property_address: identity/context only (which property, docs)
    if request.property_address:
        payload["property_address"] = request.property_address

    # search_location: single source of truth for market/geo (service, cost, diy, etc.)
    if resolved_search_location is not None:
        payload["search_location"] = resolved_search_location.to_agent_dict()
        logger.info(
            "Including search_location source=%s radius_miles=%s coords=%s,%s",
            resolved_search_location.source,
            resolved_search_location.radius_miles,
            resolved_search_location.coordinates.lat,
            resolved_search_location.coordinates.lng,
        )

    if correlation_id:
        payload["correlation_id"] = correlation_id
    return payload


async def stream_agent_answers(
    request: AgentRequest,
    parse_response: Optional[bool] = True
):
    if not reasoning_engine_resource:
        yield "Sorry, my AI brain is not connected right now. Please try again later."
        return
    user_id = request.user_id
    session_id = request.session_id

    if user_id:
        try:
            check_token_quota_or_raise(firestore.Client(), user_id)
        except TokenQuotaExceeded as e:
            err = {
                "status": "error",
                "code": "TOKEN_QUOTA_EXCEEDED",
                "message": "Monthly AI token limit reached. Usage resets at the start of next month.",
                "used": e.used,
                "limit": e.limit,
                "period": e.period_key,
            }
            if parse_response:
                yield json.dumps(err)
            else:
                yield {"proxy_error": err}
            return
    user_query = request.user_query
    context_doc_uris = request.context_doc_uris
    checkpoint_ids = request.checkpoint_ids  # Checkpoint IDs for checkpoint context
    report_ids = request.report_ids
    report_revisions = request.report_revisions
    if checkpoint_ids:
        logger.info(f"Received checkpoint_ids in request: {checkpoint_ids} (count: {len(checkpoint_ids)})")
    else:
        logger.debug("No checkpoint_ids provided in request")
    if report_ids:
        logger.info("Received report_ids in request: %s (count: %d)", report_ids, len(report_ids))
    property_address = request.property_address
    property_id = request.property_id  # Option 1: property_id from request
    primary_agent = request.primary_agent  # Primary agent selection for explicit routing
    checkpoint_optional_agents = request.checkpoint_optional_agents or []
    prose_only_persist = True
    logger.info(
        "stream_query prose_only_persist enabled session_id=%s",
        session_id,
    )
    from common.search_location import SearchLocationInput, resolve_search_location
    from common.search_location.models import SearchLocationCoordinates
    from common.search_location.resolve import parse_search_location_input

    search_location_input: Optional[SearchLocationInput] = None
    if request.search_location is not None:
        sl = request.search_location
        coords = None
        if sl.coordinates is not None:
            coords = SearchLocationCoordinates(lat=sl.coordinates.lat, lng=sl.coordinates.lng)
        search_location_input = SearchLocationInput(
            source=sl.source,
            radius_miles=sl.radius_miles,
            coordinates=coords,
        )
    elif request.location_type or request.location_coordinates:
        search_location_input = parse_search_location_input(
            {
                "source": "device_gps" if request.location_type == "location" else "property_address",
                "radius_miles": request.location_radius,
                "coordinates": request.location_coordinates,
            }
        )

    resolved_search_location = await resolve_search_location(
        property_address=property_address or None,
        search_location_input=search_location_input,
        location_type=request.location_type,
        location_coordinates=request.location_coordinates,
        location_radius=request.location_radius,
    )

    if not session_id:
        logger.info('Session ID not found. trying to create a new one')
        session = get_or_create_reasoning_engine_session(user_id)
        if not session:
            yield "Sorry, I couldn't create an active session. Please try again later."
            return
        session_id = session["id"]
        logger.info(f"Using session ID: {session_id}")
    
    # Option 2: Try to retrieve property_id from Firestore session if not provided in request
    # Note: This requires finding the Firestore session document. We try to find it by agentSessionId.
    if not property_id and session_id and user_id:
        try:
            property_id_from_session = get_property_id_from_session_by_agent_id(user_id, session_id)
            if property_id_from_session:
                property_id = property_id_from_session
                logger.info(f"Retrieved property_id from Firestore session: {property_id}")
        except Exception as e:
            logger.debug(f"Could not retrieve property_id from Firestore session (this is optional): {e}")
    
    correlation_id = get_correlation_id()
    payload = build_reasoning_engine_payload(
        request,
        property_id=property_id,
        resolved_search_location=resolved_search_location,
        correlation_id=correlation_id,
    )

    stream_started_at = time.monotonic()
    _lifecycle_kwargs = {
        "stream_started_at": stream_started_at,
        "correlation_id": correlation_id,
        "session_id": session_id,
        "primary_agent": primary_agent,
        "checkpoint_ids": checkpoint_ids,
        "checkpoint_optional_agents": checkpoint_optional_agents,
        "context_doc_uris": context_doc_uris,
    }

    message = json.dumps(payload)
    logger.info(
        "Reasoning Engine stream_query start session_id=%s correlation_id=%s message_bytes=%s %s",
        session_id,
        correlation_id or "-",
        len(message.encode("utf-8")),
        _reasoning_payload_summary(payload),
    )
    logger.debug("Reasoning Engine stream_query message_json=%s", message)
    usage_running = {"prompt": 0, "candidates": 0, "total_only": 0}
    stream_event_count = 0
    stream_failed = False
    db_client: Optional[firestore.Client] = None
    chat_id: Optional[str] = None
    assistant_message_ref = None
    assistant_content_accumulated = ""
    message_content_patch: Dict[str, Any] = {}
    agent_steps_by_name: Dict[str, Dict[str, str]] = {}
    message_revision = 0
    initial_message_revision = 0
    persist_applied_count = 0
    progress_event_count = 0
    stream_invocation_id: Optional[str] = None
    patch_tracker = StreamPatchTracker()
    ttf_structured_patch_recorded = False
    logger.debug(
        "Token usage: stream_query starting user_id=%s session_id=%s parse_response=%s",
        user_id,
        session_id,
        parse_response,
    )
    logger.info(
        "stream_query context chat_persist=%s primary_agent=%r optional_agents=%d",
        bool(user_id and session_id),
        primary_agent,
        len(checkpoint_optional_agents),
    )

    assistant_message_id = (request.assistant_message_id or "").strip() or None

    if user_id and session_id:
        try:
            db_client = firestore.Client()
            chat_id = get_chat_id_from_session_by_agent_id(user_id, session_id)
            if chat_id:
                messages_ref = (
                    db_client.collection("users")
                    .document(user_id)
                    .collection("chats")
                    .document(chat_id)
                    .collection("messages")
                )

                selected_doc = None
                if assistant_message_id:
                    client_doc = messages_ref.document(assistant_message_id).get()
                    if client_doc.exists:
                        selected_doc = client_doc
                    else:
                        logger.warning(
                            "assistant_message_id not found; falling back to recent empty assistant user_id=%s chat_id=%s message_id=%s",
                            user_id,
                            chat_id,
                            assistant_message_id,
                        )

                if selected_doc is None:
                    # Order-by createdAt only (no role filter) avoids a composite index on
                    # (role, createdAt). Filter assistant + empty content in code.
                    recent_messages = (
                        messages_ref.order_by("createdAt", direction=firestore.Query.DESCENDING)
                        .limit(15)
                        .stream()
                    )
                    for msg_doc in recent_messages:
                        data = msg_doc.to_dict() or {}
                        if data.get("role") != "assistant":
                            continue
                        if not data.get("content"):
                            selected_doc = msg_doc
                            break
                if selected_doc:
                    assistant_message_ref = selected_doc.reference
                    existing_data = selected_doc.to_dict() or {}
                    assistant_content_accumulated = str(existing_data.get("content") or "")
                    existing_markdown = existing_data.get("contentMarkdown")
                    if isinstance(existing_markdown, str) and existing_markdown.strip():
                        message_content_patch["contentMarkdown"] = existing_markdown
                    existing_json = existing_data.get("contentJson")
                    if isinstance(existing_json, dict):
                        message_content_patch["contentJson"] = existing_json
                    existing_run_id = existing_data.get("analysisRunId")
                    if isinstance(existing_run_id, str) and existing_run_id.strip():
                        message_content_patch["analysisRunId"] = existing_run_id.strip()
                    message_revision = normalize_revision(existing_data.get("revision"), default=0)
                    initial_message_revision = message_revision
                    for step in existing_data.get("agentSteps") or []:
                        if isinstance(step, dict) and step.get("name") and step.get("status"):
                            preserved: Dict[str, Any] = {
                                "name": str(step["name"]),
                                "status": str(step["status"]),
                            }
                            for optional_key in (
                                "displayName",
                                "preview",
                                "detail",
                                "startedAt",
                                "completedAt",
                            ):
                                if step.get(optional_key) is not None:
                                    preserved[optional_key] = step[optional_key]
                            agent_steps_by_name[str(step["name"])] = preserved
                    assistant_message_ref.set(
                        {
                            "role": "assistant",
                            "primaryAgent": primary_agent,
                            "updatedAt": firestore.SERVER_TIMESTAMP,
                        },
                        merge=True,
                    )
                    logger.info(
                        "Reusing assistant message doc for stream persistence user_id=%s chat_id=%s message_id=%s",
                        user_id,
                        chat_id,
                        assistant_message_ref.id,
                    )
                else:
                    assistant_message_ref = messages_ref.document()
                    initial_message_revision = message_revision
                    assistant_message_ref.set(
                        {
                            "role": "assistant",
                            "content": "",
                            "createdAt": firestore.SERVER_TIMESTAMP,
                            "primaryAgent": primary_agent,
                            "agentSteps": [],
                            "revision": message_revision,
                        }
                    )
                    logger.info(
                        "Created assistant message doc for stream persistence user_id=%s chat_id=%s message_id=%s",
                        user_id,
                        chat_id,
                        assistant_message_ref.id,
                    )
            else:
                logger.warning(
                    "No chat_id found for agent session; skipping chat message persistence user_id=%s session_id=%s",
                    user_id,
                    session_id,
                )
        except Exception as e:
            logger.warning("Failed to initialize Firestore stream persistence: %s", e, exc_info=True)
            db_client = None

    _persist_proxy_lifecycle(
        phase=PHASE_PROXY_REQUEST_ACCEPTED,
        assistant_message_ref=assistant_message_ref,
        agent_steps_by_name=agent_steps_by_name,
        **_lifecycle_kwargs,
    )

    def persist_chat_message_state(*, finalize: bool = False) -> None:
        nonlocal message_revision, persist_applied_count, ttf_structured_patch_recorded
        if not assistant_message_ref:
            return
        try:
            steps_list = list(agent_steps_by_name.values())
            persist_content, content_markdown, content_json = (
                _resolve_assistant_message_fields_for_persist(
                    assistant_content_accumulated=assistant_content_accumulated,
                    user_query=user_query,
                    message_content_patch=message_content_patch,
                    prose_only_persist=prose_only_persist,
                    finalize=finalize,
                    agent_steps_by_name=agent_steps_by_name,
                    optional_agent_keys=checkpoint_optional_agents,
                )
            )
            fence_removed = fence_chars_removed(
                message_content_patch.get("contentMarkdown")
                if isinstance(message_content_patch.get("contentMarkdown"), str)
                else assistant_content_accumulated
            )
            content_json, content_json_truncated = constrain_content_json_size(
                content_json,
                max_bytes=_MAX_CONTENT_JSON_BYTES,
            )
            message_revision = next_revision(message_revision)
            accum = dict(message_content_patch)
            accum["contentMarkdown"] = content_markdown
            accum["contentJson"] = content_json
            patch_payload = build_assistant_message_patch(
                content=persist_content,
                agent_steps=steps_list,
                primary_agent=primary_agent,
                revision=message_revision,
                updated_at=firestore.SERVER_TIMESTAMP,
                accumulated_state_delta=accum,
            )
            if steps_list or finalize:
                patch_payload["agentLifecycle"] = firestore.DELETE_FIELD
            if content_json_truncated:
                logger.warning(
                    "contentJson truncated to size budget user_id=%s chat_id=%s message_id=%s revision=%s max_bytes=%s",
                    user_id,
                    chat_id,
                    assistant_message_ref.id if assistant_message_ref else None,
                    message_revision,
                    _MAX_CONTENT_JSON_BYTES,
                )
            if finalize and fence_removed > 0:
                record_fence_strip(chars_removed=fence_removed)
            try:
                validate_assistant_message_patch(patch_payload)
            except ValueError as schema_error:
                logger.warning(
                    "Rejecting invalid assistant patch before write user_id=%s chat_id=%s message_id=%s revision=%s error=%s",
                    user_id,
                    chat_id,
                    assistant_message_ref.id if assistant_message_ref else None,
                    message_revision,
                    schema_error,
                )
                message_revision = max(0, message_revision - 1)
                return
            stored_revision_after_write = 0
            if db_client is not None:
                transaction = db_client.transaction()

                @firestore.transactional
                def _apply_patch_if_newer(txn):
                    snapshot = assistant_message_ref.get(transaction=txn)
                    current_data = snapshot.to_dict() if snapshot and snapshot.exists else {}
                    current_revision = normalize_revision(
                        (current_data or {}).get("revision"), default=0
                    )
                    if is_stale_revision(
                        incoming_revision=message_revision,
                        stored_revision=current_revision,
                    ):
                        return False, current_revision
                    txn.set(assistant_message_ref, patch_payload, merge=True)
                    return True, message_revision

                did_apply, stored_revision_after_write = _apply_patch_if_newer(transaction)
                if not did_apply:
                    logger.warning(
                        "Skipping stale assistant patch user_id=%s chat_id=%s message_id=%s incoming_revision=%s stored_revision=%s",
                        user_id,
                        chat_id,
                        assistant_message_ref.id if assistant_message_ref else None,
                        message_revision,
                        stored_revision_after_write,
                    )
                    record_stale_revision_reject(
                        incoming_revision=message_revision,
                        stored_revision=stored_revision_after_write,
                    )
                    message_revision = stored_revision_after_write
                    return
                if did_apply:
                    persist_applied_count += 1
                    patch_tracker.patch_applies += 1
                    record_patch_apply(
                        revision=message_revision,
                        has_content_json=isinstance(content_json, dict),
                    )
            else:
                assistant_message_ref.set(patch_payload, merge=True)
                stored_revision_after_write = message_revision
                persist_applied_count += 1
                patch_tracker.patch_applies += 1
                record_patch_apply(
                    revision=message_revision,
                    has_content_json=isinstance(content_json, dict),
                )
            logger.info(
                "chat_persist user_id=%s chat_id=%s message_id=%s finalize=%s "
                "content_len=%s steps=%s revision=%s persist_writes=%s",
                user_id,
                chat_id,
                assistant_message_ref.id if assistant_message_ref else None,
                finalize,
                len(persist_content),
                len(steps_list),
                stored_revision_after_write,
                persist_applied_count,
            )
        except Exception as e:
            logger.warning("Failed to persist chat assistant message state: %s", e, exc_info=True)
    def _complete_pending_checkpoint_specialists() -> None:
        """When a checkpoint rollup tool completes, close out any synthetic
        specialist rows that were created from checkpoint_optional_agents but
        did not have their own section in the final analysis payload."""
        complete_pending_specialists(
            agent_steps_by_name,
            _CHECKPOINT_OPTIONAL_AGENT_NAMES,
            display_name_for=_display_name_for,
        )

    persist_throttle = StreamPersistThrottle(interval_ms=200)

    try:
        _persist_proxy_lifecycle(
            phase=PHASE_PROXY_ENGINE_INVOKE,
            assistant_message_ref=assistant_message_ref,
            agent_steps_by_name=agent_steps_by_name,
            **_lifecycle_kwargs,
        )
        for event in reasoning_engine_resource.stream_query(
            user_id=user_id, session_id=session_id, message=message
        ):
            if is_lifecycle_stream_event(event):
                lifecycle_payload = extract_lifecycle_payload(event)
                if lifecycle_payload and not agent_steps_by_name:
                    _persist_agent_lifecycle_to_message(
                        assistant_message_ref,
                        lifecycle_payload,
                    )
                stream_event_count += 1
                continue

            inv = event.get("invocation_id")
            if isinstance(inv, str) and inv.strip():
                stream_invocation_id = inv.strip()

            state_delta = _event_state_delta(event)
            if state_delta:
                message_content_patch = apply_message_patch_from_state_delta(
                    state_delta,
                    message_content_patch,
                )
                if isinstance(state_delta.get("contentJson"), dict):
                    patch_tracker.note_structured_patch()
                    if not ttf_structured_patch_recorded:
                        ttf_ms = patch_tracker.ttf_structured_patch_ms()
                        if ttf_ms is not None:
                            record_ttf_structured_patch_ms(ttf_ms)
                            ttf_structured_patch_recorded = True

            event_text = extract_text_from_event(event)
            display_text = _checkpoint_progress_display_text(event, event_text)
            if display_text:
                if _should_replace_assistant_content(event, event_text):
                    assistant_content_accumulated = display_text
                else:
                    assistant_content_accumulated += display_text

            step_updates = extract_agent_step_updates_from_event(event)
            if _is_checkpoint_progress_event(event, event_text):
                step_updates = step_updates + _progressive_checkpoint_step_updates_from_state_delta(
                    event
                )
                step_updates = step_updates + _synthesis_step_updates_from_state_delta(
                    event
                )
            if step_updates:
                for step_update in step_updates:
                    merge_step_update(agent_steps_by_name, step_update)
                if any(
                    step_update.get("name") in _CHECKPOINT_ROLLUP_TOOLS
                    and step_update.get("status") == "completed"
                    for step_update in step_updates
                ):
                    _complete_pending_checkpoint_specialists()

            is_progress = _is_checkpoint_progress_event(event, event_text)
            if is_progress:
                progress_event_count += 1

            did_persist = False
            if event_text or step_updates:
                if persist_throttle.should_persist():
                    persist_chat_message_state()
                    did_persist = True

            logger.info(
                "stream_chunk event=%s %s step_updates=%s did_persist=%s "
                "progress_events=%s agent_steps=%s",
                stream_event_count,
                stream_event_log_summary(event),
                _step_updates_log_slice(step_updates),
                did_persist,
                progress_event_count,
                sorted(agent_steps_by_name.keys()),
            )
            accumulate_usage_from_stream_event(
                usage_running, event, event_index=stream_event_count
            )
            stream_event_count += 1
            if parse_response:
                step_message = extract_event_step_summary(event)
                if step_message:
                    yield step_message
                elif display_text:
                    yield f"{prettify_name(event.get('author', ''))}: {display_text}"
            else:
                if (
                    _is_checkpoint_progress_event(event, event_text)
                    and display_text
                    and display_text != event_text
                ):
                    patched = dict(event)
                    content = patched.get("content")
                    if isinstance(content, dict):
                        patched["content"] = {
                            **content,
                            "parts": [{"text": display_text}],
                        }
                    yield patched
                else:
                    yield event
    except Exception:
        stream_failed = True
        logger.exception(
            "stream_query failed session_id=%s events_before_error=%s",
            session_id,
            stream_event_count,
        )
        raise
    finally:
        logger.debug(
            "Token usage: stream_query finished user_id=%s session_id=%s stream_chunks=%s "
            "aggregated=%s",
            user_id,
            session_id,
            stream_event_count,
            dict(usage_running),
        )
        if not stream_failed and stream_event_count:
            final_revision = message_revision
            logger.info(
                "stream_query completed session_id=%s invocation_id=%s "
                "stream_chunks=%s progress_chunks=%s persist_writes=%s "
                "revision=%s->%s agent_steps=%s chat_id=%s message_id=%s token_usage=%s",
                session_id,
                stream_invocation_id or "-",
                stream_event_count,
                progress_event_count,
                persist_applied_count,
                initial_message_revision,
                final_revision,
                sorted(agent_steps_by_name.keys()),
                chat_id or "-",
                assistant_message_ref.id if assistant_message_ref else "-",
                dict(usage_running),
            )
        if stream_failed:
            merge_step_update(
                agent_steps_by_name,
                {
                    "name": "agent_stream",
                    "status": "failed",
                    "displayName": _display_name_for("agent_stream"),
                },
            )
        persist_chat_message_state(finalize=not stream_failed)
        persist_user_token_usage(user_id, usage_running)

        
def extract_event_step_summary(event_data: dict) -> str | None:
    """
    Extracts agent and tool names from a parsed event dictionary,
    returning a formatted string.
    Returns None if:
    1. content.parts[0].text exists.
    2. content.parts[0].function_response.response.result is None.
    """
    try:
        author_agent = event_data.get('author')
        called_tools = []
        responded_tools = []
        logger.debug(
            "Extracting from event summary: %s", stream_event_log_summary(event_data)
        )

        content_parts = event_data.get('content', {}).get('parts', [])

        # --- NEW LOGIC (Combined): Return None based on content type ---
        if content_parts:
            first_part = content_parts[0]
            if 'text' in first_part:
                logger.debug("Content contains direct text; returning None for tool/transfer extraction.")
                return None
            elif 'function_response' in first_part:
                response_result = first_part['function_response'].get('response', {}).get('result')
                if response_result is None:
                    logger.debug("Function response result is None; returning None for this event.")
                    return None
        # --- END NEW LOGIC ---

        for part in content_parts:
            # Handle function_call events
            if 'function_call' in part:
                function_call_data = part['function_call']
                current_tool_name = function_call_data.get('name')
                if current_tool_name:
                    called_tools.append(current_tool_name)
            
            # Handle function_response events (only if result was not None, as per early exit)
            elif 'function_response' in part:
                function_response_data = part['function_response']
                current_tool_name = function_response_data.get('name')
                if current_tool_name:
                    if current_tool_name not in responded_tools:
                        responded_tools.append(current_tool_name)

        # --- Construct the final string response ---
        if not author_agent:
            logger.warning("No author agent found in event data.")
            return None

        result_parts = [f"{prettify_name(author_agent)}"]

        if called_tools:
            result_parts.append(f"Executing: {', '.join(format_name(tool, bold=False) for tool in called_tools)}")
        if responded_tools:
            result_parts.append(f"Completed: {', '.join(format_name(tool, bold=False) for tool in responded_tools)}")

        return " ".join(result_parts) + "  \n\n"

    except (IndexError, KeyError) as e:
        logger.exception("Error parsing stream event for transfer/tool extraction: %s", e)
        return None

def format_name(name: str, bold: bool = True) -> str:
    """
    Converts a snake_case name like 'homecare_agent' to 'Homecare Agent'
    and optionally bolds the output.
    """
    if not name:
        return ""
    formatted_name = _DISPLAY_NAME_MAP.get(name, " ".join(word.capitalize() for word in name.split("_")))
    return f"**{formatted_name}**" if bold else formatted_name

def prettify_name(name: str) -> str:
    """
    Converts a snake_case name like 'homecare_agent' to 'Homecare Agent' and bolds it.
    """
    return format_name(name, bold=True)

