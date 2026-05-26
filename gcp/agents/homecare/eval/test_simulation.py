"""Live ADK user-simulation evals (ConversationScenario + UserSimulator).

Opt-in: RUN_ADK_SIMULATION_TESTS=1 and GCP credentials (see property_agent/evals/README.md).
"""

from __future__ import annotations

import pathlib

import dotenv
import pytest
from google.adk.evaluation.agent_evaluator import AgentEvaluator
from eval.rubric_criteria import config_simulation
from eval.simulation_gates import requires_gcp_project, requires_simulation_eval

pytest_plugins = ("pytest_asyncio",)

REPO_HOME = pathlib.Path(__file__).resolve().parents[1]
EVALS_DIR = REPO_HOME / "property_agent" / "evals"
SIMULATION_EVALSET = EVALS_DIR / "simulation.evalset.json"


@pytest.fixture(scope="session", autouse=True)
def load_env():
    dotenv.load_dotenv()


def _require_simulation_evalset() -> pathlib.Path:
    if not SIMULATION_EVALSET.is_file():
        pytest.skip(f"Missing simulation evalset: {SIMULATION_EVALSET}")
    return SIMULATION_EVALSET


@pytest.mark.integration_simulation
@pytest.mark.asyncio
@requires_simulation_eval
@requires_gcp_project
async def test_simulation_evalset():
    """Run all conversation_scenario cases with multi-turn metrics."""
    path = _require_simulation_evalset()
    eval_config = config_simulation()
    eval_set = AgentEvaluator._load_eval_set_from_file(
        str(path),
        eval_config,
        initial_session={},
    )
    await AgentEvaluator.evaluate_eval_set(
        agent_module="property_agent",
        eval_set=eval_set,
        eval_config=eval_config,
        num_runs=1,
        print_detailed_results=True,
    )


@pytest.mark.integration_simulation
@pytest.mark.asyncio
@requires_simulation_eval
@requires_gcp_project
async def test_simulation_routing_scenario_only():
    """Subset: routing_greeting_property_care scenario only."""
    from google.adk.evaluation.eval_set import EvalSet

    path = _require_simulation_evalset()
    full = EvalSet.model_validate_json(path.read_text(encoding="utf-8"))
    subset = full.model_copy(
        update={
            "eval_cases": [
                c
                for c in full.eval_cases
                if c.eval_id == "routing_greeting_property_care"
            ]
        }
    )
    if not subset.eval_cases:
        pytest.skip("routing_greeting_property_care not in simulation.evalset.json")

    eval_config = config_simulation()
    await AgentEvaluator.evaluate_eval_set(
        agent_module="property_agent",
        eval_set=subset,
        eval_config=eval_config,
        num_runs=1,
        print_detailed_results=True,
    )
