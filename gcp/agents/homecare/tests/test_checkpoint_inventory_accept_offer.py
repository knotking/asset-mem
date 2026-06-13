"""Tests for inventory query detection and accept-offer list behavior."""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest

from property_agent.checkpoint.constants import (
    CHECKPOINT_LOCATION_META_STATE_KEY,
    CHECKPOINT_TEMPORAL_META_STATE_KEY,
)
from property_agent.checkpoint.executor_tools import list_checkpoints
from property_agent.checkpoint.retrieval.effective_query import (
    resolve_effective_checkpoint_query,
)
from property_agent.checkpoint.retrieval.inventory_query import (
    query_requests_checkpoint_inventory,
)
from property_agent.checkpoint.retrieval.retrieval_scope import plan_checkpoint_retrieval


def test_inventory_regex_matches_expanded_accept_offer_query() -> None:
    assert query_requests_checkpoint_inventory(
        "List all available checkpoints for the property"
    )


def test_resolve_effective_checkpoint_query_prefers_expanded_state() -> None:
    state = {
        "user_query": "List all available checkpoints for the property",
    }
    assert (
        resolve_effective_checkpoint_query(state, "yes")
        == "List all available checkpoints for the property"
    )


def test_plan_inventory_wins_over_carried_temporal_scope() -> None:
    state = {
        CHECKPOINT_TEMPORAL_META_STATE_KEY: {
            "label": "May 2026",
            "start_utc": "2026-05-01T00:00:00+00:00",
            "end_utc": "2026-06-01T00:00:00+00:00",
            "returned_count": 0,
            "scope": "temporal",
        },
        CHECKPOINT_LOCATION_META_STATE_KEY: {
            "requested": "kitchen",
            "matched_field": None,
            "returned_count": 0,
            "scope": "location",
        },
    }
    plan = plan_checkpoint_retrieval(
        "List all available checkpoints for the property",
        location=None,
        checkpoint_ids=None,
        reference_date="2026-06-13",
        state=state,
    )
    assert plan.mode == "inventory_recent"
    assert plan.carried_over is False
    assert plan.date_range is None
    assert plan.location_intent is None


@pytest.mark.asyncio
async def test_list_checkpoints_ignores_prior_kitchen_scope(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
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
                    "location": "Garage",
                    "analysisStatus": "completed",
                    "aiAnalysis": {"summary": "Chip", "issues": []},
                },
                {
                    "id": "c2",
                    "location": "Vehicle - Exterior",
                    "analysisStatus": "completed",
                    "aiAnalysis": {"summary": "Scratch", "issues": []},
                },
            ],
            "inventory_meta": {
                "total_count": 2,
                "returned_count": 2,
                "truncated": False,
                "scope": "recent",
            },
        },
    )

    state = {
        "user_query": "List all available checkpoints for the property",
        CHECKPOINT_TEMPORAL_META_STATE_KEY: {
            "label": "May 2026",
            "start_utc": "2026-05-01T00:00:00+00:00",
            "end_utc": "2026-06-01T00:00:00+00:00",
            "returned_count": 0,
            "scope": "temporal",
        },
        CHECKPOINT_LOCATION_META_STATE_KEY: {
            "requested": "kitchen",
            "matched_field": None,
            "returned_count": 0,
            "scope": "location",
        },
    }
    tool_context = SimpleNamespace(
        state=state,
        _invocation_context=SimpleNamespace(session=SimpleNamespace(user_id="u1")),
    )

    out = await list_checkpoints(
        property_id="p1",
        user_query="yes",
        tool_context=tool_context,
    )

    assert "Garage" in out
    assert "Vehicle - Exterior" in out
    assert "kitchen" not in out.lower()
    assert state[CHECKPOINT_LOCATION_META_STATE_KEY] is None
    assert state[CHECKPOINT_TEMPORAL_META_STATE_KEY] is None
