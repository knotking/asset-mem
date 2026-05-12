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

GLOBAL_GEMINI_MODEL = Gemini3(model="gemini-3.1-flash-lite")


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


# Cost AI + DIY orchestrator; ADK agents use GLOBAL_GEMINI_MODEL above.
LEGACY_API_GEMINI = _LegacyApiGemini()