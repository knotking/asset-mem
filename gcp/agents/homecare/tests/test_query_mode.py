"""Tests for ChatGPT-style query modes and session working memory."""

from __future__ import annotations

import json

from property_agent.query_mode import (
    SESSION_WORKING_MEMORY_SNAPSHOT_KEY,
    branches_mentioned_in_query,
    build_session_working_memory,
    extract_known_service_providers,
    format_provider_context_answer,
    infer_query_mode,
    needs_fresh_checkpoint_retrieval,
    query_references_known_provider,
    should_answer_provider_from_context,
    should_block_checkpoint_agent_for_context_turn,
    snapshot_session_analysis_context,
)
from property_agent.resolve_turn import ResolvedTurn, apply_resolved_turn_to_state
from property_agent.resolve_turn_llm import _apply_checkpoint_retrieval_plan
from property_agent.sub_agents.checkpoint_analysis_agent import agent as caa


def _service_parallel_json(*names: str) -> str:
    serp = [{"name": n, "contact_info": "555"} for n in names]
    inner = json.dumps(
        {
            "serviceResults": {
                "localPros": {"serpAPIResults": serp},
            }
        }
    )
    return json.dumps({"checkpoint_parallel_service_result": inner})


def test_extract_known_service_providers_from_parallel_results() -> None:
    state = {"checkpoint_parallel_results": _service_parallel_json("Right Way Garage Doors")}
    names = extract_known_service_providers(state)
    assert "Right Way Garage Doors" in names


def test_should_answer_provider_from_context() -> None:
    state = {"checkpoint_parallel_results": _service_parallel_json("Right Way Garage Doors")}
    assert should_answer_provider_from_context(
        "Get more details about Right Way Garage Doors",
        state=state,
    )


def test_query_references_known_provider_partial_name() -> None:
    state = {
        "checkpoint_parallel_results": _service_parallel_json(
            "Bay Area Garage Door Repair Brentwood"
        ),
    }
    match = query_references_known_provider(
        "get me more details on Bay Area Garage Door Repair",
        state,
    )
    assert match == "Bay Area Garage Door Repair Brentwood"


def test_apply_checkpoint_retrieval_plan_ignores_menu_index_for_provider() -> None:
    state = {
        "checkpoint_parallel_results": _service_parallel_json(
            "Bay Area Garage Door Repair Brentwood"
        ),
    }
    payload = {
        "intent": "substantive",
        "route": "checkpoint",
        "expanded_user_query": (
            "get me more details on Bay Area Garage Door Repair "
            "for the property at 1982 Helena Way"
        ),
        "retrieval_only": False,
        "run_optional_agents": ["service"],
        "menu_index": 4,
        "capability_key": "service",
    }
    out = _apply_checkpoint_retrieval_plan(
        payload,
        user_query="get me more details on Bay Area Garage Door Repair",
        state=state,
    )
    assert out["user_goal"] == "answer_from_context"
    assert out["retrieval_only"] is True
    assert out["run_optional_agents"] == []


def test_apply_checkpoint_retrieval_plan_coerces_known_provider_follow_up() -> None:
    state = {
        "checkpoint_parallel_results": _service_parallel_json("Right Way Garage Doors"),
    }
    payload = {
        "intent": "substantive",
        "route": "checkpoint",
        "expanded_user_query": "Tell me more about Right Way Garage Doors",
        "retrieval_only": False,
        "run_optional_agents": ["service"],
    }
    out = _apply_checkpoint_retrieval_plan(
        payload,
        user_query="tell me more about right way garage doors",
        state=state,
    )
    assert out["user_goal"] == "answer_from_context"
    assert out["retrieval_only"] is True
    assert out["run_optional_agents"] == []


def test_infer_query_mode_entity_search() -> None:
    assert (
        infer_query_mode(
            user_goal="new_analysis",
            expanded_user_query="More details on Precision Garage Door",
            run_optional_agents=["service"],
        )
        == "branch_entity_search"
    )


