"""Unit tests for coverage_agent wiring (no Vertex / network)."""

from google.adk.tools.agent_tool import AgentTool

from property_agent.shared.inputs import DocsInput
from property_agent.agents.coverage_agent.agent import coverage_agent
from property_agent.agents.user_docs_agent.agent import ask_user_docs_retreival


def test_coverage_agent_tool_surface() -> None:
    tools = list(coverage_agent.tools)
    assert len(tools) == 1
    assert not any(isinstance(t, AgentTool) for t in tools)
    assert tools[0] is ask_user_docs_retreival


def test_coverage_agent_metadata() -> None:
    assert coverage_agent.name == "coverage_agent"
    assert coverage_agent.input_schema is DocsInput
    assert "warranty" in (coverage_agent.description or "").lower()
    assert "insurance" in (coverage_agent.description or "").lower()
