import logging
from typing import Any, Dict, Optional

from dotenv import load_dotenv
from google.adk.agents import Agent
from google.adk.agents.context import Context
from google.adk.models.llm_response import LlmResponse
from google.adk.tools import BaseTool, ToolContext
from google.adk.tools.agent_tool import AgentTool

from .agent_inputs import DiagnosisInput, DocsInput
from .logging_context import bind_firebase_uid, install_firebase_uid_logging, unbind_firebase_uid
from .model_config import GLOBAL_GEMINI_MODEL
from .prompts import doculink_agent_system_instruction, root_agent_instructions
from .sub_agents.checkpoint_agent.agent import checkpoint_agent, _LastNonEmptyTextAgentTool
from .sub_agents.knowledge_base_agent import knowledge_base_agent
from .sub_agents.user_docs_agent import user_docs_agent


load_dotenv()
install_firebase_uid_logging(level=logging.INFO)

logger = logging.getLogger(__name__)


def _uid_from_context(ctx: Context) -> Optional[str]:
    uid = getattr(ctx, "user_id", None)
    if uid is None and getattr(ctx, "session", None) is not None:
        uid = getattr(ctx.session, "user_id", None)
    return uid


def before_model_firebase_uid(ctx: Context) -> None:
    uid = _uid_from_context(ctx)
    bind_firebase_uid(uid)
    logger.debug(
        "ADK before_model agent_name=%s invocation_id=%s uid_bound=%s",
        getattr(ctx, "agent_name", None),
        getattr(ctx, "invocation_id", None),
        bool(uid),
    )


def after_model_firebase_uid(_ctx: Context, _llm_response: LlmResponse) -> None:
    unbind_firebase_uid()


def after_tool_firebase_uid(
    _tool: BaseTool, _args: Dict[str, Any], _ctx: Context, _tool_response: dict
) -> Optional[dict]:
    unbind_firebase_uid()
    return None


def before_tool_callback(
    tool: BaseTool, args: Dict[str, Any], tool_context: ToolContext, **kwargs
):
    bind_firebase_uid(tool_context._invocation_context.session.user_id)
    tool_context.state["user_id"] = tool_context._invocation_context.session.user_id
    property_id = args.get("property_id")
    tool_name = getattr(tool, "name", None) or type(tool).__name__
    arg_keys = sorted(args.keys()) if isinstance(args, dict) else []
    logger.debug(
        "ADK before_tool tool=%s arg_keys=%s has_property_id_arg=%s",
        tool_name,
        arg_keys,
        property_id is not None,
    )
    if property_id:
        tool_context.state["property_id"] = property_id
        logger.info("property_id %s set in tool context", property_id)
    else:
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
    before_model_callback=before_model_firebase_uid,
    after_model_callback=after_model_firebase_uid,
    before_tool_callback=before_tool_callback,
    after_tool_callback=after_tool_firebase_uid,
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
    before_model_callback=before_model_firebase_uid,
    after_model_callback=after_model_firebase_uid,
)
