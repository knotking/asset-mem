import os
import logging
import re
import time
import vertexai
from vertexai import agent_engines
from vertexai.agent_engines import AgentEngine
from typing import Optional, Dict, Any, List, Callable
import json
from google.cloud import pubsub_v1
from google.cloud import firestore
from google.cloud.firestore_v1 import FieldFilter

from schemas.agent import AgentRequest
from services.token_usage_service import (
    accumulate_usage_from_stream_event,
    persist_user_token_usage,
)
from common.observability.logging_context import (
    get_correlation_id,
    pubsub_payload_with_correlation,
)
from common.token import TokenQuotaExceeded, check_token_quota_or_raise
 
# Configure logging
logger = logging.getLogger(__name__)

# Router/orchestrator agents — one stable user-facing label (see agent-display.ts).
_COORDINATING_AGENTS = {
    "property_agent",
    "doculink_agent",
}

_COORDINATING_LABEL = "Understanding your request…"

_DEFAULT_DISPLAY_LABEL = "Working on it…"

def _reasoning_payload_summary(payload: Dict[str, Any]) -> str:
    uq = payload.get("user_query") or ""
    prev = uq[:120] + ("…" if len(uq) > 120 else "")
    return (
        f"user_query_len={len(uq)} user_query_preview={prev!r} "
        f"context_doc_uris={len(payload.get('context_doc_uris') or [])} "
        f"diagnosis_uris={len(payload.get('diagnosis_uris') or [])} "
        f"checkpoint_ids={len(payload.get('checkpoint_ids') or [])} "
        f"has_property_id={bool(payload.get('property_id'))} "
        f"primary_agent={payload.get('primary_agent')!r} "
        f"location_type={payload.get('location_type')!r}"
    )


_DISPLAY_NAME_MAP = {
    "diagnostic_agent": "Diagnosing the issue…",
    "ask_knowledge_base_agent": "Searching repair guides…",
    "ask_knowledge_base_retrieval": "Searching repair guides…",
    "ask_user_docs_agent": "Searching your documents…",
    "ask_user_docs_retrieval": "Searching your documents…",
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
    "checkpoint_agent": "Loading your checkpoints…",
    "checkpoint_analysis_agent": "Analyzing your checkpoints…",
    "checkpoint_progress_agent": "Preparing your analysis…",
    "checkpoint_analysis_synthesis_agent": "Writing your summary…",
    "checkpoint_optional_agents_parallel_runner": "Finishing your analysis…",
    "checkpoint_analysis_progress": "Updating your analysis…",
    "agent_stream": "Almost done…",
    "agent_response": "Done",
}

_CHECKPOINT_ROLLUP_TOOLS = {
    "checkpoint_agent",
    "checkpoint_analysis_agent",
}

_CHECKPOINT_PROGRESS_AUTHORS = {
    "checkpoint_analysis_progress",
    "checkpoint_optional_agents_parallel_runner",
}

