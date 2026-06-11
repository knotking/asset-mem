"""Tests for ContextHydratorV1 homecare binding (session working memory)."""

from __future__ import annotations

import pytest

from agent_framework.context.hydrator_render import render_hydrated_context
from property_agent.context.homecare_hydrator_v1 import (
    DEFAULT_HOMECARE_CONTEXT_BUDGETS,
    HomecareContextHydratorV1,
    SESSION_MEMORY_SOURCE,
    hydrate_session_context_sync,
)
from property_agent.routing.query_mode import (
    SESSION_WORKING_MEMORY_SNAPSHOT_KEY,
    format_session_working_memory_block,
)


def test_hydrate_matches_format_session_working_memory_block() -> None:
    state = {
        SESSION_WORKING_MEMORY_SNAPSHOT_KEY: {
            "service_providers_mentioned": ["Hetcho Services"],
            "analysis_title": "Roof inspection",
        }
    }
    direct = format_session_working_memory_block(state)
    hydrated = hydrate_session_context_sync(
        query="tell me about Hetcho",
        state=state,
        budgets=DEFAULT_HOMECARE_CONTEXT_BUDGETS,
    )
    assert len(hydrated.retrieved) == 1
    assert hydrated.retrieved[0].source == SESSION_MEMORY_SOURCE
    assert render_hydrated_context(hydrated) == direct


def test_hydrate_empty_state() -> None:
    hydrated = hydrate_session_context_sync(query="hi", state=None)
    assert hydrated.retrieved == []
    assert render_hydrated_context(hydrated) == ""


def test_hydrate_logs_context_hydrator_path(caplog: pytest.LogCaptureFixture) -> None:
    import logging

    caplog.set_level(logging.INFO, logger="property_agent.context.homecare_hydrator_v1")
    state = {
        SESSION_WORKING_MEMORY_SNAPSHOT_KEY: {
            "analysis_title": "Roof inspection",
        }
    }
    hydrate_session_context_sync(query="explain diy", state=state)
    assert any(
        "orchestrator_v2_context_hydrator path=ContextHydratorV1 injected=true"
        in r.message
        for r in caplog.records
    )


@pytest.mark.asyncio
async def test_homecare_context_hydrator_v1_async() -> None:
    state = {
        SESSION_WORKING_MEMORY_SNAPSHOT_KEY: {
            "diy_steps_summary": ["Step 1: Inspect shingles"],
        }
    }
    hydrator = HomecareContextHydratorV1(state=state)
    hydrated = await hydrator.hydrate(
        query="explain diy",
        recent_turns=["prior turn"],
        budgets=DEFAULT_HOMECARE_CONTEXT_BUDGETS,
    )
    assert hydrated.recent_turns == ["prior turn"]
    assert "[SESSION_WORKING_MEMORY]" in render_hydrated_context(hydrated)


def test_hydrate_respects_top_k() -> None:
    state = {SESSION_WORKING_MEMORY_SNAPSHOT_KEY: {"analysis_title": "T"}}
    hydrated = hydrate_session_context_sync(query="q", state=state, top_k=0)
    assert hydrated.retrieved == []


def test_resolve_turn_block_unchanged_with_hydrator() -> None:
    from property_agent.routing.resolve_turn import format_resolved_turn_block
    from property_agent.routing.schema import ResolvedTurn

    state = {
        SESSION_WORKING_MEMORY_SNAPSHOT_KEY: {
            "service_providers_mentioned": ["Hetcho Services"],
        }
    }
    block = format_resolved_turn_block(
        ResolvedTurn(
            intent="substantive",
            route="checkpoint",
            expanded_user_query="tell me about Hetcho",
            retrieval_only=True,
            user_goal="answer_from_context",
            query_mode="interpret_session",
        ),
        state=state,
    )
    assert "[RESOLVED_TURN]" in block
    assert "[SESSION_WORKING_MEMORY]" not in block