def test_resolve_optional_branch_user_query_entity_uses_turn_text() -> None:
    blob = "Checkpoint garage door paint chipping " * 10
    q = caa.resolve_optional_branch_user_query(
        turn_query="Get more details about Right Way Garage Doors",
        search_query=None,
        checkpoint_results=blob,
        query_mode="branch_entity_search",
    )
    assert "Right Way" in q
    assert len(q) < len(blob)


def test_resolve_optional_branch_user_query_issue_uses_compact_stem() -> None:
    blob = (
        "Checkpoint 'Checkpoint • May 11 • 9:10 PM' (Garage): paint chipping near handle."
    )
    q = caa.resolve_optional_branch_user_query(
        turn_query="Analyse my checkpoints",
        search_query=None,
        checkpoint_results=blob,
        query_mode="branch_issue_search",
    )
    assert "may 11" not in q.lower()
    assert "9:10" not in q


def test_build_session_working_memory_includes_providers() -> None:
    state = {"checkpoint_parallel_results": _service_parallel_json("Acme Door Co")}
    memory = build_session_working_memory(state)
    assert "Acme Door Co" in memory.get("service_providers_mentioned", [])


def test_query_references_known_provider() -> None:
    state = {"checkpoint_parallel_results": _service_parallel_json("Magic Garage Repair")}
    match = query_references_known_provider(
        "What do you know about Magic Garage Repair?",
        state,
    )
    assert match == "Magic Garage Repair"


def test_branches_mentioned_in_query_includes_service() -> None:
    branches = branches_mentioned_in_query(
        "analyse my checkpoints for coverage, diy, service, and cost"
    )
    assert branches == ["coverage", "diy", "service", "cost"]


def test_snapshot_survives_answer_from_context_apply() -> None:
    state = {
        "checkpoint_parallel_results": _service_parallel_json("OneHandyPro"),
        "checkpoint_analysis_dual_format": (
            "# Analysis\n\n```json\n"
            '{"analysis":{"serviceResults":{"localPros":{"serpAPIResults":'
            '[{"name":"OneHandyPro","notes":"Licensed","website":"https://onehandypro.com"}]}}}}'
            "\n```"
        ),
        "checkpoint_optional_agents": ["service"],
    }
    snapshot_session_analysis_context(state)
    resolved = ResolvedTurn(
        intent="substantive",
        route="checkpoint",
        expanded_user_query="Tell me more about OneHandyPro",
        retrieval_only=True,
        user_goal="answer_from_context",
        query_mode="interpret_session",
    )
    apply_resolved_turn_to_state(state, resolved)
    assert state.get("checkpoint_analysis_dual_format")
    assert isinstance(state.get(SESSION_WORKING_MEMORY_SNAPSHOT_KEY), dict)
    memory = build_session_working_memory(state)
    assert "OneHandyPro" in memory.get("service_providers_mentioned", [])


def test_should_block_provider_follow_up_not_kitchen() -> None:
    state = {"checkpoint_parallel_results": _service_parallel_json("OneHandyPro")}
    snapshot_session_analysis_context(state)
    assert should_block_checkpoint_agent_for_context_turn(
        user_query="Get more details on OneHandyPro",
        state=state,
        user_goal="answer_from_context",
        query_mode="interpret_session",
    )
    assert not should_block_checkpoint_agent_for_context_turn(
        user_query="Are there issues in the kitchen?",
        state=state,
        user_goal="answer_from_context",
        query_mode="interpret_session",
    )
    assert needs_fresh_checkpoint_retrieval("Are there issues in the kitchen?")


def test_format_provider_context_answer() -> None:
    inner = json.dumps(
        {
            "serviceResults": {
                "localPros": {
                    "serpAPIResults": [
                        {
                            "name": "OneHandyPro",
                            "notes": "CSLB licensed",
                            "website": "https://onehandypro.com",
                            "services": ["Garage door repair"],
                        }
                    ]
                }
            }
        }
    )
    state = {
        "checkpoint_parallel_results": json.dumps(
            {"checkpoint_parallel_service_result": inner}
        )
    }
    text = format_provider_context_answer("More about OneHandyPro", state)
    assert text is not None
    assert "OneHandyPro" in text
    assert "CSLB licensed" in text
