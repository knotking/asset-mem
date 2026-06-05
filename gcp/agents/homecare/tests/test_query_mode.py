"""Tests for ChatGPT-style query modes and session working memory."""

from __future__ import annotations

import json

from property_agent.routing.query_mode import (
    SESSION_WORKING_MEMORY_SNAPSHOT_KEY,
    branches_mentioned_in_query,
    build_session_working_memory,
    extract_known_service_providers,
    format_provider_context_answer,
    format_session_working_memory_block,
    infer_query_mode,
    needs_fresh_checkpoint_retrieval,
    query_asks_area_outside_memory,
    query_references_known_provider,
    should_answer_provider_from_context,
    should_block_checkpoint_pipeline_for_context_turn,
    snapshot_session_analysis_context,
)
from property_agent.routing.resolve_turn import ResolvedTurn, apply_resolved_turn_to_state
from property_agent.routing.apply_resolved_turn import (
    apply_checkpoint_retrieval_plan as _apply_checkpoint_retrieval_plan,
)
from property_agent.checkpoint.analysis.search_query import (
    resolve_optional_branch_user_query,
    resolve_service_branch_user_query,
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


def test_should_block_provider_follow_up_not_kitchen() -> None:
    state = {"checkpoint_parallel_results": _service_parallel_json("OneHandyPro")}
    snapshot_session_analysis_context(state)
    assert should_block_checkpoint_pipeline_for_context_turn(
        user_query="Get more details on OneHandyPro",
        state=state,
        user_goal="answer_from_context",
        query_mode="interpret_session",
    )
    assert not needs_fresh_checkpoint_retrieval(
        "Get more details on OneHandyPro",
        state=state,
    )


def test_kitchen_outside_memory_uses_context_not_fresh_retrieval() -> None:
    state = {
        "checkpoint_parallel_results": _service_parallel_json("OneHandyPro"),
        SESSION_WORKING_MEMORY_SNAPSHOT_KEY: {
            "checkpoint_summary": {
                "locations": ["Garage"],
                "checkpointsAnalyzed": 2,
            },
        },
    }
    assert query_asks_area_outside_memory(
        "Are there issues in the kitchen?",
        state,
    )
    assert not needs_fresh_checkpoint_retrieval(
        "Are there issues in the kitchen?",
        state=state,
    )
    assert should_block_checkpoint_pipeline_for_context_turn(
        user_query="Are there issues in the kitchen?",
        state=state,
        user_goal="answer_from_context",
        query_mode="interpret_session",
    )


def test_query_references_ace_handyman_not_handyman_reed() -> None:
    state = {
        SESSION_WORKING_MEMORY_SNAPSHOT_KEY: {
            "service_providers_mentioned": [
                "Ace Handyman Services Brentwood",
                "Handyman Reed",
            ],
            "service_provider_details": {
                "Ace Handyman Services Brentwood": {
                    "name": "Ace Handyman Services Brentwood",
                    "website": "https://acehandymanservices.com",
                },
                "Handyman Reed": {
                    "name": "Handyman Reed",
                    "website": "https://handymanreed.com",
                },
            },
        },
    }
    match = query_references_known_provider(
        "Get more details on Ace Handyman services for the garage door repairs",
        state,
    )
    assert match == "Ace Handyman Services Brentwood"


def test_format_provider_context_answer_includes_numeric_rating() -> None:
    state = {
        SESSION_WORKING_MEMORY_SNAPSHOT_KEY: {
            "service_providers_mentioned": ["Brentwood Pro Painters"],
            "service_provider_details": {
                "Brentwood Pro Painters": {
                    "name": "Brentwood Pro Painters",
                    "rating": 4.8,
                },
            },
        },
    }
    text = format_provider_context_answer(
        "get me more details on Brentwood Pro painters",
        state,
    )
    assert text is not None
    assert "4.8" in text
    assert "**Rating:**" in text


def test_format_provider_context_answer_synthesis_service_field() -> None:
    """Synthesis often uses ``service`` (singular) on serpAPIResults items."""
    inner = json.dumps(
        {
            "analysis": {
                "serviceResults": {
                    "localPros": {
                        "serpAPIResults": [
                            {
                                "name": "Precision Door Service",
                                "service": "Full Inspection & Maintenance",
                            },
                            {
                                "name": "Brentwood Garage Door Pros",
                                "service": "Garage door repair",
                            },
                        ]
                    }
                }
            }
        }
    )
    state = {"checkpoint_analysis": json.loads(inner)}
    match = query_references_known_provider(
        "get more details on Precision Door Service",
        state,
    )
    assert match == "Precision Door Service"
    text = format_provider_context_answer(
        "get more details on Precision Door Service",
        state,
    )
    assert text is not None
    assert "Precision Door Service" in text
    assert "Full Inspection" in text


def test_format_provider_context_answer_name_only_not_none() -> None:
    state = {
        SESSION_WORKING_MEMORY_SNAPSHOT_KEY: {
            "service_providers_mentioned": ["Precision Door Service"],
            "service_provider_details": {
                "Precision Door Service": {"name": "Precision Door Service"},
            },
        },
    }
    text = format_provider_context_answer(
        "get more details on Precision Door Service",
        state,
    )
    assert text is not None
    assert "Precision Door Service" in text
    assert "previous **Service results**" in text
    assert "limited details saved" in text
    assert "fresh provider search" in text
    assert "bathroom" not in text.lower()


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
    assert "previous **Service results**" in text
    assert "OneHandyPro" in text
    assert "CSLB licensed" in text


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


def test_should_block_entity_detail_with_memory_without_provider_match() -> None:
    state = {
        SESSION_WORKING_MEMORY_SNAPSHOT_KEY: {
            "checkpoint_summary": {"locations": ["Garage"], "checkpointsAnalyzed": 1},
            "service_providers_mentioned": ["Ace Handyman Services Brentwood"],
        }
    }
    assert should_block_checkpoint_pipeline_for_context_turn(
        user_query="get me more details on Ace Handyman",
        state=state,
        user_goal="answer_from_context",
        query_mode="interpret_session",
        tool_name="user_docs_retrieval",
    )


def test_should_not_block_user_docs_on_user_docs_route() -> None:
    state = {
        SESSION_WORKING_MEMORY_SNAPSHOT_KEY: {
            "checkpoint_summary": {"locations": ["Garage"], "checkpointsAnalyzed": 1},
        }
    }
    assert not should_block_checkpoint_pipeline_for_context_turn(
        user_query="What does section 4.5 of the lease say?",
        state=state,
        user_goal="answer_from_context",
        query_mode="interpret_session",
        resolved_route="user_docs",
        tool_name="user_docs_retrieval",
    )


def test_format_session_memory_includes_provider_lines() -> None:
    state = {
        SESSION_WORKING_MEMORY_SNAPSHOT_KEY: {
            "service_provider_details": {
                "Up Right Garage Door Repair Brentwood": {
                    "name": "Up Right Garage Door Repair Brentwood",
                    "phone": "(925) 293-8232",
                    "ratings": "4.9",
                    "reviews": "94",
                    "location": "8375 Brentwood Blvd, Brentwood, CA 94513",
                }
            }
        }
    }
    block = format_session_working_memory_block(state)
    assert "Service providers (from prior analysis)" in block
    assert "925" in block
    assert "rating: 4.9" in block
    assert "reviews: 94" in block
    assert "SESSION_WORKING_MEMORY" in block


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
