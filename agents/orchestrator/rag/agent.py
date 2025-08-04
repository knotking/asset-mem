import os
from google.adk.agents import Agent
from google.adk.tools.remote_agent import RemoteAgentTool
from dotenv import load_dotenv
from .prompts import return_instructions_root

load_dotenv()

# Tool to talk to the Product Manual Agent (formerly Catalog Agent)
product_manual_agent_tool = RemoteAgentTool(
    name="product_manual_agent_tool",
    description="Use this tool to query the Product Manual Agent for product manual questions, catalog information, or general appliance knowledge (e.g., TVs, washing machines, etc).",
    agent_engine_id=os.environ.get("PRODUCT_MANUAL_AGENT_ENGINE_ID")
)

# Tool to talk to the User Uploads Agent (formerly User Catalog Agent)
user_uploads_agent_tool = RemoteAgentTool(
    name="user_uploads_agent_tool",
    description="Use this tool to query the User Uploads Agent for questions about documents or data that the user has personally uploaded.",
    agent_engine_id=os.environ.get("USER_UPLOADS_AGENT_ENGINE_ID")
)

root_agent = Agent(
    model='gemini-2.5-flash',
    name='orchestrator_agent',
    instruction=return_instructions_root(),
    tools=[
        product_manual_agent_tool,
        user_uploads_agent_tool,
    ]
)

