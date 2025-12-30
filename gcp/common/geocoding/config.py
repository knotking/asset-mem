"""
Configuration management for Geocoding service.

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
class GeocodingConfig:
    """
    Geocoding configuration container.
    
    Configuration can be loaded from:
    - Environment variables (GEOCODING_* or GOOGLE_MAPS_* prefixed)
    - Google Cloud Secret Manager
    - Direct initialization
    
    Attributes:
        api_key: Google Maps API key (required for Geocoding API)
        timeout: Request timeout in seconds (default: 10.0)
        use_places_api: Whether to use Places API for enhanced results (default: False)
    """
    
    api_key: Optional[str] = field(default=None)
    timeout: float = field(default=10.0)
    use_places_api: bool = field(default=False)
    
    def __post_init__(self):
        """Validate configuration after initialization."""
        if not self.api_key:
            logger.warning("Geocoding: API key not configured")
    
    @classmethod
    def from_env(cls) -> "GeocodingConfig":
        """
        Load configuration from environment variables.
        
        Expected environment variables:
        - GOOGLE_MAPS_API_KEY or GEOCODING_API_KEY: Google Maps API key (required)
        - GEOCODING_TIMEOUT: Request timeout in seconds (default: 10)
        - GEOCODING_USE_PLACES_API: Whether to use Places API (default: False)
        
        Returns:
            GeocodingConfig: Configuration instance
        """
        # Try multiple environment variable names for API key
        api_key = os.getenv("GOOGLE_MAPS_API_KEY") or os.getenv("GEOCODING_API_KEY")
        
        timeout_str = os.getenv("GEOCODING_TIMEOUT", "10")
        try:
            timeout = float(timeout_str)
        except ValueError:
            timeout = 10.0
            logger.warning(f"Invalid GEOCODING_TIMEOUT value: {timeout_str}, using default 10.0")
        
        use_places_api_str = os.getenv("GEOCODING_USE_PLACES_API", "false").lower()
        use_places_api = use_places_api_str == "true"
        
        return cls(
            api_key=api_key,
            timeout=timeout,
            use_places_api=use_places_api,
        )
    
    @classmethod
    def from_gcp_secret_manager(
        cls,
        project_id: str,
        config_secret: str = "geocoding-config",
        version: str = "latest",
    ) -> "GeocodingConfig":
        """
        Load configuration from Google Cloud Secret Manager.
        
        The secret should contain JSON with the configuration fields:
        {
            "api_key": "...",
            "timeout": 10.0,
            "use_places_api": false
        }
        
        Args:
            project_id: GCP project ID for Secret Manager
            config_secret: Secret name containing config
            version: Secret version (default: 'latest')
            
        Returns:
            GeocodingConfig: Configuration instance
        """
        try:
            import json
            from google.cloud import secretmanager
            
            client = secretmanager.SecretManagerServiceClient()
            
            name = f"projects/{project_id}/secrets/{config_secret}/versions/{version}"
            response = client.access_secret_version(request={"name": name})
            config_data = json.loads(response.payload.data.decode("UTF-8"))
            
            logger.info("Successfully loaded Geocoding config from Secret Manager")
            
            return cls(
                api_key=config_data.get("api_key"),
                timeout=config_data.get("timeout", 10.0),
                use_places_api=config_data.get("use_places_api", False),
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
        if not self.api_key:
            raise ValueError("GOOGLE_MAPS_API_KEY or GEOCODING_API_KEY is required")
        return True
    
    @property
    def is_configured(self) -> bool:
        """Check if basic configuration is present."""
        return bool(self.api_key)

