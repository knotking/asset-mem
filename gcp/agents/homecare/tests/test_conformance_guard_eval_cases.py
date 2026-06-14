"""Schema and baseline tests for conformance guard eval (CI-safe, no LLM)."""

from __future__ import annotations

from pathlib import Path
from types import SimpleNamespace

import pytest

from property_agent.evals.conformance.run_conformance_guard_eval import (
    DEFAULT_BASELINE_PATH,
    DEFAULT_CASES_PATH,
    KNOWN_HANDLERS,
    compare_results_to_baseline,
    load_baseline,
    load_cases,
    run_guard_case,
    score_case,
)

pytestmark = pytest.mark.eval_dataset

_VALID_TOOLS = frozenset(
    {
        "analyze_checkpoints",
        "list_checkpoints",
        "report_retrieval",
        "user_docs_retrieval",
    }
)

_KNOWN_EXPECT_FIELDS = frozenset(
    {
        "blocked",
        "result_contains",
        "args_branches",
        "args_checkpoint_ids",
    }
)


@pytest.fixture(scope="module")
def dataset():
    assert Path(DEFAULT_CASES_PATH).exists()
    return load_cases(DEFAULT_CASES_PATH)


def test_cases_load_and_ids_unique(dataset) -> None:
    _, cases = dataset
    assert len(cases) >= 5
    ids = [c.get("id") for c in cases]
    assert all(isinstance(i, str) and i for i in ids)
    assert len(ids) == len(set(ids))


def test_case_structure_valid(dataset) -> None:
    _, cases = dataset
    for case in cases:
        cid = case["id"]
        assert case.get("handler") in KNOWN_HANDLERS, f"{cid}: unknown handler"
        assert str(case.get("tool") or "") in _VALID_TOOLS, f"{cid}: tool"
        expect = case.get("expect") or {}
        assert expect, f"{cid}: empty expect"
        unknown = set(expect) - _KNOWN_EXPECT_FIELDS
        assert not unknown, f"{cid}: unknown expect fields {unknown}"


def test_baseline_file_exists() -> None:
    assert DEFAULT_BASELINE_PATH.is_file()


def test_current_run_matches_committed_baseline() -> None:
    defaults, cases = load_cases(DEFAULT_CASES_PATH)
    baseline = load_baseline(DEFAULT_BASELINE_PATH)
    results = [run_guard_case(defaults, case) for case in cases]
    assert compare_results_to_baseline(results, baseline) == []


def test_score_case_detects_blocked_mismatch() -> None:
    outcome = {"blocked": False, "result": "ok"}
    mismatches = score_case(outcome, {"blocked": True})
    assert "blocked" in mismatches


def test_all_guard_cases_pass(dataset) -> None:
    defaults, cases = dataset
    results = [run_guard_case(defaults, case) for case in cases]
    failures = [r for r in results if not r.passed]
    assert not failures, [f"{r.case_id}: {r.mismatches or r.error}" for r in failures]
