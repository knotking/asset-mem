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
