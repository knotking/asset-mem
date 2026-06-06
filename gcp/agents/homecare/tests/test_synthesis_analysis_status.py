"""Tests for first-class synthesis progress in analysisStatus."""

from property_agent.checkpoint.analysis.assembler import (
    checkpoint_synthesis_progress_session_text,
    set_synthesis_analysis_status,
)


def test_set_synthesis_analysis_status_adds_running_phase():
    analysis = {
        "title": "Garage door",
        "analysisStatus": {"coverage": "completed", "diy": "completed"},
    }
    updated = set_synthesis_analysis_status(analysis, phase="running")
    assert updated["analysisStatus"]["synthesis"] == "running"
    assert updated["analysisStatus"]["coverage"] == "completed"


def test_synthesis_progress_session_text():
    assert checkpoint_synthesis_progress_session_text() == "Writing your summary…"
