"""Tests for context-only short-circuit (Phase 2)."""

from __future__ import annotations

import json
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from property_agent.context_only_turn import (
    build_context_only_response,
    context_only_short_circuit_disabled,
    should_short_circuit_context_only_turn,
)
from property_agent.query_mode import snapshot_session_analysis_context
from property_agent.resolve_turn import ResolvedTurn, prepare_before_model_turn


def _service_parallel_json(*names: str) -> str:
    serp = [{"name": n, "contact_info": "555-0100"} for n in names]
    inner = json.dumps(
        {
            "serviceResults": {
                "localPros": {"serpAPIResults": serp},
            }
        }
    )
    return json.dumps({"checkpoint_parallel_service_result": inner})


def _resolved(**kwargs) -> ResolvedTurn:
    defaults = {
        "intent": "substantive",
        "route": "checkpoint",
        "expanded_user_query": "tell me about Hetcho",
        "retrieval_only": True,
        "resolve_source": "llm",
        "user_goal": "answer_from_context",
        "query_mode": "interpret_session",
    }
    defaults.update(kwargs)
    return ResolvedTurn(**defaults)


def test_context_only_short_circuit_disabled_env() -> None:
    with patch.dict("os.environ", {"CONTEXT_ONLY_SHORT_CIRCUIT_DISABLED": "1"}):
        assert context_only_short_circuit_disabled() is True


def test_should_short_circuit_provider_follow_up() -> None:
    state = {
        "checkpoint_parallel_results": _service_parallel_json("Hetcho Plumbing"),
    }
    snapshot_session_analysis_context(state)
    resolved = _resolved(expanded_user_query="Get more details on Hetcho Plumbing")
    assert should_short_circuit_context_only_turn(
        resolved,
        state=state,
        user_query="Get more details on Hetcho Plumbing",
    )


def test_should_not_short_circuit_new_analysis() -> None:
    resolved = _resolved(user_goal="new_analysis", query_mode="new_analysis")
    assert not should_short_circuit_context_only_turn(
        resolved,
        state={"session_working_memory_snapshot": {"areas": ["garage"]}},
        user_query="analyze my kitchen",
    )


def test_should_not_short_circuit_fresh_retrieval() -> None:
    resolved = _resolved(query_mode="interpret_session")
    with patch(
        "property_agent.context_only_turn.needs_fresh_checkpoint_retrieval",
        return_value=True,
    ):
        assert not should_short_circuit_context_only_turn(
            resolved,
            state={"session_working_memory_snapshot": {"areas": ["garage"]}},
            user_query="what about the kitchen?",
        )


def test_should_short_circuit_kitchen_when_only_garage_in_memory() -> None:
    state = {
        "session_working_memory_snapshot": {
            "checkpoint_summary": {"locations": ["Garage"], "checkpointsAnalyzed": 2},
        },
    }
    resolved = _resolved(query_mode="interpret_session")
    assert should_short_circuit_context_only_turn(
        resolved,
        state=state,
        user_query="Are there any issues in the kitchen?",
    )


def test_build_context_only_provider_answer_without_llm() -> None:
    inner = json.dumps(
        {
            "serviceResults": {
                "localPros": {
                    "serpAPIResults": [
                        {"name": "Hetcho Plumbing", "phone": "555-0100"},
                    ],
                }
            }
        }
    )
    state = {
        "checkpoint_parallel_results": json.dumps(
            {"checkpoint_parallel_service_result": inner}
        ),
        "session_working_memory_snapshot": {
            "service_providers_mentioned": ["Hetcho Plumbing"],
            "service_provider_details": {
                "Hetcho Plumbing": {"name": "Hetcho Plumbing", "phone": "555-0100"},
            },
        },
    }
    resolved = _resolved(expanded_user_query="Get more details on Hetcho Plumbing")
    with patch(
        "property_agent.context_only_turn._call_context_only_llm",
    ) as mock_llm:
        text = build_context_only_response(
            resolved,
            state=state,
            session_events=[],
            user_query="Get more details on Hetcho Plumbing",
        )
    assert text is not None
    assert "555-0100" in text
    mock_llm.assert_not_called()


