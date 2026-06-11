"""Tests for Phase 2 executor checkpoint tools (list / analyze split)."""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest

from property_agent.checkpoint.constants import (
    CHECKPOINT_EXPLICIT_BRANCHES_KEY,
    CHECKPOINT_INVENTORY_META_STATE_KEY,
)
from property_agent.checkpoint.executor_tools import analyze_checkpoints, list_checkpoints
from property_agent.checkpoint.session_input import optional_agents_for_progress_from_state
from property_agent.registry import _base_tool_specs


@pytest.mark.asyncio
async def test_list_checkpoints_returns_formatted_inventory(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "property_agent.checkpoint.executor_tools._firestore_client",
        lambda: MagicMock(),
    )
    monkeypatch.setattr(
        "property_agent.checkpoint.executor_tools.list_recent_property_checkpoints",
        lambda *_a, **_k: {
            "checkpoints": [
                {
                    "id": "c1",
                    "name": "Garage",
                    "analysisStatus": "completed",
                    "aiAnalysis": {"summary": "Paint chip", "issues": []},
                }
            ],
            "inventory_meta": {
                "total_count": 1,
                "returned_count": 1,
                "truncated": False,
                "scope": "recent",
            },
        },
    )

    state: dict = {}
    tool_context = SimpleNamespace(
        state=state,
        _invocation_context=SimpleNamespace(session=SimpleNamespace(user_id="u1")),
    )
    out = await list_checkpoints(
        property_id="p1",
        user_query="list my checkpoints",
        tool_context=tool_context,
    )

    assert "Garage" in out
    assert "Status: completed" in out
    assert "Showing 1 checkpoint" in out
    assert state[CHECKPOINT_INVENTORY_META_STATE_KEY]["total_count"] == 1


@pytest.mark.asyncio
async def test_analyze_checkpoints_empty_branches_wraps_pipeline(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    pipeline = AsyncMock(return_value="Analysis complete.")
    monkeypatch.setattr(
        "property_agent.checkpoint.executor_tools.run_checkpoint_pipeline",
        pipeline,
    )

    state: dict = {}
    tool_context = SimpleNamespace(state=state)
    out = await analyze_checkpoints(
        user_query="Summarize issues",
        property_id="p1",
        branches=[],
        tool_context=tool_context,
    )

    assert out == "Analysis complete."
    pipeline.assert_awaited_once()
    call_kwargs = pipeline.await_args.kwargs
    assert call_kwargs["checkpoint_optional_agents"] is None
    assert CHECKPOINT_EXPLICIT_BRANCHES_KEY not in state


@pytest.mark.asyncio
async def test_analyze_checkpoints_passes_explicit_branches(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    pipeline = AsyncMock(return_value="ok")
    monkeypatch.setattr(
        "property_agent.checkpoint.executor_tools.run_checkpoint_pipeline",
        pipeline,
    )

    state: dict = {}
    tool_context = SimpleNamespace(state=state)
    await analyze_checkpoints(
        user_query="Run cost analysis",
        property_id="p1",
        branches=["cost", "cost"],
        tool_context=tool_context,
    )

    call_kwargs = pipeline.await_args.kwargs
    assert call_kwargs["checkpoint_optional_agents"] == ["cost"]


def test_explicit_branches_ignore_resolved_pollution() -> None:
    state = {
        CHECKPOINT_EXPLICIT_BRANCHES_KEY: True,
        "checkpoint_optional_agents": [],
        "resolved_turn": {
            "intent": "substantive",
            "route": "checkpoint",
            "expanded_user_query": "summarize",
            "retrieval_only": False,
            "run_optional_agents": ["diy", "diy"],
            "user_goal": "new_analysis",
        },
    }
    assert optional_agents_for_progress_from_state(state) == []


def test_registry_tool_ids() -> None:
    ids = [s.id for s in _base_tool_specs()]
    assert ids == [
        "user_docs_retrieval",
        "report_retrieval",
        "list_checkpoints",
        "analyze_checkpoints",
    ]
