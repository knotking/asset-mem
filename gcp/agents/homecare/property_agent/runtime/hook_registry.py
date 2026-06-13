"""Homecare ``HookRegistry`` — vertical turn/tool hooks for the root executor."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from types import SimpleNamespace
from typing import Any, Dict, Optional

from agent_platform.adk.bridge import llm_response_to_turn_outcome
from agent_platform.adk.context_bridge import (
    adk_callback_context_from,
    adk_tool_context_from,
)
from agent_platform.core.ports import ToolCallContext, TurnContext, TurnOutcome
from agent_platform.core.routing.resolved_turn import session_events

from property_agent.manifest import PropertyPlugin
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
from property_agent.routing.constants import USER_DOCS_PASSTHROUGH_STATE_KEY
from property_agent.routing.post_structured_analysis import structured_analysis_ran
from property_agent.routing.query_mode import snapshot_session_analysis_context

logger = logging.getLogger(__name__)


@dataclass
class PropertyHookRegistry:
    """Framework-neutral hooks for property/homecare root agent callbacks."""

    plugin: PropertyPlugin

    def before_turn(
        self,
        ctx: TurnContext,
        *,
        llm_request: Any | None = None,
    ) -> TurnOutcome | None:
        adk_ctx = adk_callback_context_from(ctx)
        property_id = self.plugin.resolve_property_id(adk_ctx.state)
        if property_id:
            adk_ctx.state.setdefault("property_id", property_id)
        try:
            response = self.plugin.prepare_before_model_turn(
                adk_ctx,
                llm_request=llm_request,
            )
        except Exception:
            logger.exception("prepare_before_model_turn failed")
            response = fail_closed_before_model_on_resolve_error(
                adk_ctx,
                llm_request=llm_request,
            )
        return llm_response_to_turn_outcome(response)

    def before_tool(
        self,
        ctx: ToolCallContext,
        tool_name: str,
        args: dict[str, Any],
    ) -> dict[str, Any] | None:
        tool_context = adk_tool_context_from(ctx)
        tool = SimpleNamespace(name=tool_name)
        blocked = conversational_before_tool(tool, args, tool_context)
        if blocked is not None:
            return blocked

        uid = tool_context._invocation_context.session.user_id
        tool_context.state["user_id"] = uid
        from agent_platform.core.observability.logging_context import (
            bind_auth_uid,
            bind_correlation_id,
            extract_correlation_id_from_json_dict,
        )

        bind_auth_uid(uid)
        cid = extract_correlation_id_from_json_dict(tool_context.state)
        bind_correlation_id(cid)
        property_id = args.get("property_id")
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

    def after_tool(
        self,
        ctx: ToolCallContext,
        tool_name: str,
        args: dict[str, Any],
        result: Any,
    ) -> None:
        tool_context = adk_tool_context_from(ctx)
        if tool_name == "user_docs_retrieval":
            resolved = tool_context.state.get("resolved_turn")
            route = resolved.get("route") if isinstance(resolved, dict) else None
            if (
                route == "user_docs"
                or str(tool_context.state.get("primary_agent") or "").strip().lower()
                == "docs"
            ):
                tool_context.state[USER_DOCS_PASSTHROUGH_STATE_KEY] = True
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
            if isinstance(result, str):
                result_text = result
            elif isinstance(result, dict):
                raw = result.get("result")
                if isinstance(raw, str):
                    result_text = raw
            if result_text.strip() and not result_text.startswith("Skipped:"):
                store_report_retrieval_last_result(tool_context.state, result_text)
                if inv_id_str:
                    store_invocation_report_result(inv_id_str, result_text)
                    mark_report_retrieval_served(tool_context.state, inv_id_str)
        from property_agent.checkpoint.constants import CHECKPOINT_ANALYSIS_TOOL

        if tool_name == CHECKPOINT_ANALYSIS_TOOL:
            if structured_analysis_ran(args, result, tool_context.state):
                mark_executor_invocation_structured_analysis(tool_context.state)
            if tool_context.state.get("checkpoint_analysis") or tool_context.state.get(
                "checkpoint_parallel_results"
            ):
                snapshot_session_analysis_context(tool_context.state)

    def after_turn(self, ctx: TurnContext) -> None:
        adk_ctx = adk_callback_context_from(ctx)
        if adk_ctx.state.get("checkpoint_analysis") or adk_ctx.state.get(
            "checkpoint_parallel_results"
        ):
            snapshot_session_analysis_context(adk_ctx.state)
        self._maybe_extract_pending_offer(adk_ctx)
        clear_executor_invocation_analysis_flag(adk_ctx.state)
        self._maybe_update_conversation_summary(adk_ctx)
        self.plugin.prune_heavy_checkpoint_state(adk_ctx.state)

    async def ingest_turn_memory(self, callback_context: Any) -> None:
        await self.plugin.ingest_invocation_to_memory_bank(
            callback_context,
            agent_name=self.plugin.property_agent_name,
            include_checkpoint_facts=True,
        )

    def after_model(self, callback_context: Any) -> None:
        if callback_context.state.get("checkpoint_analysis") or callback_context.state.get(
            "checkpoint_parallel_results"
        ):
            mark_checkpoint_response_kind(callback_context, kind="analysis")

    def _maybe_update_conversation_summary(self, callback_context: Any) -> None:
        from property_agent.routing.conversation_summary import (
            conversation_summary_enabled,
            maybe_update_conversation_summary,
        )

        if not conversation_summary_enabled():
            return
        maybe_update_conversation_summary(
            callback_context.state,
            session_events(callback_context),
        )

    def _maybe_extract_pending_offer(self, callback_context: Any) -> None:
        from property_agent.routing.pending_offer_extract import (
            maybe_set_pending_from_assistant_reply,
            maybe_set_pending_from_suggested_actions,
            pending_offer_extract_enabled,
        )
        from property_agent.routing.recent_dialogue import last_assistant_reply_text

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
