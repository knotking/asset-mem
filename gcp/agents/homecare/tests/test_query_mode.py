"""Tests for session working memory and retained query-mode helpers."""

from __future__ import annotations

import json

from property_agent.routing.query_mode import (
    SESSION_WORKING_MEMORY_SNAPSHOT_KEY,
    build_session_working_memory,
    extract_known_service_providers,
    snapshot_session_analysis_context,
)
from property_agent.routing.resolve_turn import ResolvedTurn, apply_resolved_turn_to_state
from property_agent.checkpoint.analysis.search_query import (
    resolve_optional_branch_user_query,
    resolve_service_branch_user_query,
)
from property_agent.checkpoint.retrieval.inventory_query import (
    query_requests_checkpoint_inventory,
)


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


def test_resolve_optional_branch_user_query_entity_uses_turn_text() -> None:
    blob = "Checkpoint garage door paint chipping " * 10
    q = resolve_optional_branch_user_query(
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
    q = resolve_optional_branch_user_query(
        turn_query="Analyse my checkpoints",
        search_query=None,
        checkpoint_results=blob,
        query_mode="branch_issue_search",
    )
    assert "may 11" not in q.lower()
    assert "9:10" not in q


def test_resolve_service_branch_user_query_explicit_menu_uses_retrieval_stem() -> None:
    stem = "residential garage door paint chipping scratches repair"
    q = resolve_service_branch_user_query(
        turn_query="analyse my checkpoints for coverage, diy, service, and cost",
        search_query=stem,
        checkpoint_results="blob",
        query_mode="branch_explicit",
    )
    assert q == stem


def test_resolve_service_branch_user_query_garage_provider_turn_uses_turn() -> None:
    turn = (
        "Can you find more service providers for the garage door refinishing "
        "or related property maintenance tasks?"
    )
    stem = "residential garage door paint chipping scratches repair"
    q = resolve_service_branch_user_query(
        turn_query=turn,
        search_query=stem,
        checkpoint_results="blob",
        query_mode="branch_explicit",
    )
    assert q == turn


def test_resolve_service_branch_user_query_entity_uses_turn() -> None:
    turn = "Get more details about Right Way Garage Doors"
    q = resolve_service_branch_user_query(
        turn_query=turn,
        search_query="garage door paint repair",
        checkpoint_results="blob",
        query_mode="branch_entity_search",
    )
    assert "Right Way" in q


def test_build_session_working_memory_includes_providers() -> None:
    state = {"checkpoint_parallel_results": _service_parallel_json("Acme Door Co")}
    memory = build_session_working_memory(state)
    assert "Acme Door Co" in memory.get("service_providers_mentioned", [])


def test_snapshot_survives_answer_from_context_apply() -> None:
    state = {
        "checkpoint_parallel_results": _service_parallel_json("OneHandyPro"),
        "checkpoint_analysis": {
            "analysis": {
                "serviceResults": {
                    "localPros": {
                        "serpAPIResults": [
                            {
                                "name": "OneHandyPro",
                                "notes": "Licensed",
                                "website": "https://onehandypro.com",
                            }
                        ]
                    }
                }
            }
        },
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
    assert isinstance(state.get("checkpoint_analysis"), dict)
    assert isinstance(state.get(SESSION_WORKING_MEMORY_SNAPSHOT_KEY), dict)
    memory = build_session_working_memory(state)
    assert "OneHandyPro" in memory.get("service_providers_mentioned", [])


def test_snapshot_from_parallel_only_service_branch() -> None:
    state = {
        "checkpoint_parallel_results": _service_parallel_json(
            "Ace Handyman Services Brentwood"
        ),
        "checkpoint_last_response_kind": "analysis",
    }
    snapshot_session_analysis_context(state)
    memory = state[SESSION_WORKING_MEMORY_SNAPSHOT_KEY]
    assert "Ace Handyman Services Brentwood" in memory.get(
        "service_providers_mentioned", []
    )
    details = memory.get("service_provider_details") or {}
    assert "Ace Handyman Services Brentwood" in details


def test_snapshot_includes_branch_digests() -> None:
    state = {
        "checkpoint_analysis": {
            "analysis": {
                "title": "Garage repair",
                "checkpointSummary": {
                    "locations": ["Garage"],
                    "checkpointsAnalyzed": 1,
                    "issuesDetected": ["Paint chips"],
                    "overallCondition": "fair",
                },
                "analysisStatus": {
                    "diy": "completed",
                    "service": "completed",
                },
                "diyResults": {
                    "diySteps": {
                        "steps": [
                            {"title": "Clean the surface"},
                            {"title": "Sand and prime"},
                        ]
                    }
                },
                "coverageResult": {
                    "warrantyInfo": "No warranty for cosmetic wear.",
                    "insuranceInfo": "Renters policy excludes wear.",
                },
                "costEstimationResults": {
                    "costEstimates": {
                        "diy": {"min": 125, "max": 290, "currency": "USD"},
                    }
                },
            }
        }
    }
    snapshot_session_analysis_context(state)
    memory = state[SESSION_WORKING_MEMORY_SNAPSHOT_KEY]
    assert "diy" in memory.get("branches_completed", [])
    assert memory.get("diy_steps_summary") == ["Clean the surface", "Sand and prime"]
    assert "No warranty" in (memory.get("coverage_summary") or {}).get(
        "warrantyInfo", ""
    )
    assert (memory.get("cost_summary") or {}).get("diy", {}).get("max") == 290


def test_snapshot_survives_prune_simulation() -> None:
    from property_agent.runtime.session_diet import prune_heavy_checkpoint_state

    state = {
        "checkpoint_parallel_results": _service_parallel_json("Up Right Garage Door Repair"),
        "checkpoint_analysis": {"analysis": {"title": "Checkpoint analysis"}},
        "checkpoint_last_response_kind": "analysis",
    }
    snapshot_session_analysis_context(state)
    prune_heavy_checkpoint_state(state)
    assert state.get("checkpoint_parallel_results") is None
    assert state.get("checkpoint_analysis") is None
    memory = build_session_working_memory(state)
    assert "Up Right Garage Door Repair" in memory.get("service_providers_mentioned", [])


def test_query_requests_checkpoint_inventory() -> None:
    q = "What checkpoints do I have and what is their current status?"
    assert query_requests_checkpoint_inventory(q)


def test_query_requests_checkpoint_inventory_status_phrases() -> None:
    assert query_requests_checkpoint_inventory("What is my checkpoint status?")
    assert query_requests_checkpoint_inventory("status of my checkpoints")
    assert query_requests_checkpoint_inventory("list my checkpoints")


def test_query_does_not_treat_area_status_as_checkpoint_inventory() -> None:
    assert not query_requests_checkpoint_inventory(
        "What is the current status of the garage door?"
    )
    assert not query_requests_checkpoint_inventory("What is their current status?")


def test_provider_entry_normalizes_ratings_and_reviews_from_serp_shape() -> None:
    from property_agent.routing.query_mode.session_memory import _provider_entry_from_item

    entry = _provider_entry_from_item(
        {
            "name": "Up Right Garage Door Repair Brentwood",
            "phone": "(925) 293-8232",
            "ratings": "4.9",
            "reviews": 94,
            "address": "8375 Brentwood Blvd, Brentwood, CA 94513",
        }
    )
    assert entry["rating"] == "4.9"
    assert entry["reviews"] == 94
    assert "8375 Brentwood Blvd" in entry["location"]
