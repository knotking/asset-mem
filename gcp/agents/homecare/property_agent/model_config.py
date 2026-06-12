"""
Gemini model selection for the Homecare property agent.

See ``docs/MODEL_POLICY.md`` for when to use each model class.
"""

from functools import cached_property, lru_cache
import os
from typing import ClassVar

from google import genai
from google.adk.models import Gemini
from google.genai import Client, types


class Gemini3(Gemini):
    @cached_property
    def api_client(self) -> Client:
        """Provides the api client with explicit configuration.

        Returns:
        The api client initialized with specific location and http_options.
        """
        # Ensure project ID is retrieved, falling back to a placeholder or raising an error if needed.
        project = os.getenv("GOOGLE_CLOUD_PROJECT")

        # Explicitly setting location to 'global' to avoid regional endpoint resolution issues
        location = "global"

        return Client(
            project=project,
            location=location,
            http_options=types.HttpOptions(
                headers=self._tracking_headers(),
                retry_options=self.retry_options,
            ),
        )


# ADK agents (root executor, checkpoint branches, synthesis): fast routing + streaming.
GLOBAL_GEMINI_MODEL = Gemini3(model="gemini-3.1-flash-lite")

# Phase 4 single-loop experiment: single flash call instead of flash-lite resolve + flash-lite executor.
SINGLE_LOOP_GEMINI_MODEL = Gemini3(model="gemini-3.5-flash")

GLOBAL_FLASH_LITE_MODEL_NAME: str = GLOBAL_GEMINI_MODEL.model


def global_agent_gemini_model() -> Gemini3:
    """Root agent model — single non-lite flash call for tool selection."""
    return SINGLE_LOOP_GEMINI_MODEL


def global_flash_lite_client_and_model() -> tuple[Client, str]:
    """Vertex ``location=global`` client + ``gemini-3.1-flash-lite`` for routing micro-LLMs."""
    return GLOBAL_GEMINI_MODEL.api_client, GLOBAL_GEMINI_MODEL.model


def global_direct_generate_client_and_model() -> tuple[Client, str]:
    """
    Vertex ``location=global`` client for direct ``generate_content`` (DIY web/steps).

    Newer Flash models (e.g. gemini-3.5-flash) are not available on the regional
    ``LEGACY_API_GEMINI`` client (``GOOGLE_CLOUD_LOCATION`` / us-central1).
    """
    return SINGLE_LOOP_GEMINI_MODEL.api_client, SINGLE_LOOP_GEMINI_MODEL.model


def direct_gemini_thinking_config(
    env_var: str,
    *,
    default: str = "minimal",
) -> types.ThinkingConfig:
    """
    ``thinking_level`` for gemini-3.x direct ``generate_content`` call sites.

    Env value: ``minimal`` | ``low`` | ``medium`` | ``high`` | ``0`` (legacy budget).
    Do not set both ``thinking_level`` and ``thinking_budget`` in one request.
    """
    raw = os.getenv(env_var, default).strip().lower()
    if raw in ("0", "off", "disabled", "budget0"):
        return types.ThinkingConfig(thinking_budget=0)
    return types.ThinkingConfig(thinking_level=raw)


@lru_cache(maxsize=1)
def _legacy_vertex_genai_client() -> genai.Client:
    """Standard Vertex google.genai client (not ADK Gemini.api_client)."""
    project = os.getenv("GOOGLE_CLOUD_PROJECT") or os.getenv("GCP_PROJECT_ID")
    return genai.Client(vertexai=True, project=project)


class _LegacyApiGemini:
    """Vertex `genai.Client` + `gemini-2.5-flash` for direct `generate_content` call sites."""

    model: ClassVar[str] = "gemini-2.5-flash"

    @property
    def api_client(self) -> genai.Client:
        return _legacy_vertex_genai_client()


# Direct ``generate_content`` call sites (cost estimator, DIY orchestrator steps/web).
LEGACY_API_GEMINI = _LegacyApiGemini()

# Same Vertex client as LEGACY_API_GEMINI (not ADK Gemini3 / location=global).
LEGACY_GEMINI_MODEL = LEGACY_API_GEMINI
