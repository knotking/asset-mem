from google.adk.agents import Agent
from dotenv import load_dotenv
from .prompts import diy_agent_instructions
from ...agent_inputs import DocsInput
from ...model_config import GLOBAL_GEMINI_MODEL
from .orchestrator import run_diy_pipeline

load_dotenv()

diy_agent = Agent(
    model=GLOBAL_GEMINI_MODEL,
    name="diy_agent",
    description="Provides DIY repair recommendations via an optimized parallel pipeline.",
    instruction=diy_agent_instructions(),
    tools=[run_diy_pipeline],
    input_schema=DocsInput,
)

__all__ = ["diy_agent", "run_diy_pipeline"]
