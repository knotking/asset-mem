
import os
from google.adk.agents import Agent, SequentialAgent, ParallelAgent
from dotenv import load_dotenv
from .prompts import return_instructions_root,return_instructions_catalog
from .sub_agents.product_manual_agent import product_manual_agent
from .sub_agents.user_uploads_agent import user_uploads_agent
from .sub_agents.diagnostics_agent import diagnostic_agent
load_dotenv()

catalog_agent = ParallelAgent(
    # model='gemini-2.5-flash',
    name='catalog_agent',
    # instruction=return_instructions_catalog(),
    description=("Agent that manages and executes catalog-related tasks."),
    sub_agents=[
        user_uploads_agent,
        product_manual_agent
    ]
)

root_agent = Agent( 
    model='gemini-2.5-flash',
    name='homecare_agent',
    description=("Agent that manages and executes homecare-related tasks."),
    instruction=return_instructions_root(),
    sub_agents=[
        diagnostic_agent,
        catalog_agent
    ]
)

