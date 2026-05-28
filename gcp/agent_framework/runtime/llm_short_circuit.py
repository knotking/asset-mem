"""Build ADK LlmResponse objects that short-circuit the model."""

from __future__ import annotations

from google.adk.models.llm_response import LlmResponse
from google.genai import types


def plain_text_llm_response(text: str) -> LlmResponse:
    """Return a model-role LlmResponse with plain text (skips executor LLM)."""
    return LlmResponse(
        content=types.Content(role="model", parts=[types.Part(text=text)]),
    )
