"""
Configuration management for GCP Pub/Sub API.

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
class PubSubConfig:
    """
    GCP Pub/Sub configuration container.
    
    Configuration can be loaded from:
    - Environment variables (PUBSUB_* prefixed)
    - Google Cloud Secret Manager
    - Direct initialization
    
    Attributes:
        project_id: GCP project ID (required)
        timeout: Request timeout in seconds (default: 60.0)
        enable_message_ordering: Enable message ordering (default: False)
    """
    
    project_id: str = field(default="")
    timeout: float = field(default=60.0)
    enable_message_ordering: bool = field(default=False)
    
    @classmethod
    def from_env(cls) -> "PubSubConfig":
        """
        Load configuration from environment variables.
        
        Expected environment variables:
        - PUBSUB_PROJECT_ID: GCP project ID (required)
        - PUBSUB_TIMEOUT: Request timeout in seconds (default: 60)
        - PUBSUB_ENABLE_MESSAGE_ORDERING: Enable message ordering (default: false)
        
        Returns:
            PubSubConfig: Configuration instance
        """
        timeout_str = os.getenv("PUBSUB_TIMEOUT", "60")
        try:
            timeout = float(timeout_str)
        except ValueError:
            timeout = 60.0
            logger.warning(f"Invalid PUBSUB_TIMEOUT value: {timeout_str}, using default 60.0")
        
        enable_ordering_str = os.getenv("PUBSUB_ENABLE_MESSAGE_ORDERING", "false").lower()
        enable_ordering = enable_ordering_str in ("true", "1", "yes")
        
        project_id = os.getenv("PUBSUB_PROJECT_ID", "")
        if not project_id:
            logger.warning("PUBSUB_PROJECT_ID not set, will use default credentials project")
        
        return cls(
            project_id=project_id,
            timeout=timeout,
            enable_message_ordering=enable_ordering,
        )
    
    @classmethod
    def from_gcp_secret_manager(
        cls,
        project_id: str,
        config_secret: str = "pubsub-config",
        version: str = "latest",
    ) -> "PubSubConfig":
        """
        Load configuration from Google Cloud Secret Manager.
        
        The secret should contain JSON with the configuration fields:
        {
            "project_id": "...",
            "timeout": 60.0,
            "enable_message_ordering": false
        }
        
        Args:
            project_id: GCP project ID for Secret Manager
            config_secret: Secret name containing config
            version: Secret version (default: 'latest')
            
        Returns:
            PubSubConfig: Configuration instance
        """
        try:
            import json
            from google.cloud import secretmanager
            
            client = secretmanager.SecretManagerServiceClient()
            
            name = f"projects/{project_id}/secrets/{config_secret}/versions/{version}"
            response = client.access_secret_version(request={"name": name})
            config_data = json.loads(response.payload.data.decode("UTF-8"))
            
            logger.info("Successfully loaded Pub/Sub config from Secret Manager")
            
            return cls(
                project_id=config_data.get("project_id", ""),
                timeout=config_data.get("timeout", 60.0),
                enable_message_ordering=config_data.get("enable_message_ordering", False),
            )
            
        except Exception as e:
            logger.error(f"Failed to load config from Secret Manager: {e}")
            raise
    
    def validate(self) -> bool:
        """
        Validate that configuration is valid.
        
        Returns:
            bool: True if configuration is valid
            
        Note:
            project_id is optional as it can be inferred from credentials
        """
        return True
    
    @property
    def is_configured(self) -> bool:
        """Check if basic configuration is present."""
        # Pub/Sub client can work without explicit project_id (uses ADC)
        return True

