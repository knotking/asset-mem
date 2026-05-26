"""
Checkpoint Agent

Retrieves checkpoint information using Firestore Vector Search for semantic query matching.
Can optionally trigger comprehensive analysis with coverage, DIY, service, and cost recommendations.
"""

import json
import logging
import re
import time
from typing import Any, Dict, List, Optional, Type

from pydantic import BaseModel

from google.genai import types
from google.adk.agents import Agent
from google.adk.memory.in_memory_memory_service import InMemoryMemoryService
from google.adk.runners import Runner
from google.adk.sessions.in_memory_session_service import InMemorySessionService
from google.adk.tools import ToolContext
from google.adk.tools.agent_tool import AgentTool, _get_input_schema, _get_output_schema
from google.adk.tools._forwarding_artifact_service import ForwardingArtifactService
from google.adk.utils._schema_utils import validate_schema
from google.adk.utils.context_utils import Aclosing
from typing_extensions import override
from dotenv import load_dotenv
from .prompts import checkpoint_agent_instruction
from .firestore_vector_search import search_checkpoints_by_vector
from .media_search_query_refiner import refine_checkpoint_media_search_query
from ..checkpoint_dual_format_guard import (
    CHECKPOINT_ANALYSIS_DUAL_FORMAT_STATE_KEY,
    CHECKPOINT_ANALYSIS_PENDING_INPUT_STATE_KEY,
    CHECKPOINT_ANALYSIS_PROGRESS_STATE_KEY,
    CHECKPOINT_BRANCH_COMPLETED_STATE_KEY,
    CHECKPOINT_PROGRESS_EVENT_AUTHOR,
    bump_checkpoint_progress_emit_seq,
    build_phase0_checkpoint_dual_format,
    checkpoint_agent_after_model_callback,
    dual_format_has_valid_analysis_json,
    dual_format_is_passthrough_quality,
    enrich_dual_format_markdown,
    apply_tool_context_state_delta,
    ensure_dual_format_body,
    format_checkpoints_for_analysis_blob,
    resolve_passthrough_dual_format_from_state,
    stash_checkpoint_dual_format_in_state,
)
from google.adk.events.event import Event, EventActions
from ..checkpoint_request_timing import (
    begin_checkpoint_request,
    begin_executor_phase,
    record_retrieval_ms,
    set_return_chars,
)
from ..checkpoint_analysis_agent.agent import (
    CHECKPOINT_RETRIEVAL_SEARCH_QUERY_STATE_KEY,
    CheckpointAnalysisInput,
    normalize_checkpoint_analysis_tool_args,
)
from ...agent_inputs import DocsInput
from ...model_config import GLOBAL_GEMINI_MODEL

load_dotenv()

logger = logging.getLogger(__name__)


def build_search_query_from_checkpoints(
    formatted_results: List[Dict[str, Any]], *, max_chars: int = 200
) -> str:
    """
    Compact search seed for YouTube / product APIs: location plus issue descriptions.
    """
    locations: List[str] = []
    issue_parts: List[str] = []
    seen_loc = set()
    for fc in formatted_results or ():
        loc = (fc.get("location") or "").strip()
        if loc and loc not in seen_loc:
            seen_loc.add(loc)
            locations.append(loc)
        for issue in fc.get("issues") or []:
            if isinstance(issue, dict):
                text = (issue.get("description") or "").strip()
            else:
                text = str(issue).strip()
            if text:
                issue_parts.append(text)
    loc_blob = " ".join(locations[:3])
    issue_blob = " ".join(issue_parts[:8])
    q = f"{loc_blob} {issue_blob}".strip()
    q = re.sub(r"\s+", " ", q)
    if len(q) > max_chars:
        cut = q[: max_chars + 1]
        q = cut.rsplit(" ", 1)[0].strip() if " " in cut else cut[:max_chars].strip()
    return q


