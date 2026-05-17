"""Validate simulation evalset structure (no live Vertex)."""

from __future__ import annotations

import json
from pathlib import Path

from google.adk.evaluation.eval_set import EvalSet

EVALS_DIR = Path(__file__).resolve().parents[1] / "property_agent" / "evals"


def test_simulation_evalset_schema() -> None:
    path = EVALS_DIR / "simulation.evalset.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    eval_set = EvalSet.model_validate(data)
    assert len(eval_set.eval_cases) >= 2
    for case in eval_set.eval_cases:
        assert case.conversation_scenario is not None
        assert case.conversation is None
        assert case.session_input is not None
        assert case.session_input.app_name == "property_agent"


def test_simulation_config_matches_rubric_criteria() -> None:
    from eval.rubric_criteria import config_simulation
    from google.adk.evaluation.eval_config import get_evaluation_criteria_or_default

    on_disk = get_evaluation_criteria_or_default(
        str(EVALS_DIR / "test_config_simulation.json")
    )
    from_code = config_simulation()
    assert set(on_disk.criteria.keys()) == set(from_code.criteria.keys())
    assert on_disk.user_simulator_config is not None


def test_conversation_scenarios_align_with_evalset() -> None:
    scenarios_path = EVALS_DIR / "conversation_scenarios.json"
    eval_path = EVALS_DIR / "simulation.evalset.json"
    scenarios = json.loads(scenarios_path.read_text(encoding="utf-8"))["scenarios"]
    eval_set = EvalSet.model_validate_json(eval_path.read_text(encoding="utf-8"))
    scenario_ids = {s["eval_id"] for s in scenarios}
    eval_ids = {c.eval_id for c in eval_set.eval_cases}
    assert scenario_ids == eval_ids