# Authors and payloads that emit a full checkpoint dual-format body — replace, never append.
_CHECKPOINT_CONTENT_REPLACE_AUTHORS = _CHECKPOINT_PROGRESS_AUTHORS | {
    "checkpoint_analysis_synthesis_agent",
    "checkpoint_progress_synthesis_agent",
    "doculink_agent",
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

def publish_doc_to_secure_store(gcs_urls:list[str], user_query:str, user_id: str ) -> dict:
    """Publishes a structured payload to a secure storage."""
    try:
        publisher = pubsub_v1.PublisherClient()
        
        topic_path = publisher.topic_path(os.environ.get("GCP_PROJECT_ID"), os.environ.get("USER_UPLOAD_TOPIC")) # Assuming only topic name, or pass full path
        payload = pubsub_payload_with_correlation({
            "gcs_urls": gcs_urls,
            "user_id": user_id,
            "user_query": user_query,
            "source": "rag-file-upload",
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


_JSON_FENCE_RE = re.compile(
    r"```(?:json)?\s*(\{.*?\})\s*```",
    flags=re.DOTALL | re.IGNORECASE,
)

_CHECKPOINT_ANALYSIS_JSON_FENCE_RE = re.compile(
    r"```json\s*(\{[\s\S]*?\})\s*```",
    flags=re.IGNORECASE,
)


def _is_checkpoint_dual_format_content(text: str) -> bool:
    """True when text looks like markdown + fenced analysis JSON from checkpoint agents."""
    if not (text or "").strip() or "```json" not in text:
        return False
    return bool(_CHECKPOINT_ANALYSIS_JSON_FENCE_RE.search(text))


def _should_replace_assistant_content(event: Dict[str, Any], event_text: str) -> bool:
    """Checkpoint analysis bodies are full snapshots; later events must not append."""
    author = event.get("author")
    if isinstance(author, str) and author in _CHECKPOINT_CONTENT_REPLACE_AUTHORS:
        return True
    return _is_checkpoint_dual_format_content(event_text)


def _strip_user_query_echoes(content: str, user_query: str) -> str:
    """Remove echoed user_query lines that checkpoint dual-format builders insert."""
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


def _keep_last_checkpoint_dual_format(content: str) -> str:
    """When multiple analysis JSON blocks were concatenated, keep the last valid one."""
    matches = list(_CHECKPOINT_ANALYSIS_JSON_FENCE_RE.finditer(content))
    if len(matches) <= 1:
        return content
    for match in reversed(matches):
        try:
            parsed = json.loads(match.group(1))
        except json.JSONDecodeError:
            continue
        if not isinstance(parsed, dict) or "analysis" not in parsed:
            continue
        prior_ends = [m.end() for m in matches if m.end() <= match.start()]
        markdown_start = prior_ends[-1] if prior_ends else 0
        markdown_part = content[markdown_start : match.start()].strip()
        json_text = json.dumps(parsed, ensure_ascii=False, indent=2)
        if markdown_part:
            return f"{markdown_part}\n\n```json\n{json_text}\n```\n"
        return f"```json\n{json_text}\n```\n"
    return content


_CHECKPOINT_BRANCH_SECTION_KEYS = {
    "coverage": "coverageResult",
    "diy": "diyResults",
    "service": "serviceResults",
    "cost": "costEstimationResults",
}


def _strip_analysis_status_from_dual_format(content: str) -> str:
    """Remove analysisStatus from completed checkpoint bodies (stale after synthesis)."""
    if not _is_checkpoint_dual_format_content(content):
        return content
    match = None
    for candidate in reversed(list(_CHECKPOINT_ANALYSIS_JSON_FENCE_RE.finditer(content))):
        try:
            parsed = json.loads(candidate.group(1))
        except json.JSONDecodeError:
            continue
        if isinstance(parsed, dict) and isinstance(parsed.get("analysis"), dict):
            match = candidate
            parsed_root = parsed
            break
    else:
        return content

    analysis = dict(parsed_root["analysis"])
    if "analysisStatus" not in analysis:
        return content
    analysis.pop("analysisStatus", None)
    parsed_root = {**parsed_root, "analysis": analysis}
    markdown_part = content[: match.start()].rstrip()
    json_text = json.dumps(parsed_root, ensure_ascii=False, indent=2)
    if markdown_part:
        return f"{markdown_part}\n\n```json\n{json_text}\n```\n"
    return f"```json\n{json_text}\n```\n"


def _should_strip_analysis_status_on_finalize(
    content: str,
    agent_steps_by_name: Dict[str, Dict[str, Any]],
    optional_agent_keys: List[str],
) -> bool:
    """Drop analysisStatus when the stream finished and branch work is done or sections exist."""
    if not _is_checkpoint_dual_format_content(content):
        return False
    if optional_agent_keys:
        expected = [
            _CHECKPOINT_OPTIONAL_AGENT_BY_KEY[k]
            for k in optional_agent_keys
            if k in _CHECKPOINT_OPTIONAL_AGENT_BY_KEY
        ]
        if expected and all(
            agent_steps_by_name.get(name, {}).get("status") == "completed"
            for name in expected
        ):
            return True
    data = _coerce_result_to_dict(content)
    if not data:
        return False
    analysis = _unwrap_analysis(data)
    if not isinstance(analysis, dict):
        return False
    status = analysis.get("analysisStatus")
    if not isinstance(status, dict):
        return False
    for branch, section_key in _CHECKPOINT_BRANCH_SECTION_KEYS.items():
        branch_status = status.get(branch)
        if branch_status in ("pending", "running") and section_key in analysis:
            return True
    return all(st == "completed" for st in status.values())


def _normalize_assistant_content_for_persist(
    content: str,
    user_query: str,
    *,
    agent_steps_by_name: Optional[Dict[str, Dict[str, Any]]] = None,
    optional_agent_keys: Optional[List[str]] = None,
    finalize: bool = False,
) -> str:
    if _is_checkpoint_dual_format_content(content):
        content = _keep_last_checkpoint_dual_format(content)
    if finalize and agent_steps_by_name is not None and _should_strip_analysis_status_on_finalize(
        content, agent_steps_by_name, optional_agent_keys or []
    ):
        content = _strip_analysis_status_from_dual_format(content)
    return _strip_user_query_echoes(content, user_query)


def _coerce_result_to_dict(result: Any) -> Optional[Dict[str, Any]]:
    """Best-effort decode of a function_response.result payload to a dict.

    Sub-agents in this repo return data in three shapes that we need to
    tolerate:
      1. A plain dict (e.g. when ADK returned a structured result).
      2. A JSON string.
      3. A Markdown-wrapped string with one or more ```json fences
         (e.g. checkpoint_analysis_agent emits dual-format output).
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

    # 2. Look for a fenced ```json { ... } ``` block anywhere in the string.
    match = _JSON_FENCE_RE.search(s)
    if match:
        try:
            decoded = json.loads(match.group(1))
            if isinstance(decoded, dict):
                return decoded
        except Exception:
            pass

    # 3. Last resort: take the first balanced { ... } substring.
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
    # Fallback: if checkpoint_agent rolled up coverage / service into its result,
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
    # user_docs / knowledge_base outputs vary; surface a coarse signal.
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
    "checkpoint_agent": _checkpoint_preview,
    "checkpoint_analysis_agent": _checkpoint_preview,
    "ask_user_docs_agent": _docs_preview,
    "ask_user_docs_retrieval": _docs_preview,
    "ask_knowledge_base_agent": _docs_preview,
    "ask_knowledge_base_retrieval": _docs_preview,
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


def _progressive_checkpoint_step_updates_from_text(
    event_text: str,
) -> List[Dict[str, Any]]:
    """Mark optional specialist rows completed from progressive dual-format JSON."""
    if not (event_text or "").strip():
        return []
    data = _coerce_result_to_dict(event_text)
    if not data:
        return []
    root = _unwrap_analysis(data)
    if not isinstance(root, dict):
        return []
    status = root.get("analysisStatus")
    if not isinstance(status, dict):
        return []
    updates: List[Dict[str, Any]] = []
    for branch, st in status.items():
        if st != "completed":
            continue
        agent_name = _CHECKPOINT_OPTIONAL_AGENT_BY_KEY.get(str(branch))
        if agent_name:
            updates.append(_step_update(agent_name, "completed"))
    return updates


def _is_checkpoint_progress_event(event: Dict[str, Any], event_text: str) -> bool:
    if not event_text:
        return False
    author = event.get("author")
    return isinstance(author, str) and author in _CHECKPOINT_PROGRESS_AUTHORS


def extract_agent_step_updates_from_event(event: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Extract agent step updates in the same shape used by mapp/webapp messages.

    A single checkpoint rollup event can synthesize multiple specialist rows
    (coverage/diy/service/cost) because those sub-agents run behind AgentTool
    and do not emit their own events to the parent Reasoning Engine stream.
    """
    parts = event.get("content", {}).get("parts", [])
    actions = event.get("actions", {})

    transfer_target = actions.get("transfer_to_agent")
    if transfer_target:
        target = str(transfer_target)
        return [_step_update(target, "transferredto")]

    for part in parts:
        if not isinstance(part, dict):
            continue
        function_call = part.get("function_call")
        if isinstance(function_call, dict):
            tool_name = function_call.get("name")
            if tool_name and tool_name != "transfer_to_agent":
                tool_name_str = str(tool_name)
                # Only the rollup tool is "executing" here; optional specialists
                # get agentSteps rows from progressive checkpoint_analysis_progress
                # events (completed per branch) so the UI is not biased to cost_agent.
                return [_step_update(tool_name_str, "executing")]
            if tool_name == "transfer_to_agent":
                args = function_call.get("args", {})
                target = args.get("agent_name") if isinstance(args, dict) else None
                if target:
                    target_str = str(target)
                    return [_step_update(target_str, "transferredto")]

        function_response = part.get("function_response")
        if isinstance(function_response, dict):
            tool_name = function_response.get("name")
            if tool_name and tool_name != "transfer_to_agent":
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
                "message": "Monthly AI token limit reached. Usage resets at the start of next month (UTC).",
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
    diagnosis_uris = request.diagnosis_uris
    checkpoint_ids = request.checkpoint_ids  # Checkpoint IDs for checkpoint context
    if checkpoint_ids:
        logger.info(f"Received checkpoint_ids in request: {checkpoint_ids} (count: {len(checkpoint_ids)})")
    else:
        logger.debug("No checkpoint_ids provided in request")
    property_address = request.property_address
    property_id = request.property_id  # Option 1: property_id from request
    primary_agent = request.primary_agent  # Primary agent selection for explicit routing
    checkpoint_optional_agents = request.checkpoint_optional_agents or []
    location_type = request.location_type
    location_coordinates = request.location_coordinates
    location_radius = request.location_radius
    
    # Geocode address to coordinates if location_type is "address" and we have an address
    if location_type == "address" and property_address and not location_coordinates:
        try:
            from common.geocoding import GeocodingClient, GeocodingConfig
            
            geocoding_config = GeocodingConfig.from_env()
            if geocoding_config.is_configured:
                geocoding_client = GeocodingClient(geocoding_config)
                geocode_response = await geocoding_client.geocode(property_address, region="us")
                
                if geocode_response.success and geocode_response.has_location:
                    location_coordinates = {
                        "lat": geocode_response.lat,
                        "lng": geocode_response.lng
                    }
                    logger.info(f"Successfully geocoded address '{property_address}' to coordinates: {location_coordinates}")
                else:
                    logger.warning(f"Failed to geocode address '{property_address}': {geocode_response.error_message}")
            else:
                logger.debug("Geocoding not configured, skipping address geocoding")
        except Exception as e:
            logger.warning(
                "Error during geocoding (continuing with address only): %s",
                e,
                exc_info=True,
            )
    
    # Set default radius if not specified
    if location_radius is None and (location_coordinates or location_type):
        location_radius = 5  # Default to 5 miles
        logger.debug(f"Setting default location_radius to {location_radius} miles")
    
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
    
    payload: Dict[str, Any] = {"user_query": user_query}

    if context_doc_uris:
        payload["context_doc_uris"] = context_doc_uris

    if diagnosis_uris:
        payload["diagnosis_uris"] = diagnosis_uris
    
    # Include checkpoint_ids if provided (enables checkpoint_agent routing)
    if checkpoint_ids:
        payload["checkpoint_ids"] = checkpoint_ids
        logger.info(f"Including checkpoint_ids in agent payload: {checkpoint_ids} (count: {len(checkpoint_ids)})")
    else:
        logger.debug("No checkpoint_ids to include in agent payload")
    
    # Include property_id if available (for checkpoint queries, etc.)
    if property_id:
        logger.info(f"Including property_id in agent payload: {property_id}")
        payload["property_id"] = property_id
    
    # Include primary_agent if provided (for explicit routing)
    if primary_agent:
        payload["primary_agent"] = primary_agent
        logger.info(f"Including primary_agent in agent payload: {primary_agent}")
    
    # Include checkpoint_optional_agents if provided
    if checkpoint_optional_agents:
        payload["checkpoint_optional_agents"] = checkpoint_optional_agents
        logger.info(f"Including checkpoint_optional_agents in payload: {checkpoint_optional_agents}")
    
    # Location handling logic:
    # Always include property_address if available (for context)
    if property_address:
        payload["property_address"] = property_address
    
    # Include location metadata when location data is present
    if location_type:
        payload["location_type"] = location_type
    
    # Include coordinates (either from request or geocoded from address)
    if location_coordinates:
        payload["location_coordinates"] = location_coordinates
        logger.info(f"Including location_coordinates in payload: {location_coordinates}")
    
    # Include radius (with default of 5 miles)
    if location_radius is not None:
        payload["location_radius"] = location_radius
        logger.info(f"Including location_radius in payload: {location_radius} miles")

    correlation_id = get_correlation_id()
    if correlation_id:
        payload["correlation_id"] = correlation_id

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
    agent_steps_by_name: Dict[str, Dict[str, str]] = {}
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

                # Order-by createdAt only (no role filter) avoids a composite index on
                # (role, createdAt). Filter assistant + empty content in code.
                recent_messages = (
                    messages_ref.order_by("createdAt", direction=firestore.Query.DESCENDING)
                    .limit(15)
                    .stream()
                )

                selected_doc = None
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
                    assistant_message_ref.set(
                        {
                            "role": "assistant",
                            "content": "",
                            "createdAt": firestore.SERVER_TIMESTAMP,
                            "primaryAgent": primary_agent,
                            "agentSteps": [],
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

    def persist_chat_message_state(*, finalize: bool = False) -> None:
        if not assistant_message_ref:
            return
        try:
            steps_list = list(agent_steps_by_name.values())
            assistant_message_ref.set(
                {
                    "role": "assistant",
                    "content": _normalize_assistant_content_for_persist(
                        assistant_content_accumulated,
                        user_query,
                        agent_steps_by_name=agent_steps_by_name,
                        optional_agent_keys=checkpoint_optional_agents,
                        finalize=finalize,
                    ),
                    "agentSteps": steps_list,
                    "primaryAgent": primary_agent,
                    "updatedAt": firestore.SERVER_TIMESTAMP,
                },
                merge=True,
            )
            logger.debug(
                "Persisted chat assistant message state user_id=%s chat_id=%s message_id=%s content_len=%s steps=%s",
                user_id,
                chat_id,
                assistant_message_ref.id if assistant_message_ref else None,
                len(assistant_content_accumulated),
                len(steps_list),
            )
        except Exception as e:
            logger.warning("Failed to persist chat assistant message state: %s", e, exc_info=True)
    def _merge_step_update(update: Dict[str, Any]) -> None:
        """Merge an extracted step into agent_steps_by_name, preserving prior
        fields (startedAt, preview from an earlier event, etc.)."""
        name = update.get("name")
        if not name:
            return
        now_ms = int(time.time() * 1000)
        previous = agent_steps_by_name.get(name, {})
        merged: Dict[str, Any] = {**previous, **update}
        # First time we see this step → stamp startedAt.
        if "startedAt" not in merged:
            merged["startedAt"] = now_ms
        # Completion / failure → stamp completedAt (only once).
        if merged.get("status") in ("completed", "failed") and not merged.get("completedAt"):
            merged["completedAt"] = now_ms
        # Don't overwrite a non-empty preview with None on subsequent events.
        if not merged.get("preview") and previous.get("preview"):
            merged["preview"] = previous["preview"]
        # Lock in the first displayName we showed so randomized orchestrator
        # labels (and any future updates) don't shuffle across status changes.
        if previous.get("displayName"):
            merged["displayName"] = previous["displayName"]
        agent_steps_by_name[name] = merged

    def _complete_pending_checkpoint_specialists() -> None:
        """When a checkpoint rollup tool completes, close out any synthetic
        specialist rows that were created from checkpoint_optional_agents but
        did not have their own section in the final analysis payload."""
        for agent_name in _CHECKPOINT_OPTIONAL_AGENT_NAMES:
            step = agent_steps_by_name.get(agent_name)
            if not step or step.get("status") != "executing":
                continue
            _merge_step_update(
                {
                    "name": agent_name,
                    "status": "completed",
                    "displayName": step.get("displayName")
                    or _display_name_for(agent_name),
                }
            )

    try:
        for event in reasoning_engine_resource.stream_query(
            user_id=user_id, session_id=session_id, message=message
        ):
            event_text = extract_text_from_event(event)
            if event_text:
                if _should_replace_assistant_content(event, event_text):
                    assistant_content_accumulated = event_text
                else:
                    assistant_content_accumulated += event_text

            step_updates = extract_agent_step_updates_from_event(event)
            if _is_checkpoint_progress_event(event, event_text):
                step_updates = step_updates + _progressive_checkpoint_step_updates_from_text(
                    event_text
                )
            if step_updates:
                for step_update in step_updates:
                    _merge_step_update(step_update)
                if any(
                    step_update.get("name") in _CHECKPOINT_ROLLUP_TOOLS
                    and step_update.get("status") == "completed"
                    for step_update in step_updates
                ):
                    _complete_pending_checkpoint_specialists()
                logger.info(
                    "agentSteps update event=%s author=%s updates=%s",
                    stream_event_count,
                    event.get("author"),
                    [
                        {
                            "name": step_update.get("name"),
                            "status": step_update.get("status"),
                            "preview": step_update.get("preview"),
                        }
                        for step_update in step_updates
                    ],
                )
            elif event_text:
                logger.info(
                    "agent text event=%s author=%s chars=%s",
                    stream_event_count,
                    event.get("author"),
                    len(event_text),
                )

            if event_text or step_updates:
                persist_chat_message_state()
            accumulate_usage_from_stream_event(
                usage_running, event, event_index=stream_event_count
            )
            stream_event_count += 1
            if parse_response:
                transfer_message = extract_event_data_with_transfer_target(event)
                if transfer_message:
                    yield transfer_message
                else:
                    parts = event.get("content", {}).get("parts", [])
                    for part in parts:
                        if isinstance(part, dict) and "text" in part and part["text"]:
                            yield f"{prettify_name(event.get('author',''))}: {part['text']}"
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
            logger.info(
                "stream_query completed session_id=%s stream_chunks=%s token_usage=%s",
                session_id,
                stream_event_count,
                dict(usage_running),
            )
        if stream_failed:
            _merge_step_update(
                {
                    "name": "agent_stream",
                    "status": "failed",
                    "displayName": _display_name_for("agent_stream"),
                }
            )
        persist_chat_message_state(finalize=not stream_failed)
        persist_user_token_usage(user_id, usage_running)

        
def extract_event_data_with_transfer_target(event_data: dict) -> str | None:
    """
    Extracts agent, tool names (can be multiple), and specifically the transfer target agent
    from a parsed event dictionary, returning a formatted string.
    Returns None if:
    1. content.parts[0].text exists.
    2. content.parts[0].function_response.response.result is None.
    """
    try:
        author_agent = event_data.get('author')
        called_tools = []
        responded_tools = []
        transfer_target_agent = None

        logger.debug("Extracting from event data: %s", event_data)

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

        # Check for transfer_to_agent in actions (useful for function_response events, even if result is not None)
        actions = event_data.get('actions', {})
        if 'transfer_to_agent' in actions:
            transfer_target_agent = actions.get('transfer_to_agent')

        for part in content_parts:
            # Handle function_call events
            if 'function_call' in part:
                function_call_data = part['function_call']
                current_tool_name = function_call_data.get('name')
                if current_tool_name:
                    called_tools.append(current_tool_name)
                    
                    # Special handling for 'transfer_to_agent' function call
                    if current_tool_name == 'transfer_to_agent' and 'args' in function_call_data:
                        if 'agent_name' in function_call_data['args']:
                            transfer_target_agent = function_call_data['args']['agent_name']
            
            # Handle function_response events (only if result was not None, as per early exit)
            elif 'function_response' in part:
                function_response_data = part['function_response']
                current_tool_name = function_response_data.get('name')
                if current_tool_name and current_tool_name != 'transfer_to_agent':
                    if current_tool_name not in responded_tools:
                        responded_tools.append(current_tool_name)

        # --- Construct the final string response ---
        if not author_agent:
            logger.warning("No author agent found in event data.")
            return None

        result_parts = [f"{prettify_name(author_agent)}"]

        if transfer_target_agent:
            result_parts.append(f"TransferredTo: {prettify_name(transfer_target_agent)}")

        if called_tools and not transfer_target_agent:
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

