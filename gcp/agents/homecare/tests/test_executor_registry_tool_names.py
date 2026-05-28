"""Root executor tool names must match registry ToolSpec ids."""

from __future__ import annotations

from property_agent.registry import _base_tool_specs, build_executor_tools


def test_executor_registry_tool_names_match_spec_ids() -> None:
    specs = _base_tool_specs()
    tools = build_executor_tools(lambda: False)

    assert len(tools) == len(specs)
    assert [getattr(tool, "name") for tool in tools] == [spec.id for spec in specs]
