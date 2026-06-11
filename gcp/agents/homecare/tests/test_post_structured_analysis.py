"""Tests for post-structured-analysis helpers (flag gating + wrap-up reply)."""

from __future__ import annotations

from property_agent.routing.pending_user_action import PendingUserAction
from property_agent.routing.post_structured_analysis import (
    brief_post_structured_analysis_reply,
    pending_from_suggested_actions,
    run_branch_names_from_content_json,
    structured_analysis_ran,
)

_PARALLEL_RESULTS = '{"cost": {"summary": "..."}}'


def test_structured_analysis_ran_with_executed_branches() -> None:
    assert structured_analysis_ran(
        {"branches": ["cost"]},
        {"result": "analysis text"},
        {"checkpoint_parallel_results": _PARALLEL_RESULTS},
    )


def test_structured_analysis_not_ran_when_guards_filtered_to_empty() -> None:
    # Sticky UI toggle whose branch already completed: guards zero out branches,
    # the run is retrieval-only, and the post-synthesis hop must still happen.
    assert not structured_analysis_ran(
        {"branches": []},
        {"result": "retrieval summary"},
        {"checkpoint_parallel_results": _PARALLEL_RESULTS},
    )


def test_structured_analysis_not_ran_on_idempotent_skip() -> None:
    # before_tool short-circuit: args still carry branches but the tool never ran.
    assert not structured_analysis_ran(
        {"branches": ["cost"]},
        {"result": "Skipped: optional branch analysis already completed this session."},
        {"checkpoint_parallel_results": _PARALLEL_RESULTS},
    )


def test_structured_analysis_not_ran_without_parallel_results() -> None:
    assert not structured_analysis_ran(
        {"branches": ["cost"]},
        {"result": "analysis text"},
        {"checkpoint_parallel_results": None},
    )


def test_structured_analysis_not_ran_with_missing_args() -> None:
    assert not structured_analysis_ran(
        None, {"result": "x"}, {"checkpoint_parallel_results": _PARALLEL_RESULTS}
    )


def test_run_branch_names_dedupes_and_rejects_unknown() -> None:
    names = run_branch_names_from_content_json(
        {
            "suggestedActions": [
                {"label": "Cost", "action": {"type": "run_branch", "branch": "cost"}},
                {"label": "Cost again", "action": {"type": "run_branch", "branch": "cost"}},
                {"label": "Bogus", "action": {"type": "run_branch", "branch": "weather"}},
                {"label": "Discuss", "action": {"type": "discuss", "topic": "diy"}},
                "not-a-dict",
            ]
        }
    )
    assert names == ["cost"]


def test_brief_reply_lists_offered_branches() -> None:
    reply = brief_post_structured_analysis_reply(
        {
            "contentJson": {
                "suggestedActions": [
                    {"label": "Run cost", "action": {"type": "run_branch", "branch": "cost"}},
                ]
            }
        }
    )
    assert reply is not None
    assert "**cost**" in reply


def test_pending_from_suggested_actions_builds_run_branch_pending() -> None:
    pending = pending_from_suggested_actions(
        {
            "contentJson": {
                "suggestedActions": [
                    {"label": "Run cost analysis", "action": {"type": "run_branch", "branch": "cost"}},
                    {"label": "Find providers", "action": {"type": "run_branch", "branch": "service"}},
                ]
            }
        }
    )
    assert isinstance(pending, PendingUserAction)
    assert pending.kind == "run_branch"
    assert pending.run_optional_agents == ["cost", "service"]
    assert pending.offered_summary == "Run cost analysis; Find providers"


def test_pending_from_suggested_actions_none_without_run_branch_chips() -> None:
    assert pending_from_suggested_actions({"contentJson": {"suggestedActions": []}}) is None
    assert pending_from_suggested_actions({}) is None
