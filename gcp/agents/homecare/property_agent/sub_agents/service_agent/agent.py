from google.adk.agents import Agent
from dotenv import load_dotenv
from .prompts import service_agent_instructions
from ...agent_inputs import DocsInput
from ...model_config import GLOBAL_GEMINI_MODEL
from .orchestrator import run_service_pipeline

load_dotenv()

service_agent = Agent(
    model=GLOBAL_GEMINI_MODEL,
    name="service_agent",
    description="Provides professional service recommendations and structured local provider listings.",
    instruction=service_agent_instructions(),
    tools=[run_service_pipeline],
    input_schema=DocsInput,
)

# ADK AgentEvaluator expects ``root_agent`` on ``*.agent`` modules.
root_agent = service_agent

__all__ = ["service_agent", "root_agent", "run_service_pipeline"]
