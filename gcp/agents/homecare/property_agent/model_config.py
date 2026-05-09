from functools import cached_property
import os
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