"""ADK AgentEvaluator tests against web-recorded ``*.evalset.json`` files.

Golden datasets live under ``property_agent/evals/``. Each test is skipped until
you record the corresponding evalset from ``adk web`` (see ``property_agent/evals/README.md``).
"""

from __future__ import annotations

import pathlib

import dotenv
import pytest
from google.adk.evaluation.agent_evaluator import AgentEvaluator

pytest_plugins = ("pytest_asyncio",)

REPO_HOME = pathlib.Path(__file__).resolve().parents[1]
EVALS_DIR = REPO_HOME / "property_agent" / "evals"
EVAL_CONFIG = EVALS_DIR / "test_config.json"


@pytest.fixture(scope="session", autouse=True)
def load_env():
    dotenv.load_dotenv()


def _evalset_path(filename: str) -> pathlib.Path:
    return EVALS_DIR / filename


def _require_evalset(filename: str, recording_hint: str) -> pathlib.Path:
    path = _evalset_path(filename)
    if not path.is_file():
        pytest.skip(
            f"Missing golden eval: {path}\n\n"
            f"Record from adk web:\n{recording_hint}"
        )
    return path


async def _run_eval(*, agent_module: str, evalset_file: str, recording_hint: str) -> None:
    path = _require_evalset(evalset_file, recording_hint)
    await AgentEvaluator.evaluate(
        agent_module=agent_module,
        eval_dataset_file_path_or_dir=str(path),
        num_runs=1,
        print_detailed_results=True,
    )


@pytest.mark.asyncio
async def test_eval_doculink_routing():
    """Root → doculink routing for a general property query."""
    await _run_eval(
        agent_module="property_agent",
        evalset_file="doculink_routing.evalset.json",
        recording_hint=(
            "1. uv run adk web → select property_agent\n"
            "2. Send a property-related question (no checkpoint_ids / primary_agent)\n"
            "3. Eval tab → create eval set → save as doculink_routing.evalset.json\n"
            "4. Expect trajectory: transfer_to_agent(agent_name=doculink_agent)"
        ),
    )


@pytest.mark.asyncio
async def test_eval_doculink_docs():
    """DocuLink user-document retrieval (primary_agent=docs or context_doc_uris)."""
    await _run_eval(
        agent_module="property_agent",
        evalset_file="doculink_docs.evalset.json",
        recording_hint=(
            "1. uv run adk web → property_agent\n"
            "2. Session with primary_agent=docs and/or context_doc_uris; ask about uploaded docs\n"
            "3. Save eval set as doculink_docs.evalset.json\n"
            "4. Expect: transfer_to_agent → doculink_agent → ask_user_docs_agent (and/or knowledge_base_agent)"
        ),
    )


@pytest.mark.asyncio
async def test_eval_checkpoint_optional_agents():
    """Checkpoint retrieval plus optional analysis (coverage, diy, service, cost)."""
    await _run_eval(
        agent_module="property_agent",
        evalset_file="checkpoint_optional_agents.evalset.json",
        recording_hint=(
            "1. uv run adk web → property_agent\n"
            "2. Provide checkpoint_ids, property_id, checkpoint_optional_agents "
            '["coverage","diy","service","cost"]\n'
            "3. Save as checkpoint_optional_agents.evalset.json\n"
            "4. Expect: doculink → checkpoint_agent → checkpoint_progress_agent"
        ),
    )


@pytest.mark.asyncio
async def test_eval_cost_agent():
    """Isolated cost_agent tool trajectory and response."""
    await _run_eval(
        agent_module="property_agent.sub_agents.cost_agent",
        evalset_file="cost_agent.evalset.json",
        recording_hint=(
            "1. uv run adk web → property_agent (or cost-only session if available)\n"
            "2. Query that triggers cost_estimation / cost_estimation_diy only\n"
            "3. Save as cost_agent.evalset.json\n"
            "4. Run: uv run adk eval property_agent.sub_agents.cost_agent "
            "property_agent/evals/cost_agent.evalset.json "
            "--config_file_path=property_agent/evals/test_config.json"
        ),
    )


@pytest.mark.asyncio
async def test_eval_shopping_agent():
    """Isolated shopping_agent product recommendations."""
    await _run_eval(
        agent_module="property_agent.sub_agents.shopping_agent",
        evalset_file="shopping_agent.evalset.json",
        recording_hint=(
            "1. uv run adk web → session that calls product_recommendations\n"
            "2. Example: product search for a DIY repair (needs SERP_API_KEY)\n"
            "3. Save as shopping_agent.evalset.json"
        ),
    )


@pytest.mark.asyncio
async def test_eval_service_agent():
    """Isolated service_agent (serpapi_search / google_search)."""
    await _run_eval(
        agent_module="property_agent.sub_agents.service_agent",
        evalset_file="service_agent.evalset.json",
        recording_hint=(
            "1. uv run adk web → session asking for local service providers\n"
            "2. Needs SERP_API_KEY; expect serpapi_search and/or google_search\n"
            "3. Save as service_agent.evalset.json"
        ),
    )
