"""Tests for the Reasoning Engine stream_query payload builder."""

from schemas.agent import AgentRequest
from services.vertex_service import build_reasoning_engine_payload


def _request(**overrides):
    data = {"user_id": "u1", "user_query": "Run cost analysis"}
    data.update(overrides)
    return AgentRequest(**data)


def test_payload_includes_chip_action():
    request = _request(chip_action={"type": "run_branch", "branch": "cost"})
    payload = build_reasoning_engine_payload(request)
    assert payload["chip_action"] == {"type": "run_branch", "branch": "cost"}


def test_payload_omits_chip_action_when_absent():
    payload = build_reasoning_engine_payload(_request())
    assert "chip_action" not in payload


def test_payload_chip_action_excludes_none_fields():
    request = _request(chip_action={"type": "discuss", "topic": "diy"})
    payload = build_reasoning_engine_payload(request)
    assert payload["chip_action"] == {"type": "discuss", "topic": "diy"}
    assert "branch" not in payload["chip_action"]


def test_payload_core_fields_and_overrides():
    request = _request(
        checkpoint_ids=["c1", "c2"],
        primary_agent="checkpoint",
        checkpoint_optional_agents=["cost"],
        chat_intent="new_analysis",
        property_address="1 Main St",
    )
    payload = build_reasoning_engine_payload(
        request, property_id="p1", correlation_id="corr-1"
    )
    assert payload["user_query"] == "Run cost analysis"
    assert payload["user_id"] == "u1"
    assert payload["checkpoint_ids"] == ["c1", "c2"]
    assert payload["primary_agent"] == "checkpoint"
    assert payload["checkpoint_optional_agents"] == ["cost"]
    assert payload["chat_intent"] == "new_analysis"
    assert payload["property_address"] == "1 Main St"
    assert payload["property_id"] == "p1"
    assert payload["correlation_id"] == "corr-1"
