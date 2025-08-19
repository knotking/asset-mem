import os
from google.adk.agents import Agent, SequentialAgent, ParallelAgent
from google.adk.tools.agent_tool import AgentTool
from google.adk.tools import ToolContext
from dotenv import load_dotenv
from .prompts import root_agent_instructions,doculink_agent_system_instruction
from .sub_agents.knowledge_base_agent import knowledge_base_agent
from .sub_agents.user_uploads_agent import user_uploads_agent
from .sub_agents.diagnostics_agent import diagnostic_agent


load_dotenv()


def before_tool_callback(tool_context: ToolContext, **kwargs):
    # Ensure the user_id is set in the tool context state
    tool_context.state["user_id"] = tool_context._invocation_context.session.user_id

doculink_agent = Agent(
    model='gemini-2.5-flash-lite',
    name='doculink_agent',
    description=("Agent that manages and executes document retrieval-related tasks."),
    instruction=doculink_agent_system_instruction(),
    tools=[
        AgentTool(user_uploads_agent),
        AgentTool(knowledge_base_agent),
    ],
    disallow_transfer_to_parent=True,
    before_tool_callback=before_tool_callback
)

root_agent = Agent( 
    model='gemini-2.5-flash-lite',
    name='homecare_agent',
    description=("Agent that manages and executes homecare-related tasks."),
    instruction=root_agent_instructions(),
    sub_agents=[
        diagnostic_agent,
        doculink_agent
    ]
)

