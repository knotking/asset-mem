"""Schema validation for the routing eval dataset (CI-safe, no LLM calls)."""

from __future__ import annotations

from pathlib import Path

import pytest

from property_agent.evals.routing.run_routing_eval import (
    DEFAULT_CASES_PATH,
    KNOWN_EXPECT_FIELDS,
    build_events,
    build_state,
    load_cases,
    score_case,
)
from property_agent.routing.optional_branches import OPTIONAL_CHECKPOINT_BRANCHES
from property_agent.routing.nlu_first_resolve import DISCOURSE_ACTS
from property_agent.routing.schema import ResolvedTurn

_VALID_ROUTES = {"none", "checkpoint", "user_docs", "report"}
_VALID_INTENTS = {"greeting", "capabilities", "acknowledgment", "substantive"}
_VALID_USER_GOALS = {"answer_from_context", "new_analysis", "replay_deliverable"}
_VALID_FOCUS = {"checkpoint", "coverage", "diy", "service", "cost", "documents", None}


def _as_list(value):
    return value if isinstance(value, list) else [value]


@pytest.fixture(scope="module")
def dataset():
    assert Path(DEFAULT_CASES_PATH).exists()
    return load_cases(DEFAULT_CASES_PATH)


def test_cases_load_and_ids_unique(dataset) -> None:
    _, cases = dataset
    assert len(cases) >= 30
    ids = [c.get("id") for c in cases]
    assert all(isinstance(i, str) and i for i in ids)
    assert len(ids) == len(set(ids)), "duplicate case ids"


def test_case_structure_valid(dataset) -> None:
    defaults, cases = dataset
    for case in cases:
        cid = case["id"]
        assert isinstance(case.get("query"), str) and case["query"].strip(), cid
        state = build_state(defaults, case)
        assert isinstance(state, dict), cid
        for turn in case.get("dialogue") or []:
            assert turn.get("role") in ("user", "assistant"), cid
            assert isinstance(turn.get("text"), str) and turn["text"].strip(), cid
        expect = case.get("expect") or {}
        assert expect, f"{cid}: empty expect block"
        unknown = set(expect) - set(KNOWN_EXPECT_FIELDS)
        assert not unknown, f"{cid}: unknown expect fields {unknown}"


def test_expectation_values_within_enums(dataset) -> None:
    _, cases = dataset
    for case in cases:
        cid = case["id"]
        expect = case.get("expect") or {}
        for act in _as_list(expect.get("discourse_act", [])):
            assert act in DISCOURSE_ACTS, f"{cid}: {act}"
        for intent in _as_list(expect.get("intent", [])):
            assert intent in _VALID_INTENTS, f"{cid}: {intent}"
        for route in _as_list(expect.get("route", [])):
            assert route in _VALID_ROUTES, f"{cid}: {route}"
        for goal in _as_list(expect.get("user_goal", [])):
            assert goal in _VALID_USER_GOALS, f"{cid}: {goal}"
        for focus in _as_list(expect.get("focus_branch", [])):
            assert focus in _VALID_FOCUS, f"{cid}: {focus}"
        if "retrieval_only" in expect:
            for value in _as_list(expect["retrieval_only"]):
                assert isinstance(value, bool), cid
        for branch in expect.get("run_optional_agents") or []:
            assert branch in OPTIONAL_CHECKPOINT_BRANCHES, f"{cid}: {branch}"
        for option in expect.get("run_optional_agents_any_of") or []:
            assert isinstance(option, list), cid
            for branch in option:
                assert branch in OPTIONAL_CHECKPOINT_BRANCHES, f"{cid}: {branch}"
        assert not (
            "run_optional_agents" in expect and "run_optional_agents_any_of" in expect
        ), f"{cid}: use only one branch expectation style"


def test_build_events_shape(dataset) -> None:
    _, cases = dataset
    case = next(c for c in cases if c.get("dialogue"))
    events = build_events(case["dialogue"])
    assert events
    for event in events:
        assert event.author in ("user", "property_agent")
        assert event.content.parts[0].text


def test_score_case_matches_and_mismatches() -> None:
    resolved = ResolvedTurn(
        intent="substantive",
        route="checkpoint",
        expanded_user_query="run cost analysis",
        retrieval_only=False,
        run_optional_agents=["cost"],
        user_goal="new_analysis",
        discourse_act="new_work",
    )
    assert (
        score_case(
            resolved,
            {
                "discourse_act": "new_work",
                "route": "checkpoint",
                "retrieval_only": False,
                "run_optional_agents": ["cost"],
                "user_goal": "new_analysis",
            },
        )
        == {}
    )
    mismatches = score_case(
        resolved, {"run_optional_agents": [], "retrieval_only": True}
    )
    assert set(mismatches) == {"run_optional_agents", "retrieval_only"}
    # any_of accepts either set
    assert (
        score_case(
            resolved, {"run_optional_agents_any_of": [["cost"], ["cost", "diy"]]}
        )
        == {}
    )
