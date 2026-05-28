"""Tests for checkpoint branch search intents."""

import json
from types import SimpleNamespace
from unittest.mock import MagicMock

from property_agent.checkpoint.branch_search_intents import (
    BranchSearchIntents,
    compact_youtube_search_query,
)
from property_agent.checkpoint.retrieval import media_search_query_refiner as msqr


def test_branch_intents_from_dict_full():
    raw = {
        "issue_stem": "residential garage door paint chips",
        "youtube_query": "how to paint residential garage door tutorial",
        "shopping_materials": [
            "exterior metal primer",
            "exterior acrylic paint",
            "fine grit sandpaper",
        ],
        "service_trade_query": "garage door paint refinishing contractor",
    }
    intents = BranchSearchIntents.from_dict(raw)
    assert intents is not None
    assert "garage door" in intents.issue_stem
    assert intents.shopping_materials[0] == "exterior metal primer"
    assert "contractor" in intents.service_trade_query


def test_branch_intents_legacy_refined_query():
    intents = BranchSearchIntents.from_dict({"refined_query": "garage door paint repair"})
    assert intents is not None
    assert intents.issue_stem == "garage door paint repair"
    assert intents.shopping_materials


def test_branch_intents_from_dict_compacts_long_youtube_query():
    raw = {
        "issue_stem": "residential garage door paint chips",
        "youtube_query": "how to repair paint chips and scratches on garage door",
        "shopping_materials": ["exterior metal primer"],
        "service_trade_query": "garage door paint refinishing contractor",
    }
    intents = BranchSearchIntents.from_dict(raw)
    assert intents is not None
    assert intents.youtube_query == "garage door paint repair"


def test_compact_youtube_search_query_examples():
    assert (
        compact_youtube_search_query(
            "how to repair paint chips and scratches on garage door"
        )
        == "garage door paint repair"
    )
    assert compact_youtube_search_query("garage door paint repair") == "garage door paint repair"
    assert compact_youtube_search_query("Residential garage door paint chipping") == (
        "garage door paint repair"
    )
    assert compact_youtube_search_query("car paint scratch chip repair") == (
        "car paint repair"
    )


def test_branch_intents_fallback():
    fb = BranchSearchIntents.fallback_from_raw_query("Garage door paint chips")
    assert fb.youtube_query == "garage door paint repair"
    assert fb.shopping_materials
    assert fb.service_trade_query


def _fake_formatted():
    return [
        {
            "location": "Garage",
            "summary": "Gray garage door with paint damage near handle.",
            "detectedItems": ["door"],
            "issues": [{"description": "Paint chipping near handle."}],
        }
    ]


def test_refiner_branch_intents_full_schema(monkeypatch):
    monkeypatch.setenv("HOMEAPP_REFINE_MEDIA_SEARCH_QUERY", "1")
    payload = {
        "issue_stem": "residential garage door paint chips",
        "youtube_query": "garage door paint repair",
        "shopping_materials": ["exterior metal primer", "exterior paint"],
        "service_trade_query": "garage door refinishing contractor",
    }

    class _Resp:
        text = json.dumps(payload)
        parsed = None
        candidates = None
        prompt_feedback = None

    mock_client = MagicMock()
    mock_client.models.generate_content.return_value = _Resp()
    monkeypatch.setattr(msqr, "_vertex_genai_client", lambda: mock_client)

    intents = msqr.refine_checkpoint_branch_search_intents(
        "Garage paint chips", _fake_formatted()
    )
    assert "garage door" in intents.issue_stem.lower()
    assert intents.youtube_query == "garage door paint repair"
    assert len(intents.shopping_materials) >= 2
    assert "contractor" in intents.service_trade_query.lower()
    assert msqr.refine_checkpoint_media_search_query(
        "Garage paint chips", _fake_formatted()
    ) == intents.issue_stem
