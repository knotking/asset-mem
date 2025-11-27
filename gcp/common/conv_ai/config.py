"""
Configuration management for Google Conversational AI (Dialogflow CX) integration.

Supports loading credentials and agent configuration from:
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
class DialogflowCXConfig:
    """
    Dialogflow CX configuration container.
    
    Configuration can be loaded from:
    - Environment variables (DIALOGFLOW_* prefixed)
    - Google Cloud Secret Manager
    - Direct initialization
    
    Attributes:
        project_id: GCP project ID containing the agent
        location: Agent location (e.g., 'us-central1', 'global')
        agent_id: Dialogflow CX Agent ID (UUID format)
        language_code: Default language code (e.g., 'en')
        environment_id: Optional environment ID (defaults to 'draft' if not specified)
        timeout: Request timeout in seconds
    """
    
    project_id: str = field(default="")
    location: str = field(default="us-central1")
    agent_id: str = field(default="")
    language_code: str = field(default="en")
    environment_id: Optional[str] = None
    timeout: float = field(default=30.0)
    
    # Endpoint configuration
    api_endpoint: Optional[str] = None  # If None, uses default regional endpoint
    
    def __post_init__(self):
        """Validate configuration after initialization."""
        if not self.project_id or not self.agent_id:
            logger.warning("Dialogflow CX credentials not fully configured")
        
        # Set default API endpoint based on location
        if not self.api_endpoint:
            if self.location == "global":
                self.api_endpoint = "dialogflow.googleapis.com"
            else:
                self.api_endpoint = f"{self.location}-dialogflow.googleapis.com"
    
    @classmethod
    def from_env(cls) -> "DialogflowCXConfig":
        """
        Load configuration from environment variables.
        
        Expected environment variables:
        - DIALOGFLOW_PROJECT_ID: GCP project ID
        - DIALOGFLOW_LOCATION: Agent location (default: us-central1)
        - DIALOGFLOW_AGENT_ID: Agent ID (UUID)
        - DIALOGFLOW_LANGUAGE_CODE: Language code (default: en)
        - DIALOGFLOW_ENVIRONMENT_ID: Environment ID (optional)
        - DIALOGFLOW_TIMEOUT: Request timeout in seconds (default: 30)
        
        Returns:
            DialogflowCXConfig: Configuration instance
        """
        timeout_str = os.getenv("DIALOGFLOW_TIMEOUT", "30")
        try:
            timeout = float(timeout_str)
        except ValueError:
            timeout = 30.0
            logger.warning(f"Invalid DIALOGFLOW_TIMEOUT value: {timeout_str}, using default 30.0")
        
        return cls(
            project_id=os.getenv("DIALOGFLOW_PROJECT_ID", ""),
            location=os.getenv("DIALOGFLOW_LOCATION", "us-central1"),
            agent_id=os.getenv("DIALOGFLOW_AGENT_ID", ""),
            language_code=os.getenv("DIALOGFLOW_LANGUAGE_CODE", "en"),
            environment_id=os.getenv("DIALOGFLOW_ENVIRONMENT_ID"),
            timeout=timeout,
            api_endpoint=os.getenv("DIALOGFLOW_API_ENDPOINT"),
        )
    
    @classmethod
    def from_gcp_secret_manager(
        cls,
        project_id: str,
        agent_config_secret: str = "dialogflow-agent-config",
        version: str = "latest",
    ) -> "DialogflowCXConfig":
        """
        Load configuration from Google Cloud Secret Manager.
        
        The secret should contain JSON with the configuration fields:
        {
            "project_id": "...",
            "location": "...",
            "agent_id": "...",
            "language_code": "...",
            "environment_id": "..."
        }
        
        Args:
            project_id: GCP project ID for Secret Manager
            agent_config_secret: Secret name containing agent config
            version: Secret version (default: 'latest')
            
        Returns:
            DialogflowCXConfig: Configuration instance
        """
        try:
            import json
            from google.cloud import secretmanager
            
            client = secretmanager.SecretManagerServiceClient()
            
            name = f"projects/{project_id}/secrets/{agent_config_secret}/versions/{version}"
            response = client.access_secret_version(request={"name": name})
            config_data = json.loads(response.payload.data.decode("UTF-8"))
            
            logger.info("Successfully loaded Dialogflow CX config from Secret Manager")
            
            return cls(
                project_id=config_data.get("project_id", ""),
                location=config_data.get("location", "us-central1"),
                agent_id=config_data.get("agent_id", ""),
                language_code=config_data.get("language_code", "en"),
                environment_id=config_data.get("environment_id"),
                timeout=config_data.get("timeout", 30.0),
                api_endpoint=config_data.get("api_endpoint"),
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
        if not self.project_id:
            raise ValueError("DIALOGFLOW_PROJECT_ID is required")
        if not self.agent_id:
            raise ValueError("DIALOGFLOW_AGENT_ID is required")
        if not self.location:
            raise ValueError("DIALOGFLOW_LOCATION is required")
        return True
    
    @property
    def is_configured(self) -> bool:
        """Check if basic configuration is present."""
        return bool(self.project_id and self.agent_id and self.location)
    
    @property
    def agent_path(self) -> str:
        """
        Get the full agent resource path.
        
        Returns:
            str: Agent path in format 'projects/{project}/locations/{location}/agents/{agent}'
        """
        return f"projects/{self.project_id}/locations/{self.location}/agents/{self.agent_id}"
    
    @property
    def environment_path(self) -> Optional[str]:
        """
        Get the full environment resource path if environment_id is set.
        
        Returns:
            str: Environment path or None
        """
        if self.environment_id:
            return f"{self.agent_path}/environments/{self.environment_id}"
        return None

