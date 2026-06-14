"""Schema and baseline tests for trajectory eval (CI-safe, no LLM)."""

from __future__ import annotations

from pathlib import Path
from types import SimpleNamespace

import pytest

from property_agent.evals.routing.run_routing_eval import resolve_turn_single_loop
from property_agent.evals.trajectory.predict_trajectory import predict_trajectory
from property_agent.evals.trajectory.run_trajectory_eval import (
    DEFAULT_BASELINE_PATH,
    DEFAULT_CASES_PATH,
    KNOWN_EXPECT_FIELDS,
    compare_results_to_baseline,
    load_baseline,
    load_cases,
    run_case,
    score_case,
)
from property_agent.routing.optional_branches import OPTIONAL_CHECKPOINT_BRANCHES

pytestmark = pytest.mark.eval_dataset

_VALID_TOOLS = frozenset(
    {
        "list_checkpoints",
        "analyze_checkpoints",
        "user_docs_retrieval",
        "report_retrieval",
    }
)


@pytest.fixture(scope="module")
def dataset():
    assert Path(DEFAULT_CASES_PATH).exists()
    return load_cases(DEFAULT_CASES_PATH)


def test_cases_load_and_ids_unique(dataset) -> None:
    _, cases = dataset
    assert len(cases) >= 10
    ids = [c.get("id") for c in cases]
    assert all(isinstance(i, str) and i for i in ids)
    assert len(ids) == len(set(ids))


def test_case_structure_valid(dataset) -> None:
    _, cases = dataset
    for case in cases:
        cid = case["id"]
        assert isinstance(case.get("query"), str) and case["query"].strip(), cid
        expect = case.get("expect") or {}
        assert expect, f"{cid}: empty expect"
        unknown = set(expect) - set(KNOWN_EXPECT_FIELDS)
        assert not unknown, f"{cid}: unknown expect fields {unknown}"
        for tool in expect.get("tools_called") or []:
            assert tool in _VALID_TOOLS, f"{cid}: tool {tool}"
        for branch in expect.get("branches") or []:
            assert branch in OPTIONAL_CHECKPOINT_BRANCHES, f"{cid}: branch {branch}"


def test_baseline_file_exists() -> None:
    assert DEFAULT_BASELINE_PATH.is_file()


def test_current_run_matches_committed_baseline() -> None:
    defaults, cases = load_cases(DEFAULT_CASES_PATH)
    baseline = load_baseline(DEFAULT_BASELINE_PATH)
    results = [run_case(defaults, case) for case in cases]
    assert compare_results_to_baseline(results, baseline) == []


def test_predict_trajectory_inventory_overrides_retrieval_only(dataset) -> None:
    _, cases = dataset
    case = next(c for c in cases if c["id"] == "inventory_list_checkpoints")
    state = dict(case.get("state") or {})
    state.setdefault("primary_agent", "checkpoint")
    resolved = resolve_turn_single_loop(
        user_query=str(case["query"]),
        state=state,
    )
    prediction = predict_trajectory(resolved, state, user_query=case["query"])
    assert list(prediction.tools_called) == ["list_checkpoints"]


def test_score_case_detects_tool_mismatch() -> None:
    prediction = SimpleNamespace(
        tools_called=("list_checkpoints",),
        branches=(),
        retrieval_only=True,
    )
    mismatches = score_case(prediction, {"tools_called": ["analyze_checkpoints"]})
    assert "tools_called" in mismatches
