"""Tests for AgentRequest schema and inspection_report_ids / primary_agent."""

import pytest
from schemas.agent import AgentRequest


def test_agent_request_accepts_inspection_report_ids():
    """AgentRequest should accept and retain inspection_report_ids."""
    req = AgentRequest(
        user_id="user1",
        user_query="Analyze my inspection report",
        context_doc_uris=["gs://bucket/report1.pdf"],
        inspection_report_ids=["doc_id_1", "doc_id_2"],
    )
    assert req.inspection_report_ids == ["doc_id_1", "doc_id_2"]


def test_agent_request_accepts_primary_agent_inspection():
    """AgentRequest should accept primary_agent='inspection'."""
    req = AgentRequest(
        user_id="user1",
        user_query="What are the findings?",
        primary_agent="inspection",
    )
    assert req.primary_agent == "inspection"


def test_agent_request_inspection_report_ids_optional():
    """inspection_report_ids should default to None."""
    req = AgentRequest(user_id="user1", user_query="Hello")
    assert req.inspection_report_ids is None


def test_agent_request_primary_agent_optional():
    """primary_agent should default to None."""
    req = AgentRequest(user_id="user1", user_query="Hello")
    assert req.primary_agent is None
