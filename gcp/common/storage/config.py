"""
Configuration management for GCP Storage API.

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
class StorageConfig:
    """
    GCP Storage configuration container.
    
    Configuration can be loaded from:
    - Environment variables (GCS_* prefixed)
    - Google Cloud Secret Manager
    - Direct initialization
    
    Attributes:
        project_id: GCP project ID (optional, can be inferred from credentials)
        bucket_name: Default bucket name (optional)
        location: Default bucket location (e.g., 'us-central1', default: 'us-central1')
        timeout: Request timeout in seconds (default: 60.0)
    """
    
    project_id: Optional[str] = field(default=None)
    bucket_name: Optional[str] = field(default=None)
    location: str = field(default="us-central1")
    timeout: float = field(default=60.0)
    
    @classmethod
    def from_env(cls) -> "StorageConfig":
        """
        Load configuration from environment variables.
        
        Expected environment variables:
        - GCS_PROJECT_ID: GCP project ID (optional)
        - GCS_BUCKET_NAME: Default bucket name (optional)
        - GCS_LOCATION: Default bucket location (default: us-central1)
        - GCS_TIMEOUT: Request timeout in seconds (default: 60)
        
        Returns:
            StorageConfig: Configuration instance
        """
        timeout_str = os.getenv("GCS_TIMEOUT", "60")
        try:
            timeout = float(timeout_str)
        except ValueError:
            timeout = 60.0
            logger.warning(f"Invalid GCS_TIMEOUT value: {timeout_str}, using default 60.0")
        
        return cls(
            project_id=os.getenv("GCS_PROJECT_ID"),
            bucket_name=os.getenv("GCS_BUCKET_NAME"),
            location=os.getenv("GCS_LOCATION", "us-central1"),
            timeout=timeout,
        )
    
    @classmethod
    def from_gcp_secret_manager(
        cls,
        project_id: str,
        config_secret: str = "gcs-storage-config",
        version: str = "latest",
    ) -> "StorageConfig":
        """
        Load configuration from Google Cloud Secret Manager.
        
        The secret should contain JSON with the configuration fields:
        {
            "project_id": "...",
            "bucket_name": "...",
            "location": "...",
            "timeout": 60.0
        }
        
        Args:
            project_id: GCP project ID for Secret Manager
            config_secret: Secret name containing config
            version: Secret version (default: 'latest')
            
        Returns:
            StorageConfig: Configuration instance
        """
        try:
            import json
            from google.cloud import secretmanager
            
            client = secretmanager.SecretManagerServiceClient()
            
            name = f"projects/{project_id}/secrets/{config_secret}/versions/{version}"
            response = client.access_secret_version(request={"name": name})
            config_data = json.loads(response.payload.data.decode("UTF-8"))
            
            logger.info("Successfully loaded GCS Storage config from Secret Manager")
            
            return cls(
                project_id=config_data.get("project_id"),
                bucket_name=config_data.get("bucket_name"),
                location=config_data.get("location", "us-central1"),
                timeout=config_data.get("timeout", 60.0),
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
        # Storage client can work without explicit project_id (uses ADC)
        return True