def _stash_pending_checkpoint_analysis(
    tool_context: ToolContext,
    *,
    formatted_results: List[Dict[str, Any]],
    search_query: str,
    user_query: str,
) -> None:
    """Stash structured analysis input for doculink → checkpoint_progress_agent transfer."""
    from property_agent.sub_agents.checkpoint_dual_format.dual_format_body import (
        optional_agents_for_progress_from_state,
        should_stash_checkpoint_optional_analysis,
    )

    if not should_stash_checkpoint_optional_analysis(tool_context.state, user_query):
        return
    requested = optional_agents_for_progress_from_state(tool_context.state)
    if not requested or not formatted_results:
        return

    blob = format_checkpoints_for_analysis_blob(formatted_results)
    pending: Dict[str, Any] = {
        "checkpoint_results": blob,
        "user_query": user_query,
        "search_query": search_query or "",
        "checkpoint_optional_agents": requested,
    }
    for key in (
        "context_doc_uris",
        "property_address",
        "property_id",
        "search_location",
    ):
        value = tool_context.state.get(key)
        if value is not None:
            pending[key] = value

    pending_json = json.dumps(pending, ensure_ascii=False)
    phase0 = build_phase0_checkpoint_dual_format(
        checkpoint_results=blob,
        user_query=user_query,
        requested_branches=requested,
    )
    phase0 = enrich_dual_format_markdown(phase0)
    stash_checkpoint_dual_format_in_state(tool_context.state, phase0)
    delta: Dict[str, Any] = {
        "checkpoint_results": blob,
        CHECKPOINT_ANALYSIS_PENDING_INPUT_STATE_KEY: pending_json,
        CHECKPOINT_ANALYSIS_PROGRESS_STATE_KEY: phase0,
        CHECKPOINT_ANALYSIS_DUAL_FORMAT_STATE_KEY: phase0,
        CHECKPOINT_RETRIEVAL_SEARCH_QUERY_STATE_KEY: search_query or "",
        "checkpoint_optional_agents": requested,
    }
    apply_tool_context_state_delta(tool_context, delta)
    bump_checkpoint_progress_emit_seq(tool_context.state)
    logger.info(
        "checkpoint retrieval: stashed pending analysis branches=%s blob_len=%d",
        requested,
        len(blob),
    )


def _stringify_function_response_payload(resp: Any) -> str:
    """Normalize tool/function_response payloads for visible-text extraction."""
    if resp is None:
        return ""
    if isinstance(resp, str):
        return resp.strip()
    if isinstance(resp, (dict, list)):
        try:
            return json.dumps(resp, ensure_ascii=False).strip()
        except (TypeError, ValueError):
            return ""
    try:
        return str(resp).strip()
    except Exception:
        return ""


def _extract_tool_visible_text(content: types.Content | None) -> str:
    """Visible model text plus string tool results (``function_response`` has no ``text`` part)."""
    if not content or not content.parts:
        return ""
    chunks: list[str] = []
    thought_chunks: list[str] = []
    for p in content.parts:
        if p.text:
            if getattr(p, "thought", False):
                thought_chunks.append(p.text)
            else:
                chunks.append(p.text)
        fr = getattr(p, "function_response", None) or getattr(
            p, "functionResponse", None
        )
        if fr is None:
            continue
        resp = getattr(fr, "response", None)
        blob = _stringify_function_response_payload(resp)
        if blob:
            chunks.append(blob)
    primary = "\n".join(chunks).strip()
    if primary:
        return primary
    # Gemini 3.x can surface the assistant answer only on thought-tagged parts; ADK's
    # output_key path also ignores those, so we use thought text only as a last resort.
    return "\n".join(thought_chunks).strip()


