"""Tests for slim session progress events with full SSE body in state_delta."""

from services.vertex_service import (
    _checkpoint_progress_display_text,
    _progressive_checkpoint_step_updates_from_state_delta,
    _should_replace_assistant_content,
)


def test_checkpoint_progress_display_text_prefers_sse_body_in_delta():
    full = (
        "# Checkpoint analysis\n\n"
        '```json\n{"analysis": {"title": "T", "analysisStatus": {"coverage": "completed"}}}\n```\n'
    )
    slim = "# Checkpoint analysis\n\n_Progress 1/2 — completed: coverage; running: diy._\n"
    event = {
        "author": "checkpoint_analysis_progress",
        "content": {"parts": [{"text": slim}]},
        "actions": {
            "state_delta": {
                "checkpoint_progress_sse_body": full,
                "checkpoint_branch_completed": "coverage",
            }
        },
    }
    assert _checkpoint_progress_display_text(event, slim) == full
    assert _should_replace_assistant_content(event, slim) is True


def test_progressive_step_updates_from_state_delta():
    event = {
        "author": "checkpoint_analysis_progress",
        "actions": {"state_delta": {"checkpoint_branch_completed": "diy"}},
    }
    updates = _progressive_checkpoint_step_updates_from_state_delta(event)
    assert len(updates) == 1
    assert updates[0]["name"] == "diy_agent"
    assert updates[0]["status"] == "completed"
