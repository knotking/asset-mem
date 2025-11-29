"""
Configuration management for Gemini Google Search Grounding API.

Supports loading credentials and configuration from:
1. Environment variables
2. Google Cloud Secret Manager
3. Direct configuration
"""

import os
import logging
from typing import Optional
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


@dataclass
class GeminiGoogleSearchConfig:
    """
    Gemini Google Search Grounding configuration container.
    
    Configuration can be loaded from:
    - Environment variables (GEMINI_* prefixed)
    - Google Cloud Secret Manager
    - Direct initialization
    
    Attributes:
        project_id: GCP project ID (required for Vertex AI)
        location: GCP location (e.g., 'us-central1', default: 'us-central1')
        api_key: Gemini API key (required for API key auth, optional for Vertex AI)
        use_vertex_ai: Whether to use Vertex AI (default: True if project_id is set)
        timeout: Request timeout in seconds (default: 60.0)
    """
    
    project_id: Optional[str] = field(default=None)
    location: str = field(default="us-central1")
    api_key: Optional[str] = field(default=None)
    use_vertex_ai: bool = field(default=True)
    timeout: float = field(default=60.0)
    
    def __post_init__(self):
        """Validate configuration after initialization."""
        if not self.use_vertex_ai and not self.api_key:
            logger.warning("Gemini Google Search: API key required when not using Vertex AI")
        
        if self.use_vertex_ai and not self.project_id:
            logger.warning("Gemini Google Search: Project ID required when using Vertex AI")
    
    @classmethod
    def from_env(cls) -> "GeminiGoogleSearchConfig":
        """
        Load configuration from environment variables.
        
        Expected environment variables:
        - GEMINI_PROJECT_ID: GCP project ID (required for Vertex AI)
        - GEMINI_LOCATION: GCP location (default: us-central1)
        - GEMINI_API_KEY: Gemini API key (required if not using Vertex AI)
        - GEMINI_USE_VERTEX_AI: Whether to use Vertex AI (default: True if project_id is set)
        - GEMINI_TIMEOUT: Request timeout in seconds (default: 60)
        
        Returns:
            GeminiGoogleSearchConfig: Configuration instance
        """
        project_id = os.getenv("GEMINI_PROJECT_ID")
        api_key = os.getenv("GEMINI_API_KEY")
        
        # Determine if we should use Vertex AI
        use_vertex_ai_str = os.getenv("GEMINI_USE_VERTEX_AI", "").lower()
        if use_vertex_ai_str == "false":
            use_vertex_ai = False
        elif use_vertex_ai_str == "true":
            use_vertex_ai = True
        else:
            # Default to True if project_id is set, False otherwise
            use_vertex_ai = bool(project_id)
        
        timeout_str = os.getenv("GEMINI_TIMEOUT", "60")
        try:
            timeout = float(timeout_str)
        except ValueError:
            timeout = 60.0
            logger.warning(f"Invalid GEMINI_TIMEOUT value: {timeout_str}, using default 60.0")
        
        return cls(
            project_id=project_id,
            location=os.getenv("GEMINI_LOCATION", "us-central1"),
            api_key=api_key,
            use_vertex_ai=use_vertex_ai,
            timeout=timeout,
        )
    
    @classmethod
    def from_gcp_secret_manager(
        cls,
        project_id: str,
        config_secret: str = "gemini-google-search-config",
        version: str = "latest",
    ) -> "GeminiGoogleSearchConfig":
        """
        Load configuration from Google Cloud Secret Manager.
        
        The secret should contain JSON with the configuration fields:
        {
            "project_id": "...",
            "location": "...",
            "api_key": "...",
            "use_vertex_ai": true/false,
            "timeout": 60.0
        }
        
        Args:
            project_id: GCP project ID for Secret Manager
            config_secret: Secret name containing config
            version: Secret version (default: 'latest')
            
        Returns:
            GeminiGoogleSearchConfig: Configuration instance
        """
        try:
            import json
            from google.cloud import secretmanager
            
            client = secretmanager.SecretManagerServiceClient()
            
            name = f"projects/{project_id}/secrets/{config_secret}/versions/{version}"
            response = client.access_secret_version(request={"name": name})
            config_data = json.loads(response.payload.data.decode("UTF-8"))
            
            logger.info("Successfully loaded Gemini Google Search config from Secret Manager")
            
            return cls(
                project_id=config_data.get("project_id"),
                location=config_data.get("location", "us-central1"),
                api_key=config_data.get("api_key"),
                use_vertex_ai=config_data.get("use_vertex_ai", True),
                timeout=config_data.get("timeout", 60.0),
            )
            
        except Exception as e:
            logger.error(f"Failed to load config from Secret Manager: {e}")
            raise
    
    def validate(self) -> bool:
        """
        Validate that required configuration is present.
        
        Returns:
            bool: True if configuration is valid
            
        Raises:
            ValueError: If required configuration is missing
        """
        if self.use_vertex_ai:
            if not self.project_id:
                raise ValueError("GEMINI_PROJECT_ID is required when using Vertex AI")
        else:
            if not self.api_key:
                raise ValueError("GEMINI_API_KEY is required when not using Vertex AI")
        return True
    
    @property
    def is_configured(self) -> bool:
        """Check if basic configuration is present."""
        if self.use_vertex_ai:
            return bool(self.project_id)
        return bool(self.api_key)

