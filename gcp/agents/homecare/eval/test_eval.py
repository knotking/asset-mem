

import pathlib

import dotenv
import pytest
from google.adk.evaluation.agent_evaluator import AgentEvaluator

pytest_plugins = ("pytest_asyncio",)


@pytest.fixture(scope="session", autouse=True)
def load_env():
    dotenv.load_dotenv()


@pytest.mark.asyncio
async def test_eval_full_conversation():
    """Test the homecare agent's multimodal diagnostic capabilities."""
    await AgentEvaluator.evaluate(
        agent_module="rag",
        eval_dataset_file_path_or_dir=str(
            pathlib.Path(__file__).parent / "data/conversation.test.json"
        ),
        num_runs=1,
    )


@pytest.mark.asyncio
async def test_eval_diagnostic_agent():
    """Test the diagnostic agent's comprehensive analysis capabilities."""
    await AgentEvaluator.evaluate(
        agent_module="rag.sub_agents.diagnostics_agent",
        eval_dataset_file_path_or_dir=str(
            pathlib.Path(__file__).parent / "data/conversation.test.json"
        ),
        num_runs=1,
    )


@pytest.mark.asyncio
async def test_eval_cost_estimation():
    """Test the cost estimation agent's ability to provide accurate cost estimates."""
    await AgentEvaluator.evaluate(
        agent_module="rag.sub_agents.diagnostics_agent.cost_estimation_agent",
        eval_dataset_file_path_or_dir=str(
            pathlib.Path(__file__).parent / "data/conversation.test.json"
        ),
        num_runs=1,
    )
