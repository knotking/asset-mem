
import os
import uuid
import json
from google.adk.agents import Agent
from vertexai.preview import rag
from dotenv import load_dotenv
from .prompts import return_instructions_root


load_dotenv()


diagnostic_agent = Agent(
    model='gemini-2.5-flash',
    name='diagnostic_agent',
    instruction=return_instructions_root(),
    tools=[]
)

__all__ = ["diagnostic_agent"]