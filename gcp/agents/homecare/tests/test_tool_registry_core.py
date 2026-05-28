from __future__ import annotations

from agent_framework.registry.tool_spec import ToolSpec, build_tools


def test_build_tools_instantiates_all_specs() -> None:
    specs = (
        ToolSpec(id="one", factory=lambda: {"name": "one"}),
        ToolSpec(id="two", factory=lambda: {"name": "two"}),
    )

    tools = build_tools(specs)
    assert tools == [{"name": "one"}, {"name": "two"}]


def test_build_tools_applies_spec_id_as_tool_name() -> None:
    class _NamedTool:
        def __init__(self, name: str) -> None:
            self.name = name

    specs = (
        ToolSpec(
            id="user_docs_retrieval",
            factory=lambda: _NamedTool(name="ask_user_docs_agent"),
        ),
    )

    tools = build_tools(specs)
    assert len(tools) == 1
    assert tools[0].name == "user_docs_retrieval"
