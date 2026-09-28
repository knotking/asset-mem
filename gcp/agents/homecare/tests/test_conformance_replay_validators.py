"""Tests for AssetMem conformance replay compare exclusions."""

from __future__ import annotations

from property_agent.evals.conformance.replay_validators import (
    compare_events,
    compare_session,
)


def _lifecycle_delta(invocation_id: str, session_id: str, ts: str) -> dict:
    return {
        "homeappLifecycle": {
            "v": 1,
            "phase": "engine.runner_exec",
            "invocation_id": invocation_id,
            "session_id": session_id,
            "ts": ts,
            "elapsed_ms": 0,
            "message": "Working on it...",
        }
    }


def test_compare_events_ignores_homeapp_lifecycle_delta() -> None:
    from google.adk.events.event import Event
    from google.adk.events.event_actions import EventActions

    recorded_event = Event(
        invocation_id="inv-a",
        author="homeapp_lifecycle",
        actions=EventActions(state_delta=_lifecycle_delta("inv-a", "sess-a", "t1")),
    )
    actual_event = Event(
        invocation_id="inv-b",
        author="homeapp_lifecycle",
        actions=EventActions(state_delta=_lifecycle_delta("inv-b", "sess-b", "t2")),
    )
    result = compare_events([actual_event], [recorded_event])
    assert result.success, result.error_message


def test_compare_events_ignores_resolve_turn_invocation_id_in_state_delta() -> None:
    from google.adk.events.event import Event
    from google.adk.events.event_actions import EventActions

    recorded_event = Event(
        invocation_id="inv-a",
        author="property_agent",
        actions=EventActions(
            state_delta={
                "_resolve_turn_invocation_id": "e-old",
                "conversational_turn": True,
            }
        ),
    )
    actual_event = Event(
        invocation_id="inv-b",
        author="property_agent",
        actions=EventActions(
            state_delta={
                "_resolve_turn_invocation_id": "e-new",
                "conversational_turn": True,
            }
        ),
    )
    result = compare_events([actual_event], [recorded_event])
    assert result.success, result.error_message


def test_compare_session_ignores_working_memory_analysis_run_id() -> None:
    from google.adk.sessions.session import Session

    recorded = Session(
        id="sess-recorded",
        app_name="property_agent",
        user_id="u1",
        state={
            "user_query": "Which areas?",
            "session_working_memory_snapshot": {
                "analysis_run_id": "run-old",
                "property_id": "EVALPROP0001",
            },
        },
    )
    actual = Session(
        id="sess-actual",
        app_name="property_agent",
        user_id="u1",
        state={
            "user_query": "Which areas?",
            "session_working_memory_snapshot": {
                "analysis_run_id": "run-new",
                "property_id": "EVALPROP0001",
            },
        },
    )
    result = compare_session(actual, recorded)
    assert result.success, result.error_message


def test_compare_session_ignores_volatile_state_fields() -> None:
    from google.adk.sessions.session import Session

    base_state = {
        "user_query": "hello",
        "conversational_turn": True,
        "primary_agent": "checkpoint",
    }
    recorded = Session(
        id="sess-recorded",
        app_name="property_agent",
        user_id="u1",
        state={
            **base_state,
            "_resolve_turn_invocation_id": "inv-old",
            "homeappLifecycle": {"invocation_id": "inv-old", "ts": "t-old"},
            "analysisRunId": "run-old",
            "user_id": "adk_conformance_test_user",
        },
    )
    actual = Session(
        id="sess-actual",
        app_name="property_agent",
        user_id="u2",
        state={
            **base_state,
            "_resolve_turn_invocation_id": "inv-new",
            "homeappLifecycle": {"invocation_id": "inv-new", "ts": "t-new"},
            "analysisRunId": "run-new",
        },
    )
    result = compare_session(actual, recorded)
    assert result.success, result.error_message


def test_compare_events_ignores_working_memory_in_state_delta() -> None:
    from google.adk.events.event import Event
    from google.adk.events.event_actions import EventActions

    recorded_event = Event(
        invocation_id="inv-a",
        author="property_agent",
        actions=EventActions(
            state_delta={
                "session_working_memory_snapshot": {
                    "analysis_run_id": "run-old",
                    "property_id": "EVALPROP0001",
                },
                "user_query": "thanks",
            }
        ),
    )
    actual_event = Event(
        invocation_id="inv-b",
        author="property_agent",
        actions=EventActions(
            state_delta={
                "session_working_memory_snapshot": {
                    "analysis_run_id": "run-new",
                    "property_id": "EVALPROP0001",
                },
                "user_query": "thanks",
            }
        ),
    )
    result = compare_events([actual_event], [recorded_event])
    assert result.success, result.error_message


def test_compare_events_ignores_property_id_in_state_delta() -> None:
    from google.adk.events.event import Event
    from google.adk.events.event_actions import EventActions

    recorded_event = Event(
        invocation_id="inv-a",
        author="property_agent",
        actions=EventActions(
            state_delta={
                "property_id": "EVALPROP0001",
                "user_docs_result": "No relevant information.",
                "_executor_user_docs_passthrough": True,
            }
        ),
    )
    actual_event = Event(
        invocation_id="inv-b",
        author="property_agent",
        actions=EventActions(
            state_delta={
                "user_docs_result": "No relevant information.",
                "_executor_user_docs_passthrough": True,
            }
        ),
    )
    result = compare_events([actual_event], [recorded_event])
    assert result.success, result.error_message
