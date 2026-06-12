"""Tests for checkpoint media search query LLM refiner."""

import json
from types import SimpleNamespace
from unittest.mock import MagicMock

from property_agent.checkpoint.retrieval import (
    media_search_query_refiner as msqr,
)


def _fake_formatted():
    return [
        {
            "location": "Garage",
            "summary": "Gray garage door with paint damage near handle.",
            "detectedItems": ["door", "door handle"],
            "issues": [
                {
                    "description": "Significant paint chipping on the door surface near the handle."
                }
            ],
        }
    ]


def test_refiner_disabled_returns_raw(monkeypatch):
    monkeypatch.setenv("HOMEAPP_REFINE_MEDIA_SEARCH_QUERY", "0")
    raw = "Garage paint chips door"
    assert msqr.refine_checkpoint_media_search_query(raw, _fake_formatted()) == raw


def test_refiner_returns_raw_when_generate_raises(monkeypatch):
    monkeypatch.setenv("HOMEAPP_REFINE_MEDIA_SEARCH_QUERY", "1")

    def _boom(*_a, **_k):
        raise RuntimeError("no vertex")

    monkeypatch.setattr(
        msqr,
        "_vertex_genai_client",
        lambda: SimpleNamespace(models=SimpleNamespace(generate_content=_boom)),
    )
    raw = "Garage Significant paint chipping"
    assert msqr.refine_checkpoint_media_search_query(raw, _fake_formatted()) == raw


def test_refiner_uses_model_json(monkeypatch):
    monkeypatch.setenv("HOMEAPP_REFINE_MEDIA_SEARCH_QUERY", "1")
    raw = "Garage door paint chips"

    class _Resp:
        text = json.dumps(
            {
                "refined_query": (
                    "Residential garage door paint chipping scratch repair DIY"
                )
            }
        )
        parsed = None
        candidates = None
        prompt_feedback = None

    mock_client = MagicMock()
    mock_client.models.generate_content.return_value = _Resp()
    monkeypatch.setattr(msqr, "_vertex_genai_client", lambda: mock_client)

    out = msqr.refine_checkpoint_media_search_query(raw, _fake_formatted())
    assert "garage door" in out.lower()
    mock_client.models.generate_content.assert_called_once()


def test_refiner_uses_minimal_thinking_level(monkeypatch):
    """gemini-3.5-flash defaults to medium thinking; minimal keeps JSON within token cap."""
    monkeypatch.setenv("HOMEAPP_REFINE_MEDIA_SEARCH_QUERY", "1")

    class _Resp:
        text = json.dumps({"refined_query": "residential garage door paint repair"})
        parsed = None
        candidates = None
        prompt_feedback = None

    mock_client = MagicMock()
    mock_client.models.generate_content.return_value = _Resp()
    monkeypatch.setattr(msqr, "_vertex_genai_client", lambda: mock_client)

    msqr.refine_checkpoint_media_search_query("Garage paint", _fake_formatted())
    _kwargs = mock_client.models.generate_content.call_args.kwargs
    cfg = _kwargs["config"]
    assert cfg.thinking_config is not None
    assert str(cfg.thinking_config.thinking_level).lower().endswith("minimal")


def test_refiner_uses_response_parsed_when_text_empty(monkeypatch):
    """SDK may populate ``parsed``; ``text`` can still be empty."""
    monkeypatch.setenv("HOMEAPP_REFINE_MEDIA_SEARCH_QUERY", "1")

    class _Resp:
        text = ""
        parsed = {"refined_query": "Residential garage door paint repair"}
        candidates = None
        prompt_feedback = None

    mock_client = MagicMock()
    mock_client.models.generate_content.return_value = _Resp()
    monkeypatch.setattr(msqr, "_vertex_genai_client", lambda: mock_client)

    out = msqr.refine_checkpoint_media_search_query("Garage paint", _fake_formatted())
    assert "garage door" in out.lower()


