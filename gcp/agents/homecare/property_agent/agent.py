import logging
from typing import Any, Dict, Optional

from dotenv import load_dotenv
from google.adk.agents import Agent
from google.adk.agents.callback_context import CallbackContext
from google.adk.agents.context import Context
from google.adk.models.llm_request import LlmRequest
from google.adk.models.llm_response import LlmResponse
from google.adk.tools import BaseTool, ToolContext
from google.adk.tools.agent_tool import AgentTool

from .agent_inputs import DiagnosisInput, DocsInput
from .logging_context import (
    bind_auth_uid,
    bind_correlation_id,
    extract_correlation_id_from_json_dict,
    install_auth_uid_logging,
    unbind_auth_uid,
    unbind_correlation_id,
)
from .model_config import GLOBAL_GEMINI_MODEL
from .prompts import doculink_agent_system_instruction, root_agent_instructions
from .sub_agents.checkpoint_agent.agent import checkpoint_agent, _LastNonEmptyTextAgentTool
from .sub_agents.checkpoint_analysis_agent.agent import checkpoint_progress_agent
from .sub_agents.checkpoint_dual_format_guard import (
    doculink_after_model_callback,
    doculink_progressive_streaming_callback,
    ensure_checkpoint_analysis_pending_stashed,
    sync_checkpoint_tool_args_to_state,
)
from .sub_agents.knowledge_base_agent import knowledge_base_agent
from .sub_agents.user_docs_agent import user_docs_agent


load_dotenv()
install_auth_uid_logging(level=logging.INFO)

logger = logging.getLogger(__name__)


def _uid_from_context(ctx: Context) -> Optional[str]:
    uid = getattr(ctx, "user_id", None)
    if uid is None and getattr(ctx, "session", None) is not None:
        uid = getattr(ctx.session, "user_id", None)
    return uid


def _correlation_from_context(ctx: Context) -> Optional[str]:
    session = getattr(ctx, "session", None)
    if session is not None:
        state = getattr(session, "state", None)
        if isinstance(state, dict):
            cid = extract_correlation_id_from_json_dict(state)
            if cid:
                return cid
    return None


def before_model_auth_uid(
    callback_context: Context, llm_request: LlmRequest
) -> None:
    _ = llm_request
    uid = _uid_from_context(callback_context)
    cid = _correlation_from_context(callback_context)
    bind_auth_uid(uid)
    bind_correlation_id(cid)
    logger.debug(
        "ADK before_model agent_name=%s invocation_id=%s uid_bound=%s correlation_id=%s",
        getattr(callback_context, "agent_name", None),
        getattr(callback_context, "invocation_id", None),
        bool(uid),
        cid or "-",
    )


def after_model_auth_uid(
    callback_context: Context, llm_response: LlmResponse
) -> None:
    _ = (callback_context, llm_response)
    unbind_correlation_id()
    unbind_auth_uid()


def doculink_after_model_combined(
    callback_context: CallbackContext, llm_response: LlmResponse
) -> Optional[LlmResponse]:
    after_model_auth_uid(callback_context, llm_response)
    streamed = doculink_progressive_streaming_callback(
        callback_context, llm_response
    )
    if streamed is not None:
        return streamed
    return doculink_after_model_callback(callback_context, llm_response)


def after_tool_auth_uid(
    tool: BaseTool,
    args: Dict[str, Any],
    tool_context: ToolContext,
    tool_response: dict,
) -> Optional[dict]:
    _ = (tool, args, tool_context, tool_response)
    unbind_correlation_id()
    unbind_auth_uid()
    return None


def doculink_after_tool_combined(
    tool: BaseTool,
    args: Dict[str, Any],
    tool_context: ToolContext,
    tool_response: dict,
) -> Optional[dict]:
    result = after_tool_auth_uid(tool, args, tool_context, tool_response)
    tool_name = getattr(tool, "name", None) or type(tool).__name__
    if tool_name == "checkpoint_agent":
        if ensure_checkpoint_analysis_pending_stashed(tool_context.state):
            logger.info(
                "doculink after_tool: checkpoint_analysis_pending_input ready"
            )
        else:
            optional = tool_context.state.get("checkpoint_optional_agents")
            if optional:
                logger.warning(
                    "doculink after_tool: checkpoint_agent finished but pending "
                    "analysis input missing (optional_agents=%r has_checkpoint_results=%s)",
                    optional,
                    bool(tool_context.state.get("checkpoint_results")),
                )
    return result


def before_tool_callback(
    tool: BaseTool, args: Dict[str, Any], tool_context: ToolContext, **kwargs
):
    bind_auth_uid(tool_context._invocation_context.session.user_id)
    tool_context.state["user_id"] = tool_context._invocation_context.session.user_id
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
    if tool_name == "checkpoint_agent" and isinstance(args, dict):
        sync_checkpoint_tool_args_to_state(tool_context.state, args)
        logger.info(
            "doculink before_tool: synced checkpoint session fields optional_agents=%r",
            tool_context.state.get("checkpoint_optional_agents"),
        )
    if property_id:
        tool_context.state["property_id"] = property_id
        logger.info("property_id %s set in tool context", property_id)
    elif tool_name != "transfer_to_agent":
        logger.warning("property_id not found in args for tool=%s: %s", tool_name, args)


# ADK Web / session traces attribute a tool's *function response* event to the
# **invoking** agent (here: doculink_agent). The tool name on that row is still
# ``checkpoint_agent`` — that pairing (author=doculink, response=checkpoint_agent)
# is expected, not a mis-route.

doculink_agent = Agent(
    model=GLOBAL_GEMINI_MODEL,
    name="doculink_agent",
    description=("Agent that manages and executes document retrieval-related tasks."),
    instruction=doculink_agent_system_instruction(),
    input_schema=DocsInput,
    tools=[
        AgentTool(user_docs_agent),
        AgentTool(knowledge_base_agent),
        _LastNonEmptyTextAgentTool(
            checkpoint_agent,
            state_fallback_key="checkpoint_result",
            parallel_state_key="checkpoint_parallel_results",
        ),
    ],
    disallow_transfer_to_parent=True,
    before_model_callback=before_model_auth_uid,
    after_model_callback=doculink_after_model_combined,
    before_tool_callback=before_tool_callback,
    after_tool_callback=doculink_after_tool_combined,
    sub_agents=[checkpoint_progress_agent],
)

# Note: ADK doesn't have before_sub_agent callback, so we rely on property_id being passed
# through DocsInput schema when root agent delegates to doculink_agent

root_agent = Agent(
    model=GLOBAL_GEMINI_MODEL,
    name="property_agent",
    description=("Agent that manages and executes homecare-related tasks."),
    instruction=root_agent_instructions(),
    input_schema=DiagnosisInput,
    sub_agents=[doculink_agent],
    before_model_callback=before_model_auth_uid,
    after_model_callback=after_model_auth_uid,
)
