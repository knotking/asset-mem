"""Single-loop routing tests."""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import patch

import pytest
from datetime import datetime, timezone
from google.genai import types

from agent_framework.routing.resolved_turn import RESOLVE_APPLIED_INVOCATION_KEY
from property_agent.model_config import (
    SINGLE_LOOP_GEMINI_MODEL,
    SINGLE_LOOP_GEMINI_MODEL_NAME,
    global_agent_gemini_model,
)
from property_agent.routing.conversational_intent import CONVERSATIONAL_TURN_STATE_KEY
from property_agent.routing.single_loop_routing import (
    arm_user_docs_passthrough,
    bare_casual_intent,
    extract_tool_result_text,
    format_slim_session_context_block,
    inject_slim_session_context_into_llm_request,
    minimal_substantive_resolved_turn,
    prepare_single_loop_before_model,
    resolve_turn_from_pending_offer,
)
from property_agent.routing.pending_user_action import (
    PENDING_USER_ACTION_KEY,
    PendingUserAction,
    set_pending_user_action,
)
from property_agent.routing.resolve_turn import prepare_before_model_turn


def _ctx(*, query: str = "hello", state: dict | None = None) -> SimpleNamespace:
    merged = {"user_query": query, **(state or {})}
    return SimpleNamespace(
        state=merged,
        _invocation_context=SimpleNamespace(
            invocation_id="inv-1",
            session=SimpleNamespace(events=[]),
        ),
    )


@pytest.mark.parametrize(
    ("query", "expected"),
    [
        ("hi", "greeting"),
        ("Hello!", "greeting"),
        ("good morning", "greeting"),
        ("what can you do", "capabilities"),
        ("what should I do about the leak", None),
        ("analyse my checkpoints", None),
        ("hi there how are you", None),
    ],
)
def test_bare_casual_intent(query: str, expected: str | None) -> None:
    assert bare_casual_intent(query) == expected


def test_global_agent_gemini_model_uses_single_loop_model() -> None:
    assert SINGLE_LOOP_GEMINI_MODEL.model == SINGLE_LOOP_GEMINI_MODEL_NAME
    assert global_agent_gemini_model() is SINGLE_LOOP_GEMINI_MODEL


def test_prepare_before_model_turn_uses_single_loop_path() -> None:
    ctx = _ctx(query="list checkpoints")
    llm_request = SimpleNamespace(config=None)
    assert prepare_before_model_turn(ctx, llm_request=llm_request) is None
    assert "[SESSION_CONTEXT]" in str(
        getattr(llm_request.config, "system_instruction", "")
    )


def test_prepare_single_loop_casual_short_circuit() -> None:
    ctx = _ctx(query="hey")
    response = prepare_single_loop_before_model(
        ctx, llm_request=SimpleNamespace(config=None)
    )
    assert response is not None
    assert ctx.state.get(CONVERSATIONAL_TURN_STATE_KEY) is True


def test_prepare_single_loop_skips_re_resolve_same_invocation() -> None:
    ctx = _ctx(
        query="analyse cost",
        state={
            RESOLVE_APPLIED_INVOCATION_KEY: "inv-1",
            "resolved_turn": minimal_substantive_resolved_turn(
                {"primary_agent": "checkpoint"},
                user_query="analyse cost",
            ).to_dict(),
        },
    )
    llm_request = SimpleNamespace(config=None)
    with patch(
        "property_agent.routing.single_loop_routing.hydrate_turn_state_from_context"
    ) as mock_hydrate:
        assert prepare_single_loop_before_model(ctx, llm_request=llm_request) is None
        mock_hydrate.assert_not_called()
    assert "[SESSION_CONTEXT]" in str(
        getattr(llm_request.config, "system_instruction", "")
    )


def test_prepare_single_loop_short_circuits_post_structured_analysis() -> None:
    ctx = _ctx(
        query="Run DIY analysis",
        state={
            RESOLVE_APPLIED_INVOCATION_KEY: "inv-1",
            "_executor_invocation_structured_analysis": True,
            "resolved_turn": minimal_substantive_resolved_turn(
                {"primary_agent": "checkpoint", "checkpoint_optional_agents": ["diy"]},
                user_query="Run DIY analysis",
            ).to_dict(),
            "contentJson": {
                "suggestedActions": [
                    {
                        "label": "Run cost analysis",
                        "action": {"type": "run_branch", "branch": "cost"},
                    },
                    {
                        "label": "Find local providers",
                        "action": {"type": "run_branch", "branch": "service"},
                    },
                ],
            },
        },
    )
    response = prepare_single_loop_before_model(
        ctx, llm_request=SimpleNamespace(config=None)
    )
    assert response is not None
    assert response.content is not None
    text = response.content.parts[0].text or ""
    assert "completed the analysis above" in text
    assert "**cost**" in text
    assert "**service**" in text


def test_prepare_single_loop_chip_injects_resolved_turn() -> None:
    ctx = _ctx(
        query="Run coverage",
        state={
            "chip_action": {"type": "run_branch", "branch": "coverage"},
            "checkpoint_optional_agents": ["coverage"],
        },
    )
    llm_request = SimpleNamespace(config=None)
    assert prepare_single_loop_before_model(ctx, llm_request=llm_request) is None
    si = getattr(llm_request.config, "system_instruction", "")
    assert "[RESOLVED_TURN]" in str(si)
    assert ctx.state.get("chip_action") is None