def test_refiner_parses_json_from_thought_tagged_part(monkeypatch):
    """Gemini may put JSON in a part with ``thought=True``, which ``response.text`` omits."""
    monkeypatch.setenv("HOMEAPP_REFINE_MEDIA_SEARCH_QUERY", "1")
    payload = json.dumps({"refined_query": "residential garage door scratch repair"})
    part = SimpleNamespace(text=payload, thought=True)
    content = SimpleNamespace(parts=[part])
    candidate = SimpleNamespace(content=content)

    class _Resp:
        text = ""
        parsed = None
        candidates = [candidate]
        prompt_feedback = None

    mock_client = MagicMock()
    mock_client.models.generate_content.return_value = _Resp()
    monkeypatch.setattr(msqr, "_vertex_genai_client", lambda: mock_client)

    out = msqr.refine_checkpoint_media_search_query("Garage paint", _fake_formatted())
    assert "garage door" in out.lower()


def test_refiner_truncates_long_output(monkeypatch):
    monkeypatch.setenv("HOMEAPP_REFINE_MEDIA_SEARCH_QUERY", "1")
    long_q = "word " * 80

    class _Resp:
        text = json.dumps({"refined_query": long_q})
        parsed = None
        candidates = None
        prompt_feedback = None

    mock_client = MagicMock()
    mock_client.models.generate_content.return_value = _Resp()
    monkeypatch.setattr(msqr, "_vertex_genai_client", lambda: mock_client)

    out = msqr.refine_checkpoint_media_search_query(
        "x", _fake_formatted(), max_out_chars=50
    )
    assert len(out) <= 50


def test_refiner_empty_formatted_skips_call(monkeypatch):
    monkeypatch.setenv("HOMEAPP_REFINE_MEDIA_SEARCH_QUERY", "1")
    mock_client = MagicMock()
    monkeypatch.setattr(msqr, "_vertex_genai_client", lambda: mock_client)
    assert msqr.refine_checkpoint_media_search_query("seed", []) == "seed"
    mock_client.models.generate_content.assert_not_called()


def test_refiner_prompt_is_issue_type_general_not_garage_only():
    prompt = msqr._refiner_prompt(
        "Kitchen leak Bathroom mold",
        '{"checkpoints":[{"location":"Kitchen","issues":["sink leak"]}]}',
    )
    assert "plumbing" in prompt.lower() or "Plumbing" in prompt
    assert "electrical" in prompt.lower() or "HVAC" in prompt
    assert "Multiple checkpoints" in prompt
    assert "Do NOT assume surface materials" in prompt
    assert "ONE most actionable repair focus" in prompt
    assert "vehicles" in prompt.lower()
    assert "auto body" in prompt.lower()
    assert "Do not mix domains" in prompt
    assert "3-6 word keyword phrase" in prompt
    assert "garage door paint repair" in prompt


def test_refiner_compacts_verbose_youtube_query_from_model(monkeypatch):
    monkeypatch.setenv("HOMEAPP_REFINE_MEDIA_SEARCH_QUERY", "1")
    payload = {
        "issue_stem": "residential garage door paint chipping and scratches",
        "youtube_query": "how to repair paint chips and scratches on garage door",
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
    assert intents.youtube_query == "garage door paint repair"


def test_hints_from_formatted_includes_multiple_checkpoints():
    formatted = [
        {
            "location": "Kitchen",
            "summary": "Under-sink leak.",
            "issues": [{"description": "Slow drip at P-trap."}],
        },
        {
            "location": "Garage",
            "summary": "Garage door paint chips.",
            "issues": [{"description": "Paint chipping near handle."}],
        },
    ]
    blob = msqr._hints_from_formatted(formatted)
    data = json.loads(blob)
    assert len(data["checkpoints"]) == 2
    assert data["checkpoints"][0]["location"] == "Kitchen"
    assert data["checkpoints"][1]["location"] == "Garage"