def test_build_context_only_canned_when_provider_name_only() -> None:
    """Name-only provider rows get a canned answer instead of echoing prior dialogue."""
    state = {
        "session_working_memory_snapshot": {
            "areas_analyzed": ["garage"],
            "checkpoint_summary": {"locations": ["Garage"]},
            "service_providers_mentioned": ["Brentwood Pro Painters"],
            "service_provider_details": {
                "Brentwood Pro Painters": {"name": "Brentwood Pro Painters"},
            },
        },
    }
    resolved = _resolved(expanded_user_query="get me more details on Brentwood Pro painters")
    with patch(
        "property_agent.context_only_turn._call_context_only_llm",
    ) as mock_llm:
        text = build_context_only_response(
            resolved,
            state=state,
            session_events=[],
            user_query="get me more details on Brentwood Pro painters",
        )
    assert text is not None
    assert "Brentwood Pro Painters" in text
    mock_llm.assert_not_called()


def test_build_context_only_calls_llm_with_memory() -> None:
    state = {
        "session_working_memory_snapshot": {
            "areas_analyzed": ["garage"],
            "summary": "Garage door needs lubrication.",
        },
    }
    resolved = _resolved(expanded_user_query="garage summary again")
    with patch(
        "property_agent.context_only_turn.should_answer_provider_from_context",
        return_value=False,
    ), patch(
        "property_agent.context_only_turn.format_provider_context_answer",
        return_value=None,
    ), patch(
        "property_agent.context_only_turn.format_session_working_memory_block",
        return_value="[SESSION_WORKING_MEMORY]\nareas: garage",
    ), patch(
        "property_agent.resolve_turn_llm._recent_dialogue",
        return_value="user: analyze garage",
    ), patch(
        "property_agent.context_only_turn._call_context_only_llm",
        return_value="Your garage door needs lubrication.",
    ) as mock_llm:
        text = build_context_only_response(
            resolved,
            state=state,
            session_events=[],
            user_query="garage summary again",
        )
    assert text == "Your garage door needs lubrication."
    mock_llm.assert_called_once()
    assert "garage" in mock_llm.call_args.kwargs["memory_block"]


def test_build_context_only_replay_from_stash() -> None:
    body = """# Analysis

```json
{
  "analysis": {
    "title": "Garage Checkpoint Overview",
    "checkpointSummary": {
      "checkpointsAnalyzed": 1,
      "queryType": "location-specific",
      "locations": ["Garage"]
    }
  }
}
```
"""
    state = {"checkpoint_analysis_dual_format": body}
    resolved = _resolved(
        user_goal="replay_deliverable",
        query_mode="interpret_session",
        expanded_user_query="show full analysis again",
    )
    text = build_context_only_response(
        resolved,
        state=state,
        session_events=[],
        user_query="show full analysis again",
    )
    assert text == body.strip()


def test_prepare_before_model_context_only_short_circuit() -> None:
    ctx = MagicMock()
    ctx.state = {}
    ctx.invocation_id = "inv-1"
    ctx.session.events = []
    resolved = _resolved()
    state_snapshot = {
        "session_working_memory_snapshot": {"areas_analyzed": ["garage"]},
    }

    with patch("property_agent.resolve_turn.resolve_turn", return_value=resolved), patch(
        "property_agent.resolve_turn.should_short_circuit_context_only_turn",
        return_value=True,
    ), patch(
        "property_agent.resolve_turn.build_context_only_response",
        return_value="Short answer from memory.",
    ):
        response = prepare_before_model_turn(
            ctx, llm_request=SimpleNamespace(config=None)
        )

    assert response is not None
    assert ctx.state.get("_context_only_short_circuit") is True
