"""Tests for pending-offer extraction after assistant offers."""

from __future__ import annotations

from types import SimpleNamespace

from property_agent.routing.pending_offer_extract import (
    _heuristic_pending_from_offer,
    maybe_set_pending_from_assistant_reply,
    maybe_set_pending_from_suggested_actions,
    pending_offer_extract_enabled,
)
from property_agent.routing.pending_user_action import (
    PENDING_USER_ACTION_KEY,
    get_pending_user_action,
)
from property_agent.routing.recent_dialogue import last_assistant_reply_text


def test_last_assistant_reply_text_keeps_trailing_question() -> None:
    long_prefix = "x" * 400
    offer = f"{long_prefix} Would you like me to run **diy** or **service** analysis?"
    events = [
        SimpleNamespace(
            invocation_id="inv-1",
            author="property_agent",
            content=SimpleNamespace(parts=[SimpleNamespace(text=offer)]),
        )
    ]
    text = last_assistant_reply_text(events, require_question=True)
    assert text.endswith("?")
    assert "diy" in text.lower()


def test_heuristic_pending_from_dual_branch_offer() -> None:
    pending = _heuristic_pending_from_offer(
        "Summary here.\n\nWould you like me to run a detailed **diy** or **service** analysis?"
    )
    assert pending is not None
    assert pending.kind == "run_branch"
    assert set(pending.run_optional_agents) == {"diy", "service"}


def test_heuristic_pending_ignores_non_offer() -> None:
    assert _heuristic_pending_from_offer("Here is the summary with no question.") is None


def test_maybe_set_pending_heuristic_fallback(monkeypatch) -> None:
    monkeypatch.setattr(
        "property_agent.routing.pending_offer_extract.extract_pending_offer_from_text",
        lambda *_a, **_k: None,
    )
    state: dict = {}
    maybe_set_pending_from_assistant_reply(
        state,
        assistant_text="Would you like me to run **cost** analysis?",
        user_query="summarize",
    )
    pending = get_pending_user_action(state)
    assert pending is not None
    assert pending.run_optional_agents == ["cost"]


def test_pending_offer_extract_enabled() -> None:
    assert pending_offer_extract_enabled() is True


def test_maybe_set_pending_clears_on_success(monkeypatch) -> None:
    from property_agent.routing.pending_user_action import PendingUserAction

    monkeypatch.setattr(
        "property_agent.routing.pending_offer_extract.extract_pending_offer_from_text",
        lambda *_a, **_k: PendingUserAction(
            kind="run_branch",
            expanded_user_query="Run service analysis.",
            run_optional_agents=["service"],
        ),
    )
    state: dict = {}
    maybe_set_pending_from_assistant_reply(state, assistant_text="Want **service**?")
    assert state.get(PENDING_USER_ACTION_KEY) is not None


def test_maybe_set_pending_from_suggested_actions() -> None:
    state = {
        "contentJson": {
            "suggestedActions": [
                {
                    "label": "Run coverage analysis",
                    "action": {"type": "run_branch", "branch": "coverage"},
                },
                {
                    "label": "Run cost analysis",
                    "action": {"type": "run_branch", "branch": "cost"},
                },
            ],
        },
    }
    assert maybe_set_pending_from_suggested_actions(state) is True
    pending = get_pending_user_action(state)
    assert pending is not None
    assert pending.kind == "run_branch"
    assert pending.run_optional_agents == ["coverage", "cost"]


def test_maybe_set_pending_skips_when_branches_already_completed(monkeypatch) -> None:
    from property_agent.routing.pending_user_action import PendingUserAction

    monkeypatch.setattr(
        "property_agent.routing.pending_offer_extract.extract_pending_offer_from_text",
        lambda *_a, **_k: PendingUserAction(
            kind="run_branch",
            expanded_user_query="Run coverage, diy, service analysis.",
            run_optional_agents=["coverage", "diy", "service"],
        ),
    )
    state = {
        "_checkpoint_pipeline_completed": ["coverage", "diy", "service"],
        "checkpoint_analysis": {
            "analysis": {
                "analysisStatus": {
                    "coverage": "completed",
                    "diy": "completed",
                    "service": "completed",
                    "cost": "completed",
                },
            },
        },
    }
    maybe_set_pending_from_assistant_reply(
        state,
        assistant_text="Would you like coverage, diy, or service analysis?",
    )
    assert get_pending_user_action(state) is None


def test_maybe_set_pending_keeps_uncompleted_branches(monkeypatch) -> None:
    from property_agent.routing.pending_user_action import PendingUserAction

    monkeypatch.setattr(
        "property_agent.routing.pending_offer_extract.extract_pending_offer_from_text",
        lambda *_a, **_k: PendingUserAction(
            kind="run_branch",
            expanded_user_query="Run coverage, diy, service analysis.",
            run_optional_agents=["coverage", "diy", "service"],
        ),
    )
    state = {
        "checkpoint_analysis": {
            "costEstimationResults": {"costEstimates": {"total": 100}},
        },
    }
    maybe_set_pending_from_assistant_reply(
        state,
        assistant_text="Would you like coverage, diy, or service analysis?",
    )
    pending = get_pending_user_action(state)
    assert pending is not None
    assert set(pending.run_optional_agents) == {"coverage", "diy", "service"}