def test_resolve_turn_from_pending_offer_cost() -> None:
    state: dict = {"primary_agent": "checkpoint"}
    set_pending_user_action(
        state,
        PendingUserAction(
            kind="run_branch",
            expanded_user_query="Run cost analysis for the vehicle paint damage.",
            run_optional_agents=["cost"],
        ),
    )
    resolved = resolve_turn_from_pending_offer(state, user_query="yes")
    assert resolved is not None
    assert resolved.discourse_act == "accept_offer"
    assert resolved.run_optional_agents == ["cost"]
    assert resolved.user_goal == "new_analysis"
    assert resolved.retrieval_only is False
    assert state.get(PENDING_USER_ACTION_KEY) is None


def test_resolve_turn_from_pending_offer_ignores_thanks() -> None:
    state: dict = {"primary_agent": "checkpoint"}
    set_pending_user_action(
        state,
        PendingUserAction(
            kind="run_branch",
            expanded_user_query="Run cost analysis.",
            run_optional_agents=["cost"],
        ),
    )
    assert resolve_turn_from_pending_offer(state, user_query="thanks") is None
    assert state.get(PENDING_USER_ACTION_KEY) is not None


def test_prepare_single_loop_accept_offer_injects_resolved_turn() -> None:
    ctx = _ctx(
        query="yes",
        state={
            "primary_agent": "checkpoint",
            "checkpoint_ids": ["cp-1"],
            PENDING_USER_ACTION_KEY: PendingUserAction(
                kind="run_branch",
                expanded_user_query="Run DIY and service analysis.",
                run_optional_agents=["diy", "service"],
            ).to_dict(),
        },
    )
    llm_request = SimpleNamespace(config=None)
    assert prepare_single_loop_before_model(ctx, llm_request=llm_request) is None
    si = str(getattr(llm_request.config, "system_instruction", ""))
    assert "[RESOLVED_TURN]" in si
    resolved = ctx.state["resolved_turn"]
    assert resolved["discourse_act"] == "accept_offer"
    assert resolved["run_optional_agents"] == ["diy", "service"]
    assert ctx.state.get(PENDING_USER_ACTION_KEY) is None
    assert ctx.state.get(CONVERSATIONAL_TURN_STATE_KEY) is False


def test_format_slim_session_context_block() -> None:
    fixed = datetime(2026, 6, 12, 17, 10, tzinfo=timezone.utc)
    block = format_slim_session_context_block(
        {
            "property_address": "123 Main St",
            "property_id": "prop-1",
            "primary_agent": "checkpoint",
            "checkpoint_ids": ["cp-1", "cp-2"],
            "context_doc_uris": [],
            "report_ids": ["r-1"],
            "checkpoint_optional_agents": ["cost"],
        },
        now=fixed,
    )
    assert "[SESSION_CONTEXT]" in block
    assert '"current_date_utc": "2026-06-12"' in block
    assert '"current_year": 2026' in block
    assert "checkpoint_ids_count" in block
    assert '"checkpoint_ids_count": 2' in block
    assert '"cost"' in block
    assert "routing_mode" in block


def test_prepare_single_loop_clears_stale_ui_toggles() -> None:
    """Persisted toggles from a prior turn must not leak into this turn's resolved turn."""
    ctx = _ctx(
        query="what should I do about the leak",
        state={
            "primary_agent": "checkpoint",
            "checkpoint_optional_agents": ["cost"],
        },
    )
    assert (
        prepare_single_loop_before_model(ctx, llm_request=SimpleNamespace(config=None))
        is None
    )
    assert ctx.state["checkpoint_optional_agents"] == []
    resolved = ctx.state["resolved_turn"]
    assert resolved["run_optional_agents"] == []
    assert resolved["retrieval_only"] is True


def test_inject_slim_session_context_strips_resolved_turn() -> None:
    llm_request = SimpleNamespace(
        config=types.GenerateContentConfig(
            system_instruction="base\n\n[RESOLVED_TURN]\n{}\n[/RESOLVED_TURN]"
        )
    )
    inject_slim_session_context_into_llm_request(
        llm_request, block="[SESSION_CONTEXT]\n{}\n[/SESSION_CONTEXT]"
    )
    si = str(llm_request.config.system_instruction)
    assert "[RESOLVED_TURN]" not in si
    assert "[SESSION_CONTEXT]" in si
    assert "base" in si


def test_arm_user_docs_passthrough_seeds_result_for_replay_tool_response() -> None:
    state: dict[str, object] = {
        "resolved_turn": {"route": "user_docs"},
        "primary_agent": "docs",
    }
    arm_user_docs_passthrough(
        state,
        tool_response={"result": "No relevant information could be found."},
        route="user_docs",
        primary_agent="docs",
    )
    assert state["user_docs_result"] == "No relevant information could be found."
    assert state["_executor_user_docs_passthrough"] is True


def test_prepare_single_loop_user_docs_passthrough_short_circuits() -> None:
    state = {
        "_executor_user_docs_passthrough": True,
        "user_docs_result": "Policy excerpt about water damage.",
    }
    ctx = _ctx(query="water damage?", state=state)
    response = prepare_single_loop_before_model(ctx)
    assert response is not None
    assert "Policy excerpt" in str(response)
    assert ctx.state["_executor_user_docs_passthrough"] is False


def test_prepare_single_loop_user_docs_passthrough_without_result_does_not_clear_flag() -> None:
    state = {"_executor_user_docs_passthrough": True}
    ctx = _ctx(query="water damage?", state=state)
    assert prepare_single_loop_before_model(ctx) is None
    assert ctx.state["_executor_user_docs_passthrough"] is True


def test_extract_tool_result_text_accepts_string_or_dict() -> None:
    assert extract_tool_result_text("  hello  ") == "hello"
    assert extract_tool_result_text({"result": "from dict"}) == "from dict"
    assert extract_tool_result_text({}) == ""
