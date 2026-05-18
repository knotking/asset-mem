import logging
from typing import Any, Dict

import json

from schemas.agent import AgentRequest
from services.vertex_service import publish_doc_to_secure_store, stream_agent_answers

logger = logging.getLogger(__name__)


def _agent_request_debug_summary(req: AgentRequest) -> str:
    uq = req.user_query or ""
    return (
        f"session_id={req.session_id!r} property_id={req.property_id!r} "
        f"primary_agent={req.primary_agent!r} user_query_len={len(uq)} "
        f"context_doc_uris={len(req.context_doc_uris or [])} "
        f"diagnosis_uris={len(req.diagnosis_uris or [])} "
        f"checkpoint_ids={len(req.checkpoint_ids or [])} "
        f"checkpoint_optional_agents={len(req.checkpoint_optional_agents or [])} "
        f"search_location_source={(req.search_location.source if req.search_location else None)!r}"
    )


async def stream_firebase_agent_answers(request: AgentRequest):
    logger.info("agent_stream start %s", _agent_request_debug_summary(request))
    logger.debug(
        "agent_stream request detail user_query_preview=%r property_address_len=%s",
        (request.user_query or "")[:500],
        len(request.property_address or ""),
    )
    if not request.user_id:
        logger.warning("User ID not provided for streaming.")
        yield json.dumps({"status": "error", "message": "User ID is required"})
        return

    try:
        async for event_part in stream_agent_answers(
            request=request
        ):
            if isinstance(event_part, dict) and event_part.get("proxy_error"):
                logger.info(
                    "agent_stream proxy_error code=%s",
                    (event_part.get("proxy_error") or {}).get("code"),
                )
                yield json.dumps(event_part["proxy_error"])
                return
            if isinstance(event_part, dict) and "message" in event_part:
                logger.debug("agent_stream sse_message_keys=%s", list(event_part.keys()))
                yield event_part["message"]
            else:
                yield event_part

    except Exception as e:
        logger.exception("agent_stream failed: %s", e)
        yield json.dumps({"status": "error", "message": f"Internal server error: {e}"})


def handle_firebase_file_upload( request: AgentRequest) -> Dict[str, Any]:
    logger.info(
        "rag_file_upload uris=%d user_query_len=%d",
        len(request.context_doc_uris or []),
        len(request.user_query or ""),
    )
    logger.debug(
        "rag_file_upload uris=%r",
        (request.context_doc_uris or [])[:20],
    )
    result = publish_doc_to_secure_store(
        gcs_urls=request.context_doc_uris,
        user_query=request.user_query,
        user_id=request.user_id,
    )
    logger.info("rag_file_upload publish_result keys=%s", list(result.keys()) if isinstance(result, dict) else type(result).__name__)
    return {"status": "success", "message": "Files are published for upload"}

async def handle_firebase_agent_query(request: AgentRequest) -> Dict[str, Any]:
    """
    Handles incoming Firebase messages.
    Verifies the Firebase ID token, extracts user_id, and processes the message further.
    """
    logger.info("agent_query start %s", _agent_request_debug_summary(request))

    if not request.user_id:
        logger.warning("User ID not provided.")
        return {"status": "error", "message": "User ID is required"}

    try:
        full_response_content = []

        async for event in stream_agent_answers(
            request=request,
            parse_response=False
        ):
            if isinstance(event, dict) and event.get("proxy_error"):
                pe = event["proxy_error"]
                logger.info(
                    "agent_query proxy_error code=%s",
                    pe.get("code"),
                )
                return {
                    "status": "error",
                    "code": pe.get("code"),
                    "message": pe.get("message"),
                    "used": pe.get("used"),
                    "limit": pe.get("limit"),
                    "period": pe.get("period"),
                }
            # event_part can be a string (from text parts) or a dict (from transfer messages)
            parts = event.get("content", {}).get("parts", [])
            for part in parts:
                if isinstance(part, dict) and "text" in part and part["text"]:
                    full_response_content.append(part['text'])
            # You might need to refine how you process event_part based on its actual structure

        final_response = " ".join(full_response_content).strip()
        if not final_response:
            final_response = "No response from agent."

        logger.info(
            "agent_query success response_chars=%d session_id=%r",
            len(final_response),
            request.session_id,
        )
        return {"status": "success", "message": final_response}

    except Exception as e:
        logger.exception("agent_query failed: %s", e)
        return {"status": "error", "message": f"Internal server error: {e}"}

