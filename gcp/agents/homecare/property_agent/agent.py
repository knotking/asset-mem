from google.adk.agents import Agent
from google.adk.tools.agent_tool import AgentTool
from google.adk.tools import ToolContext
from dotenv import load_dotenv
from .prompts import root_agent_instructions, doculink_agent_system_instruction
from .sub_agents.knowledge_base_agent import knowledge_base_agent
from .sub_agents.user_docs_agent import user_docs_agent
from .sub_agents.checkpoint_agent.agent import checkpoint_agent, _LastNonEmptyTextAgentTool
from typing import Any, Dict
from .agent_inputs import DiagnosisInput, DocsInput
from google.adk.tools import BaseTool
from .model_config import GLOBAL_GEMINI_MODEL


load_dotenv()

def before_tool_callback( tool: BaseTool, args: Dict[str, Any], tool_context: ToolContext, **kwargs):
    import logging
    logger = logging.getLogger(__name__)
    # Ensure the user_id is set in the tool context state
    tool_context.state["user_id"] = tool_context._invocation_context.session.user_id
    property_id = args.get("property_id")
    if property_id:
        tool_context.state["property_id"] = property_id
        logger.info(f"property_id {property_id} set in tool context")
    else:
        logger.warning(f"property_id not found in args: {args}")

# ADK Web / session traces attribute a tool's *function response* event to the
# **invoking** agent (here: doculink_agent). The tool name on that row is still
# ``checkpoint_agent`` — that pairing (author=doculink, response=checkpoint_agent)
# is expected, not a mis-route.

doculink_agent = Agent(
    model=GLOBAL_GEMINI_MODEL,
    name='doculink_agent',
    description=("Agent that manages and executes document retrieval-related tasks."),
    instruction=doculink_agent_system_instruction(),
    input_schema=DocsInput,
    tools=[
        AgentTool(user_docs_agent),
        AgentTool(knowledge_base_agent),
        # Stock AgentTool returns only the last text parts; checkpoint analysis is often carried
        # in function_response payloads, and trailing empty model turns yield ''. Use the same
        # resilient wrapper as inside checkpoint_agent, plus checkpoint_result state fallback.
        _LastNonEmptyTextAgentTool(
            checkpoint_agent,
            state_fallback_key="checkpoint_result",
            parallel_state_key="checkpoint_parallel_results",
        ),
    ],
    disallow_transfer_to_parent=True,
    before_tool_callback=before_tool_callback
)

# Note: ADK doesn't have before_sub_agent callback, so we rely on property_id being passed
# through DocsInput schema when root agent delegates to doculink_agent

root_agent = Agent(
    model=GLOBAL_GEMINI_MODEL,
    name='property_agent',
    description=("Agent that manages and executes homecare-related tasks."),
    instruction=root_agent_instructions(),
    input_schema=DiagnosisInput,
    sub_agents=[
        doculink_agent
    ]
)

