"""HomeApp-aware conformance replay validators (volatile lifecycle/timing fields)."""

from __future__ import annotations

from dataclasses import dataclass
import difflib
import json
from typing import Optional

from google.adk.events.event import Event
from google.adk.sessions.session import Session

# Volatile keys inside event actions.state_delta (new UUIDs / timing each run).
_EVENT_STATE_DELTA_EXCLUDED = {
    "_adk_recordings_config": True,
    "_adk_replay_config": True,
    "homeappLifecycle": True,
    "_resolve_turn_invocation_id": True,
    "_report_retrieval_served_invocation_id": True,
    "analysisRunId": True,
    "analysis_run_id": True,
    "checkpoint_request_timing": True,
    "checkpoint_ids": True,
    "property_id": True,
    "session_working_memory_snapshot": {"analysis_run_id": True},
    "user_id": True,
}

_EVENT_EXCLUDED_FIELDS = {
    "id": True,
    "timestamp": True,
    "invocation_id": True,
    "long_running_tool_ids": True,
    "content": {
        "parts": {
            "__all__": {
                "thought_signature": True,
                "function_call": {"id": True},
                "function_response": {"id": True},
            }
        }
    },
    "actions": {
        "state_delta": _EVENT_STATE_DELTA_EXCLUDED,
        "requested_auth_configs": True,
        "requested_tool_confirmations": True,
    },
}

_SESSION_EXCLUDED_FIELDS = {
    "id": True,
    "last_update_time": True,
    "user_id": True,
    "state": {
        "_adk_recordings_config": True,
        "_adk_replay_config": True,
        "_resolve_turn_invocation_id": True,
        "_report_retrieval_served_invocation_id": True,
        "analysisRunId": True,
        "analysis_run_id": True,
        "checkpoint_request_timing": True,
        "checkpoint_ids": True,
        "homeappLifecycle": True,
        "user_id": True,
        "session_working_memory_snapshot": {"analysis_run_id": True},
    },
    "events": True,
}


@dataclass
class ComparisonResult:
    success: bool
    error_message: Optional[str] = None


def _generate_diff_message(
    context: str, actual_dict: dict, recorded_dict: dict
) -> str:
    actual_json = json.dumps(actual_dict, indent=2, sort_keys=True)
    recorded_json = json.dumps(recorded_dict, indent=2, sort_keys=True)
    diff_lines = list(
        difflib.unified_diff(
            recorded_json.splitlines(keepends=True),
            actual_json.splitlines(keepends=True),
            fromfile=f"recorded {context}\n",
            tofile=f"actual {context}\n",
            lineterm="",
        )
    )
    if diff_lines:
        return f"{context} mismatch:\n" + "".join(diff_lines)
    return (
        f"{context} mismatch - \nActual: \n{actual_json} \nRecorded:"
        f" \n{recorded_json}"
    )


def _compare_event(actual_event: Event, recorded_event: Event, index: int) -> ComparisonResult:
    actual_dict = actual_event.model_dump(
        exclude_none=True, exclude=_EVENT_EXCLUDED_FIELDS
    )
    recorded_dict = recorded_event.model_dump(
        exclude_none=True, exclude=_EVENT_EXCLUDED_FIELDS
    )
    if actual_dict != recorded_dict:
        return ComparisonResult(
            success=False,
            error_message=_generate_diff_message(
                f"event {index}", actual_dict, recorded_dict
            ),
        )
    return ComparisonResult(success=True)


def compare_events(
    actual_events: list[Event], recorded_events: list[Event]
) -> ComparisonResult:
    if len(actual_events) != len(recorded_events):
        return ComparisonResult(
            success=False,
            error_message=(
                f"Event count mismatch - \nActual: \n{len(actual_events)} "
                f"\nRecorded: \n{len(recorded_events)}"
            ),
        )
    for i, (actual, recorded) in enumerate(zip(actual_events, recorded_events)):
        result = _compare_event(actual, recorded, i)
        if not result.success:
            return result
    return ComparisonResult(success=True)


def compare_session(
    actual_session: Session, recorded_session: Session
) -> ComparisonResult:
    actual_dict = actual_session.model_dump(
        exclude_none=True, exclude=_SESSION_EXCLUDED_FIELDS
    )
    recorded_dict = recorded_session.model_dump(
        exclude_none=True, exclude=_SESSION_EXCLUDED_FIELDS
    )
    if actual_dict != recorded_dict:
        return ComparisonResult(
            success=False,
            error_message=_generate_diff_message(
                "session", actual_dict, recorded_dict
            ),
        )
    return ComparisonResult(success=True)
