"""Unit tests for service_agent wiring (no Vertex / network)."""

import inspect

from property_agent.sub_agents.service_agent import agent as service_agent_module
from property_agent.sub_agents.service_agent.agent import service_agent
from property_agent.sub_agents.service_agent.orchestrator import run_service_pipeline


def test_service_agent_uses_structured_pipeline_tool() -> None:
    tools = list(service_agent.tools)
    assert len(tools) == 1
    assert tools[0] is run_service_pipeline
    assert inspect.iscoroutinefunction(run_service_pipeline)


def test_service_agent_exports_pipeline() -> None:
    assert service_agent_module.run_service_pipeline is run_service_pipeline
