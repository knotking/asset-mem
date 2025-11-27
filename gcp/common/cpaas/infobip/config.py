"""
Configuration management for Infobip integration.

Supports loading credentials from:
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
class InfobipConfig:
    """
    Infobip configuration container.
    
    Credentials can be loaded from:
    - Environment variables (INFOBIP_API_KEY, INFOBIP_BASE_URL)
    - Google Cloud Secret Manager
    - Direct initialization
    
    Attributes:
        api_key: Infobip API Key
        base_url: Infobip API base URL (varies by account region)
        default_from: Default sender ID for SMS
        whatsapp_sender: WhatsApp sender number
        viber_sender: Viber sender ID
    """
    
    api_key: str = field(default="", repr=False)  # repr=False to hide in logs
    base_url: str = "https://api.infobip.com"
    default_from: Optional[str] = None
    whatsapp_sender: Optional[str] = None
    viber_sender: Optional[str] = None
    
    def __post_init__(self):
        """Validate configuration after initialization."""
        if not self.api_key:
            logger.warning("Infobip API key not configured")
        # Remove trailing slash from base_url if present
        self.base_url = self.base_url.rstrip("/")
    
    @classmethod
    def from_env(cls) -> "InfobipConfig":
        """
        Load configuration from environment variables.
        
        Expected environment variables:
        - INFOBIP_API_KEY: Your Infobip API Key
        - INFOBIP_BASE_URL: API base URL (optional, defaults to api.infobip.com)
        - INFOBIP_DEFAULT_FROM: Default sender ID (optional)
        - INFOBIP_WHATSAPP_SENDER: WhatsApp sender number (optional)
        - INFOBIP_VIBER_SENDER: Viber sender ID (optional)
        
        Returns:
            InfobipConfig: Configuration instance
        """
        return cls(
            api_key=os.getenv("INFOBIP_API_KEY", ""),
            base_url=os.getenv("INFOBIP_BASE_URL", "https://api.infobip.com"),
            default_from=os.getenv("INFOBIP_DEFAULT_FROM"),
            whatsapp_sender=os.getenv("INFOBIP_WHATSAPP_SENDER"),
            viber_sender=os.getenv("INFOBIP_VIBER_SENDER"),
        )
    
    @classmethod
    def from_gcp_secret_manager(
        cls,
        project_id: str,
        api_key_secret: str = "infobip-api-key",
        version: str = "latest",
    ) -> "InfobipConfig":
        """
        Load credentials from Google Cloud Secret Manager.
        
        Args:
            project_id: GCP project ID
            api_key_secret: Secret name for API Key
            version: Secret version (default: 'latest')
            
        Returns:
            InfobipConfig: Configuration instance
        """
        try:
            from google.cloud import secretmanager
            
            client = secretmanager.SecretManagerServiceClient()
            
            def get_secret(secret_name: str) -> str:
                name = f"projects/{project_id}/secrets/{secret_name}/versions/{version}"
                response = client.access_secret_version(request={"name": name})
                return response.payload.data.decode("UTF-8")
            
            api_key = get_secret(api_key_secret)
            
            logger.info("Successfully loaded Infobip credentials from Secret Manager")
            
            return cls(
                api_key=api_key,
                base_url=os.getenv("INFOBIP_BASE_URL", "https://api.infobip.com"),
                default_from=os.getenv("INFOBIP_DEFAULT_FROM"),
                whatsapp_sender=os.getenv("INFOBIP_WHATSAPP_SENDER"),
                viber_sender=os.getenv("INFOBIP_VIBER_SENDER"),
            )
            
        except Exception as e:
            logger.error(f"Failed to load secrets from Secret Manager: {e}")
            raise
    
    def validate(self) -> bool:
        """
        Validate that required credentials are present.
        
        Returns:
            bool: True if configuration is valid
            
        Raises:
            ValueError: If required credentials are missing
        """
        if not self.api_key:
            raise ValueError("INFOBIP_API_KEY is required")
        if not self.base_url:
            raise ValueError("INFOBIP_BASE_URL is required")
        return True
    
    @property
    def is_configured(self) -> bool:
        """Check if basic credentials are configured."""
        return bool(self.api_key)

