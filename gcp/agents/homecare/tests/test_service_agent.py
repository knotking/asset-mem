"""Unit tests for service_agent wiring (no Vertex / network)."""

from google.adk.tools.agent_tool import AgentTool
from google.adk.tools.google_search_tool import GoogleSearchTool

from property_agent.sub_agents.service_agent.agent import service_agent


def test_service_agent_has_no_nested_google_search_subagent() -> None:
    tools = list(service_agent.tools)
    nested = [t for t in tools if isinstance(t, AgentTool)]
    assert nested == []


def test_service_agent_tool_surface() -> None:
    tools = list(service_agent.tools)
    kinds = {type(t).__name__ for t in tools}
    assert "LangchainTool" in kinds
    assert any(isinstance(t, GoogleSearchTool) for t in tools)
