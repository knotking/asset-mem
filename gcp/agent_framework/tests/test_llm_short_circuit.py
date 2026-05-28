"""Tests for plain_text_llm_response."""

from __future__ import annotations

from agent_framework.runtime.llm_short_circuit import plain_text_llm_response


def test_plain_text_llm_response() -> None:
    response = plain_text_llm_response("hello")
    assert response.content is not None
    assert response.content.parts[0].text == "hello"
