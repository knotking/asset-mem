"""Tests for inspection report agent."""

import pytest


def test_inspection_report_agent_import():
    """inspection_report_agent and ask_inspection_reports_retrieval can be imported."""
    from ..agent import inspection_report_agent, ask_inspection_reports_retrieval

    assert inspection_report_agent is not None
    assert inspection_report_agent.name == "inspection_report_agent"
    assert ask_inspection_reports_retrieval is not None


def test_inspection_report_agent_instruction():
    """inspection_report_agent_instruction returns a non-empty prompt."""
    from ..prompts import inspection_report_agent_instruction

    inst = inspection_report_agent_instruction()
    assert isinstance(inst, str)
    assert "inspection" in inst.lower()
    assert "ask_inspection_reports_retrieval" in inst or "retrieval" in inst.lower()
