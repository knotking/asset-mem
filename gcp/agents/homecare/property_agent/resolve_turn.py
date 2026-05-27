"""Turn resolution: LLM-only routing + state apply + executor inject."""

from __future__ import annotations

import json
import logging
import re
from dataclasses import asdict, dataclass, field
from typing import Any, Literal, Mapping, Optional

from google.genai import types

from .conversational_intent import (
    CONVERSATIONAL_TURN_STATE_KEY,
    build_conversational_reply,
    clear_executor_invocation_analysis_flag,
    last_turn_delivered_checkpoint_analysis,
    resolve_property_address_from_state,
    resolve_user_query_from_state,
)
from .context_only_turn import (
    build_context_only_response,
    should_short_circuit_context_only_turn,
)
from .session_analysis_store import (
    maybe_hydrate_session_analysis_from_firestore,
    resolve_user_id_from_context,
)
from .memory_bank import resolve_property_id
from .query_mode import (
    SESSION_WORKING_MEMORY_SNAPSHOT_KEY,
    QueryModeKind,
    format_session_working_memory_block,
    should_answer_provider_from_context,
    snapshot_session_analysis_context,
)

logger = logging.getLogger(__name__)

RESOLVED_TURN_STATE_KEY = "resolved_turn"
RESOLVE_APPLIED_INVOCATION_KEY = "_resolve_turn_invocation_id"
USER_DOCS_PASSTHROUGH_STATE_KEY = "_executor_user_docs_passthrough"

RouteKind = Literal["none", "checkpoint", "user_docs", "knowledge_base"]
IntentKind = Literal["greeting", "capabilities", "acknowledgment", "substantive"]
UserGoalKind = Literal["answer_from_context", "new_analysis", "replay_deliverable"]

CASUAL_INTENTS = frozenset({"greeting", "capabilities", "acknowledgment"})


@dataclass
class ResolvedTurn:
    """Machine-readable plan for the executor LLM (injected each substantive turn)."""

    intent: IntentKind
    route: RouteKind
    expanded_user_query: str
    retrieval_only: bool
    run_optional_agents: list[str] = field(default_factory=list)
    user_goal: UserGoalKind = "answer_from_context"
    query_mode: QueryModeKind = "interpret_session"
    menu_index: Optional[int] = None
    capability_key: Optional[str] = None
    resolve_source: str = "llm"

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    @property
    def is_casual(self) -> bool:
        return self.intent in CASUAL_INTENTS


def _session_events(ctx: Any) -> list:
    invocation = getattr(ctx, "_invocation_context", None)
    if invocation is None:
        return []
    session = getattr(invocation, "session", None)
    if session is None:
        return []
    return list(getattr(session, "events", None) or [])


def _invocation_id(ctx: Any) -> Optional[str]:
    invocation = getattr(ctx, "_invocation_context", None)
    if invocation is None:
        return None
    return getattr(invocation, "invocation_id", None)


def resolve_turn(
    ctx: Any,
    *,
    llm_request: Any = None,
) -> ResolvedTurn:
    """LLM-only routing (see ``resolve_turn_llm.resolve_turn_llm``)."""
    from .resolve_turn_llm import resolve_turn_llm

    return resolve_turn_llm(ctx, llm_request=llm_request)


def apply_resolved_turn_to_state(state: Any, resolved: ResolvedTurn) -> None:
    """Persist resolve output and sync checkpoint_optional_agents for tools."""
    if state is None or not hasattr(state, "__setitem__"):
        return

    state[RESOLVED_TURN_STATE_KEY] = resolved.to_dict()
    if resolved.expanded_user_query:
        state["user_query"] = resolved.expanded_user_query

    if resolved.is_casual or resolved.route == "none":
        state[CONVERSATIONAL_TURN_STATE_KEY] = True
        state["_saved_checkpoint_optional_agents"] = state.get(
            "checkpoint_optional_agents"
        )
        state["checkpoint_optional_agents"] = []
        return

    state[CONVERSATIONAL_TURN_STATE_KEY] = False

    if resolved.route in ("user_docs", "knowledge_base"):
        _clear_checkpoint_passthrough_stash(state)
        state["checkpoint_optional_agents"] = []
        return

    if resolved.run_optional_agents:
        session_query = str(
            state.get("user_query") or resolved.expanded_user_query or ""
        )
        if should_answer_provider_from_context(session_query, state=state):
            snapshot_session_analysis_context(state)
            if state.get("checkpoint_optional_agents"):
                state["_checkpoint_optional_agents_ui"] = state.get(
                    "checkpoint_optional_agents"
                )
            state["checkpoint_optional_agents"] = []
            return
        _clear_checkpoint_passthrough_stash(state)
        if hasattr(state, "__setitem__"):
            state["checkpoint_parallel_results"] = None
        ui = state.get("checkpoint_optional_agents") or state.get(
            "_checkpoint_optional_agents_ui"
        )
        if isinstance(ui, list) and ui:
            filtered = [b for b in resolved.run_optional_agents if b in ui]
            state["checkpoint_optional_agents"] = filtered or list(
                resolved.run_optional_agents
            )
        else:
            state["checkpoint_optional_agents"] = list(resolved.run_optional_agents)
    elif resolved.retrieval_only:
        if state.get("checkpoint_optional_agents"):
            state["_checkpoint_optional_agents_ui"] = state.get(
                "checkpoint_optional_agents"
            )
        state["checkpoint_optional_agents"] = []
        if resolved.user_goal == "answer_from_context":
            snapshot_session_analysis_context(state)
        else:
            _clear_checkpoint_passthrough_stash(state)


