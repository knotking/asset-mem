"""Tests for ADK session compaction observability."""

from __future__ import annotations

from types import SimpleNamespace

import pytest

from property_agent.observability.session_compaction import (
    compaction_event_count,
    log_compaction_applied,
)


def _compaction_event(*, text: str = "summary") -> SimpleNamespace:
    return SimpleNamespace(
        actions=SimpleNamespace(
            compaction=SimpleNamespace(
                compacted_content=SimpleNamespace(
                    parts=[SimpleNamespace(text=text)],
                ),
            ),
        ),
    )


def test_compaction_event_count_empty() -> None:
    assert compaction_event_count(None) == 0
    assert compaction_event_count([]) == 0


def test_compaction_event_count_mixed_events() -> None:
    events = [
        SimpleNamespace(actions=None),
        _compaction_event(),
        _compaction_event(text="second"),
    ]
    assert compaction_event_count(events) == 2


def test_log_compaction_applied_emits_info(caplog: pytest.LogCaptureFixture) -> None:
    caplog.set_level("INFO")
    events = [_compaction_event(text="hello world")]
    log_compaction_applied(
        session_id="sess-1",
        events_before=0,
        events_after=1,
        session_events=events,
        token_threshold=24000,
        event_retention_size=24,
    )
    assert any("adk_session_compaction applied" in r.message for r in caplog.records)
    assert any("session_id=sess-1" in r.message for r in caplog.records)


def test_log_compaction_applied_skips_when_no_new_events(
    caplog: pytest.LogCaptureFixture,
) -> None:
    caplog.set_level("INFO")
    log_compaction_applied(
        session_id="sess-1",
        events_before=2,
        events_after=2,
        session_events=[],
        token_threshold=24000,
        event_retention_size=24,
    )
    assert not any("adk_session_compaction applied" in r.message for r in caplog.records)
