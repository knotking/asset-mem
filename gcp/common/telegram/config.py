"""
Configuration management for Telegram Bot API.

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
class TelegramConfig:
    """
    Telegram Bot configuration container.
    
    Configuration can be loaded from:
    - Environment variables (TELEGRAM_* prefixed)
    - Google Cloud Secret Manager
    - Direct initialization
    
    Attributes:
        bot_token: Telegram Bot API token (required)
        webhook_secret: Webhook secret for securing webhook endpoints (optional)
    """
    
    bot_token: str = field(default="")
    webhook_secret: Optional[str] = field(default=None)
    
    def __post_init__(self):
        """Validate configuration after initialization."""
        if not self.bot_token:
            logger.warning("Telegram Bot: Bot token is required")
    
    @classmethod
    def from_env(cls) -> "TelegramConfig":
        """
        Load configuration from environment variables.
        
        Expected environment variables:
        - TELEGRAM_BOT_TOKEN: Telegram Bot API token (required)
        - TELEGRAM_WEBHOOK_SECRET: Webhook secret (optional)
        
        Returns:
            TelegramConfig: Configuration instance
        """
        return cls(
            bot_token=os.getenv("TELEGRAM_BOT_TOKEN", ""),
            webhook_secret=os.getenv("TELEGRAM_WEBHOOK_SECRET"),
        )
    
    @classmethod
    def from_gcp_secret_manager(
        cls,
        project_id: str,
        config_secret: str = "telegram-bot-config",
        version: str = "latest",
    ) -> "TelegramConfig":
        """
        Load configuration from Google Cloud Secret Manager.
        
        The secret should contain JSON with the configuration fields:
        {
            "bot_token": "...",
            "webhook_secret": "..."
        }
        
        Args:
            project_id: GCP project ID for Secret Manager
            config_secret: Secret name containing config
            version: Secret version (default: 'latest')
            
        Returns:
            TelegramConfig: Configuration instance
        """
        try:
            import json
            from google.cloud import secretmanager
            
            client = secretmanager.SecretManagerServiceClient()
            
            name = f"projects/{project_id}/secrets/{config_secret}/versions/{version}"
            response = client.access_secret_version(request={"name": name})
            config_data = json.loads(response.payload.data.decode("UTF-8"))
            
            logger.info("Successfully loaded Telegram config from Secret Manager")
            
            return cls(
                bot_token=config_data.get("bot_token", ""),
                webhook_secret=config_data.get("webhook_secret"),
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
        if not self.bot_token:
            raise ValueError("TELEGRAM_BOT_TOKEN is required")
        return True
    
    @property
    def is_configured(self) -> bool:
        """Check if basic configuration is present."""
        return bool(self.bot_token)

