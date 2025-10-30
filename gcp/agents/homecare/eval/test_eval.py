

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
        agent_module="property_agent",
        eval_dataset_file_path_or_dir=str(
            pathlib.Path(__file__).parent / "data/conversation.test.json"
        ),
        num_runs=1,
    )


@pytest.mark.asyncio
async def test_eval_analysis_agent():
    """Test the analysis agent's comprehensive analysis capabilities."""
    await AgentEvaluator.evaluate(
        agent_module="property_agent.sub_agents.analysis_agent",
        eval_dataset_file_path_or_dir=str(
            pathlib.Path(__file__).parent / "data/conversation.test.json"
        ),
        num_runs=1,
    )


@pytest.mark.asyncio
async def test_eval_cost_estimation():
    """Test the cost estimation agent's ability to provide accurate cost estimates."""
    await AgentEvaluator.evaluate(
        agent_module="property_agent.sub_agents.analysis_agent.cost_estimation_agent",
        eval_dataset_file_path_or_dir=str(
            pathlib.Path(__file__).parent / "data/cost_estimation.test.json"
        ),
        num_runs=1,
    )


@pytest.mark.asyncio
async def test_eval_product_recommendations():
    """Test the product recommendations agent's ability to find relevant products."""
    await AgentEvaluator.evaluate(
        agent_module="property_agent.sub_agents.analysis_agent.product_recommendations_agent",
        eval_dataset_file_path_or_dir=str(
            pathlib.Path(__file__).parent / "data/product_recommendations.test.json"
        ),
        num_runs=1,
    )


@pytest.mark.asyncio
async def test_eval_service_provider():
    """Test the service provider agent's ability to find local services."""
    await AgentEvaluator.evaluate(
        agent_module="property_agent.sub_agents.analysis_agent.service_provider_agent",
        eval_dataset_file_path_or_dir=str(
            pathlib.Path(__file__).parent / "data/conversation.test.json"
        ),
        num_runs=1,
    )