def _clear_checkpoint_passthrough_stash(state: Any) -> None:
    """Drop stale checkpoint dual-format state so docs turns are not overwritten."""
    if state is None or not hasattr(state, "__setitem__"):
        return
    for key in (
        "checkpoint_analysis_dual_format",
        "checkpoint_analysis_progress",
        "checkpoint_parallel_results",
        "checkpoint_result",
        "checkpoint_last_response_kind",
    ):
        if key in state:
            state[key] = None


def resolved_turn_from_state(state: Mapping[str, Any] | None) -> Optional[ResolvedTurn]:
    if not state:
        return None
    raw = state.get(RESOLVED_TURN_STATE_KEY)
    if not isinstance(raw, dict):
        return None
    try:
        return ResolvedTurn(
            intent=raw.get("intent", "substantive"),
            route=raw.get("route", "checkpoint"),
            expanded_user_query=str(raw.get("expanded_user_query") or ""),
            retrieval_only=bool(raw.get("retrieval_only", True)),
            run_optional_agents=list(raw.get("run_optional_agents") or []),
            user_goal=(
                raw.get("user_goal")
                if raw.get("user_goal")
                in ("answer_from_context", "new_analysis", "replay_deliverable")
                else "answer_from_context"
            ),
            query_mode=(
                raw.get("query_mode")
                if raw.get("query_mode")
                in (
                    "interpret_session",
                    "branch_issue_search",
                    "branch_entity_search",
                    "branch_explicit",
                )
                else "interpret_session"
            ),
            menu_index=raw.get("menu_index"),
            capability_key=raw.get("capability_key"),
            resolve_source=str(raw.get("resolve_source") or "llm"),
        )
    except (TypeError, ValueError):
        return None


def requests_optional_analysis_from_resolved(
    state: Mapping[str, Any] | None,
    *,
    user_query: str = "",
) -> bool:
    """Enforce optional analysis only from resolve output."""
    _ = user_query
    resolved = resolved_turn_from_state(state)
    if resolved is None or resolved.is_casual:
        return False
    return bool(resolved.run_optional_agents) and not resolved.retrieval_only


def format_resolved_turn_block(
    resolved: ResolvedTurn,
    *,
    state: Mapping[str, Any] | None = None,
) -> str:
    payload = resolved.to_dict()
    payload["ui_context_note"] = (
        "primary_agent, checkpoint_ids, context_doc_uris, and UI optional toggles "
        "are context only — follow this block, not UI fields."
    )
    blocks = ["[RESOLVED_TURN]\n" f"{json.dumps(payload, indent=2)}\n" "[/RESOLVED_TURN]"]
    if state is not None and _should_inject_session_working_memory(resolved, state):
        memory = format_session_working_memory_block(state)
        if memory:
            blocks.append(memory)
    return "\n\n".join(blocks)


def _should_inject_session_working_memory(
    resolved: ResolvedTurn,
    state: Mapping[str, Any],
) -> bool:
    """Inject compact facts for follow-ups so the executor need not re-read full transcripts."""
    if resolved.user_goal == "answer_from_context":
        return True
    if resolved.retrieval_only and state.get(SESSION_WORKING_MEMORY_SNAPSHOT_KEY):
        return True
    return False


def _ensure_generate_content_config(llm_request: Any) -> Any:
    config = getattr(llm_request, "config", None)
    if config is None:
        config = types.GenerateContentConfig()
        llm_request.config = config
    return config


def _system_instruction_text(llm_request: Any) -> str:
    config = getattr(llm_request, "config", None)
    if config is None:
        return ""
    si = getattr(config, "system_instruction", None)
    if si is None:
        return ""
    if isinstance(si, str):
        return si
    if isinstance(si, types.Content):
        parts = getattr(si, "parts", None) or []
        return "".join((getattr(part, "text", None) or "") for part in parts)
    return str(si)


