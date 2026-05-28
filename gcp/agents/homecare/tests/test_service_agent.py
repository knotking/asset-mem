"""Unit tests for service_agent wiring (no Vertex / network)."""

from google.adk.tools.agent_tool import AgentTool
from google.adk.tools.google_search_tool import GoogleSearchTool

from property_agent.agents.service_agent import agent as service_agent_module
from property_agent.agents.service_agent.agent import service_agent


def test_service_agent_has_no_nested_google_search_subagent() -> None:
    tools = list(service_agent.tools)
    nested = [t for t in tools if isinstance(t, AgentTool)]
    assert nested == []


def test_service_agent_tool_surface() -> None:
    tools = list(service_agent.tools)
    kinds = {type(t).__name__ for t in tools}
    assert "LangchainTool" not in kinds
    assert any(isinstance(t, GoogleSearchTool) for t in tools)
    non_google = [t for t in tools if not isinstance(t, GoogleSearchTool)]
    assert len(non_google) == 1
    assert non_google[0] is service_agent_module.serpapi_search