async def _forward_checkpoint_progress_to_parent(
    tool_context: ToolContext,
    body: str,
    *,
    branch: Optional[str] = None,
    state_delta: Optional[Dict[str, Any]] = None,
) -> None:
    """Append a progressive checkpoint analysis model event on the parent session."""
    if not (body or "").strip():
        return
    invocation_context = tool_context._invocation_context
    if invocation_context is None or invocation_context.session_service is None:
        return
    delta: Dict[str, Any] = dict(state_delta or {})
    if branch:
        delta[CHECKPOINT_BRANCH_COMPLETED_STATE_KEY] = branch
    event = Event(
        invocation_id=invocation_context.invocation_id,
        author=CHECKPOINT_PROGRESS_EVENT_AUTHOR,
        content=types.Content(role="model", parts=[types.Part(text=body)]),
        actions=EventActions(state_delta=delta) if delta else EventActions(),
    )
    try:
        await invocation_context.session_service.append_event(
            session=invocation_context.session,
            event=event,
        )
        logger.info(
            "checkpoint progress forwarded to parent session branch=%r chars=%d",
            branch or "",
            len(body),
        )
    except Exception:
        logger.exception("checkpoint progress forward to parent session failed")


class _LastNonEmptyTextAgentTool(AgentTool):
    """AgentTool variant: ADK may emit a trailing model turn with no visible text, which would make
    the stock AgentTool return ''. We return the last non-empty visible model text instead.

    We set ``skip_summarization`` while the nested runner executes so long tool payloads are
    not summarized away. Before returning, we **clear** that flag on ``tool_context.actions``:
    ADK copies those actions onto the outgoing function-response ``Event``, and when
    ``skip_summarization`` remains true, ``Event.is_final_response()`` is always true, so
    ``BaseLlmFlow`` ends the parent agent loop immediately after the tool — no follow-up model
    turn (ADK Web then shows no assistant message). Clearing restores one more LLM step for
    doculink to echo checkpoint output.
    """

    def __init__(
        self,
        agent: Agent,
        state_fallback_key: Optional[str] = None,
        parallel_state_key: Optional[str] = None,
        tool_input_schema: Optional[Type[BaseModel]] = None,
        forward_progress_events: bool = False,
    ):
        super().__init__(agent, skip_summarization=True)
        self._state_fallback_key = state_fallback_key
        self._parallel_state_key = parallel_state_key
        self._tool_input_schema = tool_input_schema
        self._forward_progress_events = forward_progress_events

    @override
    async def run_async(
        self,
        *,
        args: dict[str, Any],
        tool_context: ToolContext,
    ) -> Any:
        wrapped = getattr(self.agent, "name", type(self.agent).__name__)
        if wrapped == "checkpoint_agent":
            begin_checkpoint_request(tool_context.state)
        _nested_t0 = time.monotonic()
        logger.debug(
            "_LastNonEmptyTextAgentTool.run_async start wrapped=%r "
            "state_fallback_key=%r parallel_state_key=%r arg_keys=%s",
            wrapped,
            self._state_fallback_key,
            self._parallel_state_key,
            sorted(args.keys()) if isinstance(args, dict) else type(args).__name__,
        )
        if self.skip_summarization:
            tool_context.actions.skip_summarization = True
        try:
            input_schema = self._tool_input_schema or _get_input_schema(self.agent)
            if input_schema:
                payload_args = args
                if input_schema is CheckpointAnalysisInput:
                    payload_args = normalize_checkpoint_analysis_tool_args(args)
                input_value = input_schema.model_validate(payload_args)
                content = types.Content(
                    role="user",
                    parts=[
                        types.Part.from_text(
                            text=input_value.model_dump_json(exclude_none=True)
                        )
                    ],
                )
            else:
                content = types.Content(
                    role="user",
                    parts=[types.Part.from_text(text=args["request"])],
                )
            invocation_context = tool_context._invocation_context
            parent_app_name = (
                invocation_context.app_name if invocation_context else None
            )
            child_app_name = parent_app_name or self.agent.name
            plugins = (
                tool_context._invocation_context.plugin_manager.plugins
                if self.include_plugins
                else None
            )
            runner = Runner(
                app_name=child_app_name,
                agent=self.agent,
                artifact_service=ForwardingArtifactService(tool_context),
                session_service=InMemorySessionService(),
                memory_service=InMemoryMemoryService(),
                credential_service=tool_context._invocation_context.credential_service,
                plugins=plugins,
            )

            state_dict = {
                k: v
                for k, v in tool_context.state.to_dict().items()
                if not k.startswith("_adk")
            }
            session = await runner.session_service.create_session(
                app_name=child_app_name,
                user_id=tool_context._invocation_context.user_id,
                state=state_dict,
            )
            logger.debug(
                "_LastNonEmptyTextAgentTool child runner session_id=%s "
                "child_app_name=%r user_id=%r",
                session.id,
                child_app_name,
                session.user_id,
            )

            last_content: types.Content | None = None
            last_grounding_metadata = None
            last_non_empty = ""
            event_count = 0
            state_delta_updates = 0
            async with Aclosing(
                runner.run_async(
                    user_id=session.user_id,
                    session_id=session.id,
                    new_message=content,
                )
            ) as agen:
                async for event in agen:
                    event_count += 1
                    if event.actions.state_delta:
                        tool_context.state.update(event.actions.state_delta)
                        state_delta_updates += 1
                        logger.debug(
                            "_LastNonEmptyTextAgentTool event=%d state_delta_keys=%s",
                            event_count,
                            sorted(event.actions.state_delta.keys()),
                        )
                    if event.content:
                        last_content = event.content
                        last_grounding_metadata = event.grounding_metadata
                        vis = _extract_tool_visible_text(event.content)
                        if vis:
                            last_non_empty = vis
                        if (
                            self._forward_progress_events
                            and vis
                            and dual_format_has_valid_analysis_json(vis)
                        ):
                            author = getattr(event, "author", None) or ""
                            branch: Optional[str] = None
                            delta = (
                                event.actions.state_delta
                                if event.actions and event.actions.state_delta
                                else None
                            )
                            if isinstance(delta, dict):
                                raw_branch = delta.get(
                                    CHECKPOINT_BRANCH_COMPLETED_STATE_KEY
                                )
                                if isinstance(raw_branch, str):
                                    branch = raw_branch
                            if (
                                author == CHECKPOINT_PROGRESS_EVENT_AUTHOR
                                or branch is not None
                            ):
                                await _forward_checkpoint_progress_to_parent(
                                    tool_context,
                                    vis,
                                    branch=branch,
                                    state_delta=delta
                                    if isinstance(delta, dict)
                                    else None,
                                )
                        logger.debug(
                            "_LastNonEmptyTextAgentTool event=%d author=%r "
                            "visible_len=%d last_non_empty_len=%d",
                            event_count,
                            getattr(event, "author", None),
                            len(vis),
                            len(last_non_empty),
                        )

            await runner.close()

            def _nested_done_ms() -> int:
                return int((time.monotonic() - _nested_t0) * 1000)

            if last_content is None or last_content.parts is None:
                out = last_non_empty or ""
                logger.debug(
                    "_LastNonEmptyTextAgentTool no last_content; return_len=%d",
                    len(out),
                )
                logger.info(
                    "nested_agent_tool: done wrapped=%r duration_ms=%d events=%d "
                    "state_delta_batches=%d outcome=empty_content",
                    wrapped,
                    _nested_done_ms(),
                    event_count,
                    state_delta_updates,
                )
                return out
            merged_text = _extract_tool_visible_text(last_content)
            if not merged_text and last_non_empty:
                logger.debug(
                    "_LastNonEmptyTextAgentTool merged empty; using last_non_empty "
                    "(merged_len=%d last_non_empty_len=%d)",
                    len(merged_text or ""),
                    len(last_non_empty),
                )
                merged_text = last_non_empty

            output_schema = _get_output_schema(self.agent)
            if output_schema:
                tool_result = validate_schema(output_schema, merged_text)
                logger.debug(
                    "_LastNonEmptyTextAgentTool validated output_schema merged_len=%d "
                    "result_type=%s",
                    len(merged_text or ""),
                    type(tool_result).__name__,
                )
            else:
                tool_result = merged_text
                logger.debug(
                    "_LastNonEmptyTextAgentTool no output_schema merged_len=%d",
                    len(merged_text or ""),
                )

            if self.propagate_grounding_metadata and last_grounding_metadata:
                tool_context.state["temp:_adk_grounding_metadata"] = (
                    last_grounding_metadata
                )

            if (
                self._state_fallback_key
                and isinstance(tool_result, str)
                and not str(tool_result).strip()
            ):
                fb = tool_context.state.get(self._state_fallback_key)
                if isinstance(fb, str) and fb.strip():
                    logger.debug(
                        "_LastNonEmptyTextAgentTool state_fallback from %r len=%d",
                        self._state_fallback_key,
                        len(fb),
                    )
                    tool_result = fb

            if (
                self._parallel_state_key
                and isinstance(tool_result, str)
                and not str(tool_result).strip()
            ):
                par = tool_context.state.get(self._parallel_state_key)
                if isinstance(par, str) and par.strip():
                    logger.debug(
                        "_LastNonEmptyTextAgentTool parallel fallback key=%r par_len=%d",
                        self._parallel_state_key,
                        len(par),
                    )
                    ck_results = tool_context.state.get("checkpoint_results")
                    ck_blob = ck_results if isinstance(ck_results, str) else ""
                    tool_result = ensure_dual_format_body(
                        "",
                        parallel_results_json=par,
                        checkpoint_results=ck_blob,
                    )
                    logger.info(
                        "AgentTool %s: built dual-format tool result from %s (chars=%d)",
                        getattr(self.agent, "name", type(self.agent).__name__),
                        self._parallel_state_key,
                        len(tool_result),
                    )

            if isinstance(tool_result, str) and dual_format_is_passthrough_quality(
                tool_result
            ):
                tool_result = enrich_dual_format_markdown(tool_result)
                stash_checkpoint_dual_format_in_state(tool_context.state, tool_result)

            stashed = resolve_passthrough_dual_format_from_state(tool_context.state)
            if (
                stashed
                and isinstance(tool_result, str)
                and not dual_format_is_passthrough_quality(tool_result)
            ):
                logger.info(
                    "_LastNonEmptyTextAgentTool: using stashed dual-format for wrapped=%r "
                    "(tool_chars=%d stash_chars=%d)",
                    wrapped,
                    len(tool_result),
                    len(stashed),
                )
                tool_result = stashed

            ret_len = len(tool_result) if isinstance(tool_result, str) else None
            if wrapped == "checkpoint_agent":
                from property_agent.sub_agents.checkpoint_dual_format.dual_format_body import (
                    checkpoint_results_text_from_state,
                    ensure_checkpoint_analysis_pending_stashed,
                )

                blob = checkpoint_results_text_from_state(tool_context.state)
                if blob and not tool_context.state.get("checkpoint_results"):
                    tool_context.state["checkpoint_results"] = blob
                ensure_checkpoint_analysis_pending_stashed(tool_context.state)
                if isinstance(tool_result, str):
                    set_return_chars(tool_context.state, len(tool_result))
                    begin_executor_phase(tool_context.state)
            logger.debug(
                "_LastNonEmptyTextAgentTool.run_async end wrapped=%r "
                "return_type=%s return_len=%s",
                wrapped,
                type(tool_result).__name__,
                ret_len,
            )
            logger.info(
                "nested_agent_tool: done wrapped=%r duration_ms=%d events=%d "
                "state_delta_batches=%d outcome=ok return_len=%s",
                wrapped,
                _nested_done_ms(),
                event_count,
                state_delta_updates,
                ret_len,
            )
            return tool_result
        finally:
            if self.skip_summarization:
                tool_context.actions.skip_summarization = False


