"""ADK AgentEvaluator tests against web-recorded ``*.evalset.json`` files.

Golden datasets live under ``property_agent/evals/``. Each test is skipped until
you record the corresponding evalset from ``adk web`` (see ``property_agent/evals/README.md``).

Rubric-based criteria (dual-format checkpoint output, routing tool use, branch
sections) are defined in ``eval/rubric_criteria.py`` and ``property_agent/evals/rubrics/``.
"""

from __future__ import annotations

import pathlib
import dotenv
import pytest
from google.adk.evaluation.agent_evaluator import AgentEvaluator
from google.adk.evaluation.eval_config import EvalConfig

from eval.rubric_criteria import (
    config_checkpoint,
    config_checkpoint_branch,
    config_conversational,
    config_default,
    config_routing,
)

pytest_plugins = ("pytest_asyncio",)

REPO_HOME = pathlib.Path(__file__).resolve().parents[1]
EVALS_DIR = REPO_HOME / "property_agent" / "evals"


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


async def _run_eval(
    *,
    agent_module: str,
    evalset_file: str,
    recording_hint: str,
    eval_config: EvalConfig,
) -> None:
    path = _require_evalset(evalset_file, recording_hint)
    eval_set = AgentEvaluator._load_eval_set_from_file(
        str(path),
        eval_config,
        initial_session={},
    )
    await AgentEvaluator.evaluate_eval_set(
        agent_module=agent_module,
        eval_set=eval_set,
        eval_config=eval_config,
        num_runs=1,
        print_detailed_results=True,
    )


@pytest.mark.asyncio
async def test_eval_doculink_routing():
    """Root → doculink routing for a general property query."""
    await _run_eval(
        agent_module="property_agent",
        evalset_file="doculink_routing.evalset.json",
        eval_config=config_routing(),
        recording_hint=(
            "1. uv run adk web → select property_agent\n"
            "2. Send a property-related question (no checkpoint_ids / primary_agent)\n"
            "3. Eval tab → create eval set → save as doculink_routing.evalset.json\n"
            "4. Expect trajectory: transfer_to_agent(agent_name=doculink_agent)"
        ),
    )


@pytest.mark.asyncio
async def test_eval_conversational_bypass():
    """Single-turn casual phrases with optional-agent flags present (no analysis run)."""
    await _run_eval(
        agent_module="property_agent",
        evalset_file="conversational_bypass.evalset.json",
        eval_config=config_conversational(),
        recording_hint=(
            "1. uv run adk web → property_agent\n"
            "2. Record cases: hello, thanks, looks good with primary_agent=checkpoint "
            "and checkpoint_optional_agents in payload\n"
            "3. Save as conversational_bypass.evalset.json\n"
            "4. Expect: plain text, no checkpoint_progress_agent"
        ),
    )


@pytest.mark.asyncio
async def test_eval_multi_turn_conversational():
    """Turn 1 substantive analysis; turn 2 casual acknowledgment (same flags)."""
    await _run_eval(
        agent_module="property_agent",
        evalset_file="multi_turn_conversational.evalset.json",
        eval_config=config_conversational(),
        recording_hint=(
            "1. uv run adk web → property_agent\n"
            "2. Turn 1: recommend providers + checkpoint_optional_agents [service]\n"
            "3. Turn 2: looks good / thanks / got it (same flags)\n"
            "4. Save as multi_turn_conversational.evalset.json"
        ),
    )


@pytest.mark.asyncio
async def test_eval_doculink_docs():
    """DocuLink user-document retrieval (primary_agent=docs or context_doc_uris)."""
    await _run_eval(
        agent_module="property_agent",
        evalset_file="doculink_docs.evalset.json",
        eval_config=config_default(),
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
        eval_config=config_checkpoint(),
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
    """E2E: checkpoint flow with checkpoint_optional_agents including cost."""
    await _run_eval(
        agent_module="property_agent",
        evalset_file="cost_agent.evalset.json",
        eval_config=config_checkpoint_branch("cost"),
        recording_hint=(
            "1. uv run adk web → property_agent\n"
            "2. checkpoint_ids + checkpoint_optional_agents: [\"cost\"]; ask for cost details\n"
            "3. Save as cost_agent.evalset.json (full root session, not isolated cost_agent)"
        ),
    )


@pytest.mark.asyncio
async def test_eval_shopping_agent():
    """E2E: checkpoint flow with DIY branch (products via run_diy_pipeline)."""
    await _run_eval(
        agent_module="property_agent",
        evalset_file="shopping_agent.evalset.json",
        eval_config=config_checkpoint_branch("diy"),
        recording_hint=(
            "1. uv run adk web → property_agent\n"
            "2. checkpoint_optional_agents: [\"diy\"]; query like find products to fix it\n"
            "3. Save as shopping_agent.evalset.json"
        ),
    )


@pytest.mark.asyncio
async def test_eval_service_agent():
    """E2E: checkpoint flow with service branch (local providers)."""
    await _run_eval(
        agent_module="property_agent",
        evalset_file="service_agent.evalset.json",
        eval_config=config_checkpoint_branch("service"),
        recording_hint=(
            "1. uv run adk web → property_agent\n"
            "2. checkpoint_optional_agents: [\"service\"]; ask for local service providers\n"
            "3. Save as service_agent.evalset.json"
        ),
    )
