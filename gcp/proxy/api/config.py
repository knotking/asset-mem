"""
Configuration Management Module

Centralized configuration with validation using Pydantic Settings.
Validates all required environment variables on startup.
"""

import os
from typing import List, Optional
from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings with environment variable validation."""
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore"
    )
    
    # GCP Configuration
    gcp_project_id: Optional[str] = Field(default=None, description="GCP Project ID")
    gcp_region: Optional[str] = Field(default="us-central1", description="GCP Region")
    gcp_location: Optional[str] = Field(default="us-central1", description="GCP Location for Vertex AI")
    
    # Vertex AI Configuration
    reasoning_engine_id: Optional[str] = Field(default=None, description="Vertex AI Reasoning Engine ID")
    
    # Webhook Secrets
    telegram_webhook_secret: Optional[str] = Field(default=None, description="Telegram webhook secret")
    firebase_webhook_secret: Optional[str] = Field(default=None, description="Firebase webhook secret")
    
    # Telegram Configuration
    telegram_bot_token: Optional[str] = Field(default=None, description="Telegram bot token")
    
    # GCS Configuration
    gcs_bucket: Optional[str] = Field(default=None, description="GCS bucket name")
    
    # Pub/Sub Configuration
    user_upload_topic: Optional[str] = Field(default=None, description="Pub/Sub topic for user uploads")
    user_upload_result_subscription: Optional[str] = Field(
        default=None, 
        description="Pub/Sub subscription for user upload results"
    )
    
    # CORS Configuration
    cors_origins: str = Field(
        default="*",
        description="Comma-separated list of allowed CORS origins (use * for all)"
    )
    
    # Logging Configuration
    log_level: str = Field(default="INFO", description="Logging level")
    
    # Application Configuration
    app_name: str = Field(default="GCP Proxy API", description="Application name")
    app_version: str = Field(default="1.0.0", description="Application version")
    
    @field_validator("cors_origins")
    @classmethod
    def parse_cors_origins(cls, v: str) -> List[str]:
        """Parse comma-separated CORS origins."""
        if v == "*":
            return ["*"]
        return [origin.strip() for origin in v.split(",") if origin.strip()]
    
    @field_validator("log_level")
    @classmethod
    def validate_log_level(cls, v: str) -> str:
        """Validate log level."""
        valid_levels = ["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"]
        v_upper = v.upper()
        if v_upper not in valid_levels:
            raise ValueError(f"Log level must be one of {valid_levels}")
        return v_upper
    
    def validate_required(self) -> None:
        """Validate that required settings are present."""
        required_fields = {
            "gcp_project_id": self.gcp_project_id,
            "reasoning_engine_id": self.reasoning_engine_id,
        }
        
        missing = [field for field, value in required_fields.items() if not value]
        if missing:
            raise ValueError(f"Missing required configuration: {', '.join(missing)}")
    
    def get_cors_origins(self) -> List[str]:
        """Get CORS origins as a list."""
        return self.parse_cors_origins(self.cors_origins)


# Global settings instance
settings = Settings()

# Validate on import (optional - can be deferred to startup)
try:
    settings.validate_required()
except ValueError as e:
    import logging
    logger = logging.getLogger(__name__)
    logger.warning(f"Configuration validation warning: {e}")
