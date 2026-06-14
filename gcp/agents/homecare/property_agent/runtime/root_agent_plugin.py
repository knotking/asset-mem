"""Property plugin adapter for ``agent_framework.runtime.build_root_agent``."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any, Callable, Dict, Optional

from dotenv import load_dotenv
from google.adk.agents.callback_context import CallbackContext
from google.adk.agents.context import Context
from google.adk.models.llm_request import LlmRequest
from google.adk.models.llm_response import LlmResponse
from google.adk.tools import BaseTool, ToolContext

from agent_framework.observability.logging_context import (
    extract_correlation_id_from_json_dict,
    install_auth_uid_logging,
    suppress_otel_context_detach_noise,
)
from agent_framework.runtime.build_root_agent import RootAgentPlugin, build_root_agent
from agent_framework.runtime.logging_plugin import LoggingRootAgentPlugin
from property_agent.manifest import PropertyPlugin, load_property_plugin
from property_agent.routing.conversational_callbacks import (
    conversational_before_tool,
    fail_closed_before_model_on_resolve_error,
    mark_checkpoint_response_kind,
)
from property_agent.routing.conversational_intent import (
    clear_executor_invocation_analysis_flag,
    mark_executor_invocation_structured_analysis,
    resolve_user_query_from_state,
)
from property_agent.routing.post_structured_analysis import structured_analysis_ran
from property_agent.routing.query_mode import snapshot_session_analysis_context
from property_agent.routing.single_loop_routing import arm_user_docs_passthrough
from property_agent.observability.lifecycle_events import (
    PHASE_ENGINE_BEFORE_MODEL,
    emit_lifecycle_from_callback,
)
from property_agent.observability.turn_request_timing import mark

load_dotenv()
install_auth_uid_logging(level=logging.INFO)
suppress_otel_context_detach_noise()

logger = logging.getLogger(__name__)


@dataclass
class PropertyRootAgentPlugin(LoggingRootAgentPlugin):
    """ADK root-agent hooks for the property/homecare vertical."""

    plugin: PropertyPlugin
    root_agent_name: str = "property_agent"
    root_agent_description: str = "Agent that manages and executes homecare-related tasks."

    @property
    def global_gemini_model(self) -> Any:
        return self.plugin.global_gemini_model

    @property
    def executor_instructions(self) -> Callable[[], str]:
        return self.plugin.property_agent_executor_instructions

    @property
    def executor_input_schema(self) -> type:
        return self.plugin.diagnosis_input_schema

    @property
    def build_executor_tools(self) -> Callable[[Callable[[], bool]], list]:
        return self.plugin.build_executor_tools

    @property
    def memory_preload_enabled(self) -> Callable[[], bool]:
        return self.plugin.memory_preload_enabled

    def before_model_callback(
        self, callback_context: Context, llm_request: LlmRequest
    ) -> Optional[LlmResponse]:
        property_id = self.plugin.resolve_property_id(callback_context.state)
        if property_id:
            callback_context.state.setdefault("property_id", property_id)
        self.bind_request_context(callback_context)
        logger.debug(
            "ADK before_model agent_name=%s invocation_id=%s",
            getattr(callback_context, "agent_name", None),
            getattr(callback_context, "invocation_id", None),
        )
        mark("before_model_start")
        emit_lifecycle_from_callback(
            callback_context,
            phase=PHASE_ENGINE_BEFORE_MODEL,
            state_key="_lifecycle_emitted_engine.before_model",
        )
        try:
            return self.plugin.prepare_before_model_turn(
                callback_context, llm_request=llm_request
            )
        except Exception:
            logger.exception("prepare_before_model_turn failed")
            return fail_closed_before_model_on_resolve_error(
                callback_context,
                llm_request=llm_request,
            )
        finally:
            mark("before_model_end")

    def after_model_callback(
        self, callback_context: CallbackContext, llm_response: LlmResponse
    ) -> Optional[LlmResponse]:
        self.unbind_request_context()
        if callback_context.state.get("checkpoint_analysis") or callback_context.state.get(
            "checkpoint_parallel_results"
        ):
            mark_checkpoint_response_kind(callback_context, kind="analysis")
        return None

    def after_tool_callback(
        self,
        tool: BaseTool,
        args: Dict[str, Any],
        tool_context: ToolContext,
        tool_response: dict,
    ) -> Optional[dict]:
        self.unbind_request_context()
        tool_name = getattr(tool, "name", None) or type(tool).__name__
        if tool_name == "user_docs_retrieval":
            resolved = tool_context.state.get("resolved_turn")
            route = resolved.get("route") if isinstance(resolved, dict) else None
            arm_user_docs_passthrough(
                tool_context.state,
                tool_response=tool_response,
                route=route,
                primary_agent=tool_context.state.get("primary_agent"),
            )
        if tool_name == "report_retrieval":
            from property_agent.reports.retrieval import (
                mark_report_retrieval_served,
                store_invocation_report_result,
                store_report_retrieval_last_result,
            )

            inv_id = getattr(
                getattr(tool_context, "_invocation_context", None),
                "invocation_id",
                None,
            )
            inv_id_str = str(inv_id).strip() if inv_id is not None else ""
            result_text = ""
            if isinstance(tool_response, str):
                result_text = tool_response
            elif isinstance(tool_response, dict):
                raw = tool_response.get("result")
                if isinstance(raw, str):
                    result_text = raw
            if result_text.strip() and not result_text.startswith("Skipped:"):
                store_report_retrieval_last_result(tool_context.state, result_text)
                if inv_id_str:
                    store_invocation_report_result(inv_id_str, result_text)
                    mark_report_retrieval_served(tool_context.state, inv_id_str)
        from property_agent.checkpoint.constants import CHECKPOINT_ANALYSIS_TOOL

        if tool_name == CHECKPOINT_ANALYSIS_TOOL:
            if structured_analysis_ran(args, tool_response, tool_context.state):
                mark_executor_invocation_structured_analysis(tool_context.state)
            if tool_context.state.get("checkpoint_analysis") or tool_context.state.get(
                "checkpoint_parallel_results"
            ):
                snapshot_session_analysis_context(tool_context.state)
        return None

    async def after_agent_callback(self, callback_context: CallbackContext) -> None:
        if callback_context.state.get("checkpoint_analysis") or callback_context.state.get(
            "checkpoint_parallel_results"
        ):
            snapshot_session_analysis_context(callback_context.state)
        self._maybe_extract_pending_offer(callback_context)
        clear_executor_invocation_analysis_flag(callback_context.state)
        self._maybe_update_conversation_summary(callback_context)
        self.plugin.prune_heavy_checkpoint_state(callback_context.state)
        await self.plugin.ingest_invocation_to_memory_bank(
            callback_context,
            agent_name=self.plugin.property_agent_name,
            include_checkpoint_facts=True,
        )

    def _maybe_update_conversation_summary(self, callback_context: CallbackContext) -> None:
        from property_agent.routing.conversation_summary import (
            conversation_summary_enabled,
            maybe_update_conversation_summary,
        )
        if not conversation_summary_enabled():
            return
        from agent_framework.routing.resolved_turn import session_events

        maybe_update_conversation_summary(
            callback_context.state,
            session_events(callback_context),
        )

    def _maybe_extract_pending_offer(self, callback_context: CallbackContext) -> None:
        from property_agent.routing.pending_offer_extract import (
            maybe_set_pending_from_assistant_reply,
            pending_offer_extract_enabled,
        )
        from property_agent.routing.recent_dialogue import last_assistant_reply_text
        from agent_framework.routing.resolved_turn import session_events

        if not pending_offer_extract_enabled():
            return
        events = session_events(callback_context)
        inv_id = getattr(callback_context, "invocation_id", None)
        inv_id_str = str(inv_id).strip() if inv_id is not None else None
        assistant_text = last_assistant_reply_text(
            events,
            current_invocation_id=inv_id_str,
            require_question=True,
        )
        if not assistant_text:
            assistant_text = last_assistant_reply_text(
                events,
                current_invocation_id=inv_id_str,
            )
        if assistant_text:
            uq = resolve_user_query_from_state(callback_context.state)
            maybe_set_pending_from_assistant_reply(
                callback_context.state,
                assistant_text=assistant_text,
                user_query=uq,
            )
            return
        from property_agent.routing.pending_offer_extract import (
            maybe_set_pending_from_suggested_actions,
        )

        if maybe_set_pending_from_suggested_actions(callback_context.state):
            return
        assistant_text = last_assistant_reply_text(events, require_question=True)
        if not assistant_text:
            assistant_text = last_assistant_reply_text(events)
        if not assistant_text:
            return
        uq = resolve_user_query_from_state(callback_context.state)
        maybe_set_pending_from_assistant_reply(
            callback_context.state,
            assistant_text=assistant_text,
            user_query=uq,
        )

    def before_tool_callback(
        self,
        tool: BaseTool,
        args: Dict[str, Any],
        tool_context: ToolContext,
        **kwargs: Any,
    ) -> Optional[dict]:
        blocked = conversational_before_tool(tool, args, tool_context, **kwargs)
        if blocked is not None:
            return blocked

        uid = tool_context._invocation_context.session.user_id
        tool_context.state["user_id"] = uid
        from agent_framework.observability.logging_context import (
            bind_auth_uid,
            bind_correlation_id,
        )

        bind_auth_uid(uid)
        cid = extract_correlation_id_from_json_dict(tool_context.state)
        bind_correlation_id(cid)
        property_id = args.get("property_id")
        tool_name = getattr(tool, "name", None) or type(tool).__name__
        arg_keys = sorted(args.keys()) if isinstance(args, dict) else []
        logger.debug(
            "ADK before_tool tool=%s arg_keys=%s has_property_id_arg=%s",
            tool_name,
            arg_keys,
            property_id is not None,
        )
        from property_agent.checkpoint.constants import (
            CHECKPOINT_ANALYSIS_TOOL,
            CHECKPOINT_LIST_TOOL,
        )
        from property_agent.checkpoint.tool_guards import (
            prepare_analyze_checkpoints_tool,
            prepare_list_checkpoints_tool,
        )

        if tool_name == CHECKPOINT_LIST_TOOL and isinstance(args, dict):
            prepare_list_checkpoints_tool(tool_context.state, args)
        elif tool_name == CHECKPOINT_ANALYSIS_TOOL and isinstance(args, dict):
            uq = resolve_user_query_from_state(tool_context.state) or str(
                args.get("user_query") or ""
            )
            guarded = prepare_analyze_checkpoints_tool(
                tool_context.state, args, user_query=uq
            )
            if guarded is not None:
                return guarded
        if property_id:
            tool_context.state["property_id"] = property_id
            logger.info("property_id %s set in tool context", property_id)
        else:
            from property_agent.observability.log_redaction import redact_tool_args_for_log

            logger.warning(
                "property_id not found in args for tool=%s: %s",
                tool_name,
                redact_tool_args_for_log(args),
            )
        return None


def build_property_root_agent(plugin: PropertyPlugin | None = None):
    if plugin is None:
        plugin = load_property_plugin()
    adapter: RootAgentPlugin = PropertyRootAgentPlugin(plugin=plugin)
    return build_root_agent(adapter)
