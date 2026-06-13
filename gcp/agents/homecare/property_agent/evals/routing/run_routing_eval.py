"""
Single-loop routing eval: replay single_loop/cases.yaml and score routing.

Deterministic paths only — chip, pending-offer, casual regex, or
``minimal_substantive_resolved_turn``. No Vertex LLM.

Schema validation: ``tests/test_routing_eval_cases.py``.

Usage:
    uv run python -m property_agent.evals.routing.run_routing_eval
    uv run python -m property_agent.evals.routing.run_routing_eval --filter weblog_session_1
    uv run python -m property_agent.evals.routing.run_routing_eval --out single_loop/baselines/$(date +%F).json
"""

from __future__ import annotations

import sys
from pathlib import Path

from dotenv import load_dotenv

from agent_platform.core.evals.routing_eval import (
    RoutingEvalCaseResult,
    build_fake_dialogue_events,
    build_routing_eval_state,
    load_routing_eval_cases,
    run_routing_eval_cli,
    score_routing_expectation,
    summarize_routing_eval_results,
)
from agent_platform.core.routing.single_loop_harness import resolve_turn_single_loop_eval

_PACKAGE_ROOT = Path(__file__).resolve().parents[3]  # gcp/agents/homecare
DEFAULT_CASES_PATH = Path(__file__).resolve().parent / "single_loop" / "cases.yaml"

SCALAR_EXPECT_FIELDS = (
    "discourse_act",
    "intent",
    "route",
    "user_goal",
    "retrieval_only",
    "focus_branch",
    "capability_key",
    "query_mode",
)
KNOWN_EXPECT_FIELDS = SCALAR_EXPECT_FIELDS + (
    "run_optional_agents",
    "run_optional_agents_any_of",
)

# Backward-compatible aliases for tests and tooling.
load_cases = load_routing_eval_cases
build_state = build_routing_eval_state
def build_events(dialogue):
    return build_fake_dialogue_events(
        dialogue, assistant_author="property_agent"
    )
CaseResult = RoutingEvalCaseResult
summarize = summarize_routing_eval_results


def score_case(resolved, expect):
    return score_routing_expectation(
        resolved,
        expect,
        scalar_fields=SCALAR_EXPECT_FIELDS,
    )


def resolve_turn_single_loop(
    *,
    user_query: str,
    state: dict,
):
    from property_agent.routing.single_loop_hooks import PROPERTY_SINGLE_LOOP_HOOKS

    return resolve_turn_single_loop_eval(
        user_query=user_query,
        state=state,
        hooks=PROPERTY_SINGLE_LOOP_HOOKS,
    )


def main(argv: list[str] | None = None) -> int:
    return run_routing_eval_cli(
        argv,
        default_cases_path=DEFAULT_CASES_PATH,
        package_root=_PACKAGE_ROOT,
        resolver=lambda user_query, state: resolve_turn_single_loop(
            user_query=user_query, state=state
        ),
        scalar_fields=SCALAR_EXPECT_FIELDS,
        known_expect_fields=KNOWN_EXPECT_FIELDS,
        description=__doc__ or "",
        suite_label="single-loop routing",
        load_dotenv=load_dotenv,
    )


if __name__ == "__main__":
    raise SystemExit(main())
