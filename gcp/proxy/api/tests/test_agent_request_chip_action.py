"""Schema tests for the structured chip_action field on AgentRequest."""

import pytest
from pydantic import ValidationError

from schemas.agent import AgentRequest, ChipActionRequest


def _base_request(**overrides):
    data = {"user_id": "u1", "user_query": "Run cost analysis"}
    data.update(overrides)
    return AgentRequest(**data)


def test_chip_action_defaults_to_none():
    assert _base_request().chip_action is None


def test_chip_action_run_branch_parses():
    req = _base_request(chip_action={"type": "run_branch", "branch": "cost"})
    assert isinstance(req.chip_action, ChipActionRequest)
    assert req.chip_action.model_dump(exclude_none=True) == {
        "type": "run_branch",
        "branch": "cost",
    }


def test_chip_action_discuss_with_topic():
    req = _base_request(chip_action={"type": "discuss", "topic": "diy"})
    assert req.chip_action.topic == "diy"


def test_chip_action_rejects_unknown_type_and_branch():
    with pytest.raises(ValidationError):
        _base_request(chip_action={"type": "self_destruct"})
    with pytest.raises(ValidationError):
        _base_request(chip_action={"type": "run_branch", "branch": "bogus"})
