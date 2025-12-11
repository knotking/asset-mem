from google.adk.agents import Agent
from dotenv import load_dotenv
from .prompts import coverage_agent_instructions
from ..user_docs_agent.agent import ask_user_docs_retreival
from ...agent_inputs import DocsInput

load_dotenv()

coverage_agent = Agent(
    model='gemini-3-pro-preview',
    name='coverage_agent',
    description="Retrieves warranty and insurance coverage information from user documents.",
    instruction=coverage_agent_instructions(),
    tools=[ask_user_docs_retreival],
    input_schema=DocsInput
)

__all__ = ["coverage_agent"]

