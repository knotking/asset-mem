"""
Configuration management for Firebase Admin SDK integration.

Supports loading configuration from:
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
class FirebaseConfig:
    """
    Firebase Admin SDK configuration container.
    
    Configuration can be loaded from:
    - Environment variables (FIREBASE_* prefixed)
    - Google Cloud Secret Manager
    - Direct initialization
    
    Attributes:
        project_id: GCP project ID (optional, will use default credentials if not set)
        credentials_path: Path to service account JSON file (optional)
        use_default_credentials: Whether to use default GCP credentials (default: True)
    """
    
    project_id: Optional[str] = None
    credentials_path: Optional[str] = None
    use_default_credentials: bool = field(default=True)
    
    def __post_init__(self):
        """Validate configuration after initialization."""
        if not self.use_default_credentials and not self.credentials_path:
            logger.warning("Firebase credentials not configured - will attempt default credentials")
    
    @classmethod
    def from_env(cls) -> "FirebaseConfig":
        """
        Load configuration from environment variables.
        
        Expected environment variables:
        - FIREBASE_PROJECT_ID: GCP project ID (optional)
        - FIREBASE_CREDENTIALS_PATH: Path to service account JSON file (optional)
        - GOOGLE_APPLICATION_CREDENTIALS: Path to credentials file (used if FIREBASE_CREDENTIALS_PATH not set)
        
        Returns:
            FirebaseConfig: Configuration instance
        """
        credentials_path = os.getenv("FIREBASE_CREDENTIALS_PATH") or os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
        
        return cls(
            project_id=os.getenv("FIREBASE_PROJECT_ID") or os.getenv("GCP_PROJECT_ID"),
            credentials_path=credentials_path,
            use_default_credentials=credentials_path is None,
        )
    
    @classmethod
    def from_gcp_secret_manager(
        cls,
        project_id: str,
        config_secret: str = "firebase-config",
        version: str = "latest",
    ) -> "FirebaseConfig":
        """
        Load configuration from Google Cloud Secret Manager.
        
        The secret should contain JSON with the configuration fields:
        {
            "project_id": "...",
            "credentials_path": "...",
            "use_default_credentials": true
        }
        
        Args:
            project_id: GCP project ID for Secret Manager
            config_secret: Secret name containing Firebase config
            version: Secret version (default: 'latest')
            
        Returns:
            FirebaseConfig: Configuration instance
        """
        try:
            import json
            from google.cloud import secretmanager
            
            client = secretmanager.SecretManagerServiceClient()
            
            name = f"projects/{project_id}/secrets/{config_secret}/versions/{version}"
            response = client.access_secret_version(request={"name": name})
            config_data = json.loads(response.payload.data.decode("UTF-8"))
            
            logger.info("Successfully loaded Firebase config from Secret Manager")
            
            return cls(
                project_id=config_data.get("project_id"),
                credentials_path=config_data.get("credentials_path"),
                use_default_credentials=config_data.get("use_default_credentials", True),
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
            Firebase Admin SDK can work with default credentials even without explicit config
        """
        return True
    
    @property
    def is_configured(self) -> bool:
        """Check if configuration is present."""
        return self.use_default_credentials or bool(self.credentials_path)

