"""Build ADK EvalConfig dicts with rubric-based criteria for property_agent evals."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from google.adk.evaluation.eval_config import EvalConfig

EVALS_DIR = Path(__file__).resolve().parents[1] / "property_agent" / "evals"
RUBRICS_DIR = EVALS_DIR / "rubrics"

# Forward-compatible with ADK PR #5316 (evaluate_full_response on rubric criteria).
_EVALUATE_FULL_RESPONSE = True

_JUDGE_MODEL_OPTIONS: dict[str, Any] = {
    "judge_model": "gemini-2.5-flash",
    "num_samples": 3,
}

_TOOL_TRAJECTORY_IN_ORDER: dict[str, Any] = {
    "threshold": 0.8,
    "match_type": "IN_ORDER",
}


def _load_rubrics(name: str) -> list[dict[str, Any]]:
    path = RUBRICS_DIR / f"{name}.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    rubrics = data.get("rubrics")
    if not isinstance(rubrics, list) or not rubrics:
        raise ValueError(f"Expected non-empty rubrics list in {path}")
    return rubrics


def _rubric_final_response_criterion(
    rubric_names: list[str],
    *,
    threshold: float = 0.75,
) -> dict[str, Any]:
    rubrics: list[dict[str, Any]] = []
    for name in rubric_names:
        rubrics.extend(_load_rubrics(name))
    return {
        "threshold": threshold,
        "evaluate_full_response": _EVALUATE_FULL_RESPONSE,
        "judge_model_options": _JUDGE_MODEL_OPTIONS,
        "rubrics": rubrics,
    }


def _rubric_tool_use_criterion(
    rubric_names: list[str],
    *,
    threshold: float = 1.0,
) -> dict[str, Any]:
    rubrics: list[dict[str, Any]] = []
    for name in rubric_names:
        rubrics.extend(_load_rubrics(name))
    return {
        "threshold": threshold,
        "judge_model_options": _JUDGE_MODEL_OPTIONS,
        "rubrics": rubrics,
    }


def config_default() -> EvalConfig:
    """Trajectory + ROUGE for short doc/routing sessions (adk eval CLI default)."""
    return EvalConfig.model_validate(
        {
            "criteria": {
                "tool_trajectory_avg_score": _TOOL_TRAJECTORY_IN_ORDER,
                "response_match_score": 0.6,
            }
        }
    )


def config_routing() -> EvalConfig:
    """Root → doculink transfer plus expected tool trajectory."""
    return EvalConfig.model_validate(
        {
            "criteria": {
                "tool_trajectory_avg_score": _TOOL_TRAJECTORY_IN_ORDER,
                "rubric_based_tool_use_quality_v1": _rubric_tool_use_criterion(
                    ["routing_tool_use"]
                ),
            }
        }
    )


def config_checkpoint() -> EvalConfig:
    """Full optional-agent checkpoint analysis (dual-format + trajectory)."""
    return EvalConfig.model_validate(
        {
            "criteria": {
                "tool_trajectory_avg_score": _TOOL_TRAJECTORY_IN_ORDER,
                "rubric_based_final_response_quality_v1": _rubric_final_response_criterion(
                    ["checkpoint_response"]
                ),
                "final_response_match_v2": {
                    "threshold": 0.7,
                    "judge_model_options": _JUDGE_MODEL_OPTIONS,
                },
            }
        }
    )


def config_simulation() -> EvalConfig:
    """User-simulator scenarios (multi-turn; no golden final_response)."""
    return EvalConfig.model_validate(
        {
            "criteria": {
                "multi_turn_task_success_v1": {
                    "threshold": 0.7,
                    "judge_model_options": _JUDGE_MODEL_OPTIONS,
                },
                "rubric_based_tool_use_quality_v1": _rubric_tool_use_criterion(
                    ["routing_tool_use"],
                    threshold=1.0,
                ),
                "safety_v1": {
                    "threshold": 0.8,
                    "judge_model_options": _JUDGE_MODEL_OPTIONS,
                },
                "hallucinations_v1": {
                    "threshold": 0.5,
                    "evaluate_intermediate_nl_responses": True,
                    "judge_model_options": _JUDGE_MODEL_OPTIONS,
                },
            },
            "user_simulator_config": {
                "model": "gemini-2.5-flash",
                "max_allowed_invocations": 6,
            },
        }
    )


def config_checkpoint_branch(branch: str) -> EvalConfig:
    """Checkpoint E2E with branch-specific response rubrics (cost, diy, service)."""
    branch_file = f"branch_{branch}"
    return EvalConfig.model_validate(
        {
            "criteria": {
                "tool_trajectory_avg_score": _TOOL_TRAJECTORY_IN_ORDER,
                "rubric_based_final_response_quality_v1": _rubric_final_response_criterion(
                    ["checkpoint_response", branch_file]
                ),
                "final_response_match_v2": {
                    "threshold": 0.65,
                    "judge_model_options": _JUDGE_MODEL_OPTIONS,
                },
            }
        }
    )
