"""Tests for shared Google Search grounding configuration."""

from __future__ import annotations

import pytest
from google.genai import types

from property_agent.shared import google_search_grounding as gsg


def test_google_search_grounding_tool_uses_google_search_on_vertex_by_default(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("GOOGLE_GENAI_USE_VERTEXAI", "1")
    tool = gsg.google_search_grounding_tool()
    assert tool.google_search is not None
    assert tool.google_search_retrieval is None


def test_google_search_grounding_tool_uses_dynamic_retrieval_on_ai_studio(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("GOOGLE_GENAI_USE_VERTEXAI", "0")
    monkeypatch.delenv("GOOGLE_SEARCH_DYNAMIC_RETRIEVAL", raising=False)
    tool = gsg.google_search_grounding_tool()
    assert tool.google_search_retrieval is not None
    cfg = tool.google_search_retrieval.dynamic_retrieval_config
    assert cfg is not None
    assert cfg.mode == types.DynamicRetrievalConfigMode.MODE_DYNAMIC
    assert cfg.dynamic_threshold == pytest.approx(0.45)


def test_google_search_grounding_tool_plain_when_dynamic_disabled(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("GOOGLE_GENAI_USE_VERTEXAI", "0")
    monkeypatch.setenv("GOOGLE_SEARCH_DYNAMIC_RETRIEVAL", "0")
    tool = gsg.google_search_grounding_tool()
    assert tool.google_search is not None
    assert tool.google_search_retrieval is None


def test_dynamic_threshold_from_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("GOOGLE_SEARCH_DYNAMIC_THRESHOLD", "0.7")
    assert gsg.dynamic_retrieval_threshold() == pytest.approx(0.7)


def test_text_from_generate_content_response_uses_response_text() -> None:
    class _Resp:
        text = "  hello world  "

    assert gsg.text_from_generate_content_response(_Resp()) == "hello world"


def test_text_from_generate_content_response_falls_back_to_parts() -> None:
    class _Part:
        def __init__(self, text: str):
            self.text = text

    class _Content:
        parts = [_Part("DIY $50-100. "), _Part("Pro $800-1200.")]

    class _Candidate:
        content = _Content()

    class _Resp:
        text = None
        candidates = [_Candidate()]

    assert (
        gsg.text_from_generate_content_response(_Resp())
        == "DIY $50-100. Pro $800-1200."
    )


def test_text_from_generate_content_response_empty() -> None:
    class _Resp:
        text = None
        candidates = []

    assert gsg.text_from_generate_content_response(_Resp()) == ""
    assert gsg.text_from_generate_content_response(None) == ""


def test_grounded_prose_with_retry_returns_first_non_empty() -> None:
    class _Ok:
        text = "grounded summary"

    calls: list[int] = []

    def _generate():
        calls.append(1)
        return _Ok()

    import logging

    out = gsg.grounded_prose_with_retry(
        _generate,
        logger=logging.getLogger("test"),
        label="test",
        max_attempts=2,
    )
    assert out == "grounded summary"
    assert calls == [1]


def test_grounded_prose_with_retry_retries_empty_response() -> None:
    class _Empty:
        text = None
        candidates = []

    class _Ok:
        text = "retry ok"

    calls: list[int] = []

    def _generate():
        calls.append(1)
        return _Empty() if len(calls) == 1 else _Ok()

    import logging

    out = gsg.grounded_prose_with_retry(
        _generate,
        logger=logging.getLogger("test"),
        label="test",
        max_attempts=2,
    )
    assert out == "retry ok"
    assert calls == [1, 1]


def test_log_grounded_response_usage(caplog: pytest.LogCaptureFixture) -> None:
    import logging

    class _Usage:
        prompt_token_count = 84
        candidates_token_count = 712
        thoughts_token_count = 698
        total_token_count = 1494

    class _Candidate:
        finish_reason = "STOP"

    class _Resp:
        candidates = [_Candidate()]
        usage_metadata = _Usage()

    caplog.set_level(logging.INFO)
    logger = logging.getLogger("test.grounded.usage")
    gsg.log_grounded_response_usage(
        logger,
        _Resp(),
        label="DIY web grounding",
        attempt=1,
        max_attempts=2,
        text_len=2691,
    )
    assert len(caplog.records) == 1
    msg = caplog.records[0].message
    assert "DIY web grounding: grounded ok" in msg
    assert "finish_reason=STOP" in msg
    assert "prompt_token_count=84" in msg
    assert "thoughts_token_count=698" in msg
    assert "text_len=2691" in msg


def test_finish_reason_and_usage_helpers() -> None:
    class _Usage:
        prompt_token_count = 10
        candidates_token_count = 0
        thoughts_token_count = 150
        total_token_count = 160

    class _Candidate:
        finish_reason = "MAX_TOKENS"

    class _Resp:
        candidates = [_Candidate()]
        usage_metadata = _Usage()

    assert gsg.finish_reason_from_response(_Resp()) == "MAX_TOKENS"
    assert "thoughts_token_count=150" in gsg.usage_metadata_summary(_Resp())
