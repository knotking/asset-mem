"""Tests for NLU-first resolve (discourse_act, pending offers, thin guardrails)."""

from __future__ import annotations

import pytest

from property_agent.routing.apply_resolved_turn import (
    sanitize_llm_payload,
    sanitize_llm_payload_nlu_first,
)
from property_agent.routing.nlu_first_resolve import (
    apply_discourse_act_to_payload,
    nlu_first_resolve_enabled,
)
from property_agent.routing.pending_user_action import (
    PendingUserAction,
    consume_pending_for_resolve,
    is_short_reply,
    set_pending_user_action,
)


def _analysis_state() -> dict:
    return {
        "checkpoint_last_response_kind": "analysis",
        "checkpoint_analysis": {
            "analysis": {
                "checkpointSummary": {"locations": ["Garage"]},
                "diyResults": {"diySteps": {"steps": [{"description": "Clean"}]}},
                "costEstimationResults": {
                    "costEstimates": {
                        "Service": {"cost_range": "$300 - $800"},
                    }
                },
            }
        },
    }


def test_discourse_explain_prior_blocks_branches() -> None:
    out = apply_discourse_act_to_payload(
        {"route": "checkpoint", "expanded_user_query": "why is pro expensive"},
        discourse_act="explain_prior",
        focus_branch="cost",
    )
    assert out["user_goal"] == "answer_from_context"
    assert out["run_optional_agents"] == []
    assert out["retrieval_only"] is True
    assert out["focus_branch"] == "cost"


def test_sanitize_explain_prior_paraphrase_no_service() -> None:
    state = {**_analysis_state(), "checkpoint_optional_agents": ["service"]}
    out = sanitize_llm_payload_nlu_first(
        {
            "discourse_act": "explain_prior",
            "focus_branch": "cost",
            "intent": "substantive",
            "route": "checkpoint",
            "expanded_user_query": "Why is professional so expensive?",
            "retrieval_only": False,
            "run_optional_agents": ["service"],
            "user_goal": "new_analysis",
        },
        user_query="why is professional so expensive?",
        state=state,
    )
    assert out is not None
    assert out["discourse_act"] == "explain_prior"
    assert out["run_optional_agents"] == []
    assert out["user_goal"] == "answer_from_context"


def test_sanitize_pro_advisory_paraphrase() -> None:
    state = _analysis_state()
    out = sanitize_llm_payload_nlu_first(
        {
            "discourse_act": "explain_prior",
            "focus_branch": "cost",
            "intent": "substantive",
            "route": "checkpoint",
            "expanded_user_query": "That pro estimate seems high compared to DIY",
            "retrieval_only": True,
            "run_optional_agents": [],
            "user_goal": "answer_from_context",
        },
        user_query="that pro estimate seems high",
        state=state,
    )
    assert out is not None
    assert out["discourse_act"] == "explain_prior"
    assert out["run_optional_agents"] == []


def test_accept_offer_route_none_normalizes_to_checkpoint() -> None:
    out = sanitize_llm_payload_nlu_first(
        {
            "discourse_act": "accept_offer",
            "intent": "substantive",
            "route": "none",
            "expanded_user_query": "Yes, find local service providers.",
            "retrieval_only": False,
            "run_optional_agents": ["service"],
            "user_goal": "new_analysis",
        },
        user_query="yes",
        state={},
    )
    assert out is not None
    assert out["route"] == "checkpoint"
    assert out["run_optional_agents"] == ["service"]


def test_accept_offer_with_pending_cost() -> None:
    state: dict = {}
    set_pending_user_action(
        state,
        PendingUserAction(
            kind="run_branch",
            expanded_user_query="Run cost analysis for the garage door.",
            run_optional_agents=["cost"],
        ),
    )
    out = sanitize_llm_payload_nlu_first(
        {
            "discourse_act": "accept_offer",
            "intent": "substantive",
            "route": "checkpoint",
            "expanded_user_query": "yes",
            "retrieval_only": True,
            "run_optional_agents": [],
            "user_goal": "answer_from_context",
        },
        user_query="yes",
        state=state,
    )
    assert out is not None
    assert out["discourse_act"] == "accept_offer"
    assert out["run_optional_agents"] == ["cost"]
    assert out["user_goal"] == "new_analysis"
    assert state.get("pending_user_action") is None


def test_short_reply_pending_override() -> None:
    state: dict = {}
    set_pending_user_action(
        state,
        PendingUserAction(
            kind="run_branch",
            expanded_user_query="Run cost analysis.",
            run_optional_agents=["cost"],
        ),
    )
    out = consume_pending_for_resolve(
        {
            "intent": "acknowledgment",
            "route": "none",
            "expanded_user_query": "ok",
            "retrieval_only": True,
            "run_optional_agents": [],
        },
        user_query="ok",
        state=state,
        discourse_act="closure",
    )
    assert out["discourse_act"] == "accept_offer"
    assert out["run_optional_agents"] == ["cost"]


def test_closure_thanks_not_accept() -> None:
    state: dict = {}
    set_pending_user_action(
        state,
        PendingUserAction(
            kind="run_branch",
            expanded_user_query="Run cost analysis.",
            run_optional_agents=["cost"],
        ),
    )
    out = sanitize_llm_payload_nlu_first(
        {
            "discourse_act": "closure",
            "intent": "acknowledgment",
            "route": "none",
            "expanded_user_query": "thanks, that's helpful",
            "retrieval_only": True,
            "run_optional_agents": [],
            "user_goal": "answer_from_context",
        },
        user_query="thanks that's helpful",
        state=state,
    )
    assert out is not None
    assert out["intent"] == "acknowledgment"
    assert out.get("run_optional_agents") == []


def test_new_work_find_providers() -> None:
    state = _analysis_state()
    out = sanitize_llm_payload_nlu_first(
        {
            "discourse_act": "new_work",
            "intent": "substantive",
            "route": "checkpoint",
            "expanded_user_query": "find me more service providers",
            "retrieval_only": False,
            "run_optional_agents": ["service"],
            "user_goal": "new_analysis",
        },
        user_query="find me more service providers",
        state=state,
    )
    assert out is not None
    assert out["user_goal"] == "new_analysis"
    assert out["run_optional_agents"] == ["service"]


def test_is_short_reply_shape_only() -> None:
    assert is_short_reply("yes")
    assert is_short_reply("ok")
    assert not is_short_reply("thanks that's helpful")


def test_nlu_first_defaults_on_when_unset(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("HOMEAPP_NLU_FIRST_RESOLVE", raising=False)
    assert nlu_first_resolve_enabled()


def test_legacy_path_when_flag_off(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("HOMEAPP_NLU_FIRST_RESOLVE", "0")
    assert not nlu_first_resolve_enabled()
    out = sanitize_llm_payload(
        {
            "intent": "acknowledgment",
            "route": "none",
            "expanded_user_query": "thanks",
            "retrieval_only": True,
            "run_optional_agents": [],
        },
        user_query="thanks",
        state={},
    )
    assert out is not None
    assert out["intent"] == "acknowledgment"