def inject_resolved_turn_into_llm_request(
    llm_request: Any,
    resolved: ResolvedTurn,
    *,
    state: Mapping[str, Any] | None = None,
) -> None:
    """Append resolved JSON to the executor system instruction for this turn."""
    block = format_resolved_turn_block(resolved, state=state)
    config = _ensure_generate_content_config(llm_request)
    existing = _system_instruction_text(llm_request).strip()
    if "[RESOLVED_TURN]" in existing:
        existing = re.sub(
            r"\[RESOLVED_TURN\][\s\S]*?\[/RESOLVED_TURN\]",
            "",
            existing,
        ).strip()
    if "[SESSION_WORKING_MEMORY]" in existing:
        existing = re.sub(
            r"\[SESSION_WORKING_MEMORY\][\s\S]*?\[/SESSION_WORKING_MEMORY\]\n?",
            "",
            existing,
        ).strip()
    combined = f"{existing}\n\n{block}" if existing else block
    # ADK eval AgentDetails expects instructions as str (not genai Content).
    config.system_instruction = combined


def _take_user_docs_passthrough(state: Any) -> Optional[str]:
    if state is None or not hasattr(state, "get"):
        return None
    if not state.get(USER_DOCS_PASSTHROUGH_STATE_KEY):
        return None
    result = state.get("user_docs_result")
    state[USER_DOCS_PASSTHROUGH_STATE_KEY] = False
    if isinstance(result, str) and result.strip():
        return result.strip()
    return None


def _plain_llm_response(text: str) -> Any:
    from google.adk.models.llm_response import LlmResponse

    return LlmResponse(
        content=types.Content(role="model", parts=[types.Part(text=text)]),
    )


def prepare_before_model_turn(
    ctx: Any,
    *,
    llm_request: Any = None,
) -> Optional[Any]:
    """
    LLM resolve → canned reply for casual intents, else inject [RESOLVED_TURN] for executor.

    Returns LlmResponse to short-circuit the executor, or None to run the executor LLM.
    """
    state = getattr(ctx, "state", None)
    events = _session_events(ctx)
    inv_id = _invocation_id(ctx)

    uid = resolve_user_id_from_context(ctx)
    property_id = resolve_property_id(state)
    if state is not None and uid:
        state.setdefault("user_id", uid)
    maybe_hydrate_session_analysis_from_firestore(
        state,
        user_id=uid,
        property_id=property_id,
    )

    passthrough = _take_user_docs_passthrough(state)
    if passthrough:
        logger.info(
            "resolve_turn user_docs passthrough chars=%d",
            len(passthrough),
        )
        return _plain_llm_response(passthrough)

    if inv_id and state is not None and state.get(RESOLVE_APPLIED_INVOCATION_KEY) == inv_id:
        existing = resolved_turn_from_state(state)
        if existing is not None and not existing.is_casual:
            if llm_request is not None:
                inject_resolved_turn_into_llm_request(
                    llm_request, existing, state=state
                )
            logger.debug(
                "resolve_turn skip re-resolve invocation_id=%s route=%s",
                inv_id,
                existing.route,
            )
            return None

    clear_executor_invocation_analysis_flag(state)
    resolved = resolve_turn(ctx, llm_request=llm_request)
    apply_resolved_turn_to_state(state, resolved)
    if inv_id and state is not None:
        state[RESOLVE_APPLIED_INVOCATION_KEY] = inv_id

    if resolved.is_casual:
        prior_analysis = (
            resolved.intent == "acknowledgment"
            and last_turn_delivered_checkpoint_analysis(
                events,
                current_invocation_id=inv_id,
                state=state,
            )
        )
        address = resolve_property_address_from_state(state)
        text = build_conversational_reply(
            resolved.intent,
            property_address=address,
            prior_analysis=prior_analysis,
            state=state,
        )
        logger.info(
            "resolve_turn casual intent=%s source=%s query=%r",
            resolved.intent,
            resolved.resolve_source,
            (resolve_user_query_from_state(state) or "")[:80],
        )
        return _plain_llm_response(text)

    user_query = (
        resolve_user_query_from_state(state) or resolved.expanded_user_query or ""
    )
    if should_short_circuit_context_only_turn(
        resolved, state=state, user_query=user_query
    ):
        context_text = build_context_only_response(
            resolved,
            state=state,
            session_events=events,
            user_query=user_query,
            current_invocation_id=inv_id,
        )
        if context_text:
            if state is not None and hasattr(state, "__setitem__"):
                state["_context_only_short_circuit"] = True
            logger.info(
                "resolve_turn context_only_short_circuit user_goal=%s "
                "query_mode=%s chars=%d query=%r",
                resolved.user_goal,
                resolved.query_mode,
                len(context_text),
                user_query[:80],
            )
            return _plain_llm_response(context_text)

    if llm_request is not None:
        inject_resolved_turn_into_llm_request(llm_request, resolved, state=state)
    logger.info(
        "resolve_turn substantive source=%s route=%s user_goal=%s query_mode=%s "
        "retrieval_only=%s optional=%r query=%r",
        resolved.resolve_source,
        resolved.route,
        resolved.user_goal,
        resolved.query_mode,
        resolved.retrieval_only,
        resolved.run_optional_agents,
        (resolved.expanded_user_query or "")[:80],
    )
    return None