def ask_checkpoints_retrieval(
    user_query: str,
    property_id: str,  # Mandatory - required for property-specific checkpoint queries
    location: Optional[str] = None,
    checkpoint_ids: Optional[List[str]] = None,
    tool_context: ToolContext = None,
):
    """
    Retrieves relevant checkpoints using Firestore Vector Search based on semantic query matching.

    Args:
        user_query: Natural language query about checkpoints (e.g., "Show me checkpoints with water damage")
        property_id: Property ID (REQUIRED) - must be provided to query property-specific checkpoints
        location: Optional location filter (e.g., "Kitchen", "Car")
        checkpoint_ids: Optional list of specific checkpoint IDs to limit results to (when provided, only these checkpoints are considered)
        tool_context: Tool context containing user_id and session information

    Returns:
        ``{"checkpoints": [...], "search_query": str}`` — checkpoints carry analysis fields;
        ``search_query`` is a short phrase from locations and issue descriptions for
        downstream YouTube / shopping search. On failure or no matches, ``checkpoints``
        is empty and ``search_query`` is ``""``.
    """
    t0 = time.monotonic()

    def _elapsed_ms() -> int:
        return int((time.monotonic() - t0) * 1000)

    def _record_retrieval_timing() -> None:
        if tool_context is not None:
            record_retrieval_ms(tool_context.state, _elapsed_ms())

    try:
        ck_mode = "by_id" if checkpoint_ids and len(checkpoint_ids) > 0 else "vector"
        logger.info(
            "checkpoint_retrieval: start mode=%s property_id=%s "
            "user_query_len=%d location_set=%s checkpoint_id_count=%d",
            ck_mode,
            property_id or "",
            len(user_query or ""),
            bool(location and str(location).strip()),
            len(checkpoint_ids or []),
        )
        logger.debug(
            "checkpoint_retrieval: args user_query=%r location=%r checkpoint_ids=%r",
            user_query,
            location,
            checkpoint_ids,
        )

        # Get user_id from context
        user_id = (
            tool_context.state.get("user_id")
            or tool_context._invocation_context.session.user_id
        )
        logger.debug("checkpoint_retrieval: user_id=%s", user_id)

        # property_id is now mandatory in function signature, but check tool_context.state as fallback if somehow missing
        if not property_id:
            property_id = tool_context.state.get("property_id")
            logger.warning(
                f"property_id not provided as parameter, attempting to retrieve from tool_context.state: {property_id}"
            )

        if not user_id:
            logger.error(f"Missing user_id: user_id={user_id}")
            logger.info(
                "checkpoint_retrieval: end duration_ms=%d outcome=no_user checkpoints=0",
                _elapsed_ms(),
            )
            _record_retrieval_timing()
            return {"checkpoints": [], "search_query": ""}

        if not property_id:
            logger.error(
                "Missing property_id - checkpoint retrieval REQUIRES property_id. Cannot proceed without it."
            )
            logger.info(
                "checkpoint_retrieval: end duration_ms=%d outcome=no_property checkpoints=0",
                _elapsed_ms(),
            )
            _record_retrieval_timing()
            return {"checkpoints": [], "search_query": ""}

        logger.debug(
            "checkpoint_retrieval: resolved user_id=%s property_id=%s",
            user_id,
            property_id,
        )

        # Lazy import to avoid deployment issues
        from google.cloud import firestore

        # Initialize Firestore client
        db = firestore.Client()

        # If specific checkpoint IDs are provided, fetch those checkpoints directly
        if checkpoint_ids and len(checkpoint_ids) > 0:
            logger.debug(
                "checkpoint_retrieval: fetching by id count=%d ids=%r",
                len(checkpoint_ids),
                checkpoint_ids,
            )
            checkpoints = []
            checkpoints_ref = (
                db.collection("users")
                .document(user_id)
                .collection("properties")
                .document(property_id)
                .collection("checkpoints")
            )
            logger.debug(
                "checkpoint_retrieval: collection users/%s/properties/%s/checkpoints",
                user_id,
                property_id,
            )

            t_fetch = time.monotonic()
            for checkpoint_id in checkpoint_ids:
                try:
                    logger.debug("checkpoint_retrieval: fetch doc id=%s", checkpoint_id)
                    checkpoint_doc = checkpoints_ref.document(checkpoint_id).get()
                    if checkpoint_doc.exists:
                        checkpoint_data = checkpoint_doc.to_dict()
                        checkpoint_data["id"] = checkpoint_doc.id
                        checkpoints.append(checkpoint_data)
                        logger.debug(
                            "checkpoint_retrieval: loaded id=%s aiAnalysis=%s",
                            checkpoint_id,
                            bool(checkpoint_data.get("aiAnalysis")),
                        )
                    else:
                        logger.warning(
                            f"Checkpoint document {checkpoint_id} does not exist"
                        )
                except Exception as e:
                    logger.error(
                        f"Error fetching checkpoint {checkpoint_id}: {e}", exc_info=True
                    )

            logger.info(
                "checkpoint_retrieval: firestore_by_id fetch_duration_ms=%d "
                "fetched=%d requested=%d total_elapsed_ms=%d",
                int((time.monotonic() - t_fetch) * 1000),
                len(checkpoints),
                len(checkpoint_ids),
                _elapsed_ms(),
            )
            if not checkpoints:
                logger.warning(
                    f"None of the specified checkpoint IDs were found: {checkpoint_ids}"
                )
                logger.info(
                    "checkpoint_retrieval: end duration_ms=%d outcome=no_matches checkpoints=0",
                    _elapsed_ms(),
                )
                _record_retrieval_timing()
                return {"checkpoints": [], "search_query": ""}
        else:
            # Perform vector search when no specific checkpoint IDs provided
            _vs = time.monotonic()
            logger.debug(
                "checkpoint_retrieval: vector_search start query_len=%d",
                len(user_query or ""),
            )
            checkpoints = search_checkpoints_by_vector(
                db=db,
                user_id=user_id,
                property_id=property_id,
                query_text=user_query,
                limit=5,
                location=location,
            )
            logger.info(
                "checkpoint_retrieval: vector_search duration_ms=%d returned=%d",
                int((time.monotonic() - _vs) * 1000),
                len(checkpoints),
            )
            if not checkpoints:
                from property_agent.log_redaction import safe_text_preview

                logger.warning(
                    "No checkpoints found for query_len=%d preview=%r",
                    len(user_query or ""),
                    safe_text_preview(user_query, max_len=60),
                )
                logger.info(
                    "checkpoint_retrieval: end duration_ms=%d outcome=no_matches checkpoints=0",
                    _elapsed_ms(),
                )
                _record_retrieval_timing()
                return {"checkpoints": [], "search_query": ""}

        # Format checkpoints for agent consumption
        # Extract relevant information: summary, location, detected items, issues, etc.
        logger.debug(
            "checkpoint_retrieval: formatting checkpoint_count=%d",
            len(checkpoints),
        )
        t_fmt = time.monotonic()
        formatted_results = []
        for idx, checkpoint in enumerate(checkpoints):
            logger.debug(
                "checkpoint_retrieval: format %d/%d id=%s",
                idx + 1,
                len(checkpoints),
                checkpoint.get("id"),
            )
            checkpoint_id = checkpoint.get("id")
            ai_analysis = checkpoint.get("aiAnalysis", {})

            # Build a summary text from checkpoint data
            summary_parts = []
            if ai_analysis.get("summary"):
                summary_parts.append(f"Summary: {ai_analysis['summary']}")

            location = checkpoint.get("location") or ai_analysis.get("detectedAsset")
            if location:
                summary_parts.append(f"Location/Asset: {location}")

            detected_items = ai_analysis.get("detectedItems", [])
            if detected_items:
                items_text = ", ".join(detected_items[:5])  # Limit to first 5
                summary_parts.append(f"Detected items: {items_text}")

            issues = ai_analysis.get("issues", [])
            if issues:
                issue_descriptions = []
                for issue in issues[:3]:  # Limit to first 3 issues
                    if isinstance(issue, dict):
                        issue_descriptions.append(issue.get("description", ""))
                    elif isinstance(issue, str):
                        issue_descriptions.append(issue)

                if issue_descriptions:
                    issues_text = "; ".join(issue_descriptions)
                    summary_parts.append(f"Issues: {issues_text}")

            conditions = ai_analysis.get("conditions", [])
            if conditions:
                conditions_text = ", ".join(conditions[:3])  # Limit to first 3
                summary_parts.append(f"Conditions: {conditions_text}")

            # Get checkpoint name (prefer name, fallback to location or "Checkpoint")
            checkpoint_name = checkpoint.get("name") or location or "Checkpoint"

            # Include checkpoint name in the text summary for agent consumption
            if checkpoint_name and checkpoint_name != "Checkpoint":
                summary_parts.insert(0, f"Checkpoint Name: {checkpoint_name}")

            # Build formatted checkpoint data
            formatted_checkpoint = {
                "checkpointId": checkpoint_id,  # Keep ID for internal reference
                "checkpointName": checkpoint_name,  # Add name field
                "text": "\n".join(summary_parts)
                if summary_parts
                else "No summary available",
                "location": location,
                "createdAt": checkpoint.get("createdAt"),
                "summary": ai_analysis.get("summary", ""),
                "detectedItems": detected_items,
                "conditions": conditions,
                "issues": issues[:5] if issues else [],  # Limit issues for context
                "similarity_score": checkpoint.get("similarity_score", 0.0),
            }
            logger.debug(
                "formatted_checkpoint=%s",
                json.dumps(formatted_checkpoint, default=str, ensure_ascii=False),
            )

            formatted_results.append(formatted_checkpoint)
            logger.debug(
                "checkpoint_retrieval: formatted idx=%d text_len=%d",
                idx + 1,
                len(formatted_checkpoint.get("text") or ""),
            )

        search_query = build_search_query_from_checkpoints(formatted_results)
        search_query = refine_checkpoint_media_search_query(
            search_query, formatted_results
        )
        if formatted_results:
            logger.debug(
                "checkpoint_retrieval: sample_text_head=%r",
                (formatted_results[0].get("text") or "")[:200],
            )
        logger.debug(
            "checkpoint_retrieval: search_query for branches=%r",
            search_query,
        )
        logger.info(
            "checkpoint_retrieval: format duration_ms=%d checkpoints=%d",
            int((time.monotonic() - t_fmt) * 1000),
            len(formatted_results),
        )
        if tool_context is not None and search_query:
            tool_context.state[CHECKPOINT_RETRIEVAL_SEARCH_QUERY_STATE_KEY] = (
                search_query
            )
        if tool_context is not None and formatted_results:
            _stash_pending_checkpoint_analysis(
                tool_context,
                formatted_results=formatted_results,
                search_query=search_query,
                user_query=user_query,
            )
        logger.info(
            "checkpoint_retrieval: end duration_ms=%d outcome=ok checkpoints=%d "
            "search_query_len=%d",
            _elapsed_ms(),
            len(formatted_results),
            len(search_query or ""),
        )
        _record_retrieval_timing()
        return {"checkpoints": formatted_results, "search_query": search_query}
    except Exception as e:
        logger.error(f"Error retrieving checkpoints: {e}", exc_info=True)
        logger.info(
            "checkpoint_retrieval: end duration_ms=%d outcome=error checkpoints=0",
            _elapsed_ms(),
        )
        _record_retrieval_timing()
        return {"checkpoints": [], "search_query": ""}


checkpoint_agent = Agent(
    model=GLOBAL_GEMINI_MODEL,
    name="checkpoint_agent",
    instruction=checkpoint_agent_instruction(),
    input_schema=DocsInput,  # Reuse DocsInput schema (user_query, property_id, checkpoint_optional_agents, etc.)
    tools=[
        ask_checkpoints_retrieval,
    ],
    disallow_transfer_to_parent=True,
    output_key="checkpoint_result",
    after_model_callback=checkpoint_agent_after_model_callback,
)

__all__ = ["checkpoint_agent"]
