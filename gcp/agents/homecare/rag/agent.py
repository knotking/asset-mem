
import os
from google.adk.agents import Agent, SequentialAgent, ParallelAgent
from google.adk.tools.agent_tool import AgentTool
from dotenv import load_dotenv
from .prompts import return_instructions_root,catalog_agent_system_instruction
from .sub_agents.product_manual_agent import product_manual_agent
from .sub_agents.user_uploads_agent import user_uploads_agent
from .sub_agents.diagnostics_agent import diagnostic_agent
load_dotenv()

catalog_agent = Agent(
    model='gemini-2.5-flash',
    name='catalog_agent',
    description=("Agent that manages and executes catalog-related tasks."),
    instruction=catalog_agent_system_instruction(),
    tools=[
        AgentTool(user_uploads_agent),
        AgentTool(product_manual_agent),
    ],
    disallow_transfer_to_parent=True
)

root_agent = Agent( 
    model='gemini-2.5-flash',
    name='homecare_agent',
    description=("Agent that manages and executes homecare-related tasks."),
    instruction=return_instructions_root(),
    sub_agents=[
        # diagnostic_agent,
        catalog_agent
    ]
)

