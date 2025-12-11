import os
from google.adk.agents import Agent, SequentialAgent, ParallelAgent
from google.adk.tools.agent_tool import AgentTool
from google.adk.tools import ToolContext
from dotenv import load_dotenv
from .prompts import root_agent_instructions,doculink_agent_system_instruction
from .sub_agents.knowledge_base_agent import knowledge_base_agent
from .sub_agents.user_docs_agent import user_docs_agent
from .sub_agents.analysis_agent import analysis_agent
from pydantic import BaseModel, Field
from typing import List, Optional
from .agent_inputs import DiagnosisInput, DocsInput


load_dotenv()

def before_tool_callback(tool_context: ToolContext, **kwargs):
    # Ensure the user_id is set in the tool context state
    tool_context.state["user_id"] = tool_context._invocation_context.session.user_id

doculink_agent = Agent(
    model='gemini-3-flash',
    name='doculink_agent',
    description=("Agent that manages and executes document retrieval-related tasks."),
    instruction=doculink_agent_system_instruction(),
    input_schema=DocsInput,
    tools=[
        AgentTool(user_docs_agent),
        AgentTool(knowledge_base_agent),
    ],
    disallow_transfer_to_parent=True,
    before_tool_callback=before_tool_callback
)

root_agent = Agent(
    model='gemini-3-flash',
    name='property_agent',
    description=("Agent that manages and executes homecare-related tasks."),
    instruction=root_agent_instructions(),
    input_schema=DiagnosisInput,
    sub_agents=[
        analysis_agent,
        doculink_agent
    ]
)

