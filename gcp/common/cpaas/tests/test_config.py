"""Unit tests for TwilioConfig."""

import os
import pytest
from unittest.mock import patch, MagicMock

from ..config import TwilioConfig


class TestTwilioConfig:
    """Tests for TwilioConfig class."""

    def test_direct_initialization(self):
        """Test direct initialization with credentials."""
        config = TwilioConfig(
            account_sid="AC1234567890abcdef1234567890abcdef",
            auth_token="test_auth_token_12345",
            default_from_number="+1234567890",
        )
        
        assert config.account_sid == "AC1234567890abcdef1234567890abcdef"
        assert config.auth_token == "test_auth_token_12345"
        assert config.default_from_number == "+1234567890"
        assert config.is_configured is True

    def test_default_values(self):
        """Test default configuration values."""
        config = TwilioConfig()
        
        assert config.account_sid == ""
        assert config.auth_token == ""
        assert config.default_from_number is None
        assert config.messaging_service_sid is None
        assert config.whatsapp_from_number is None
        assert config.api_base_url == "https://api.twilio.com/2010-04-01"
        assert config.content_api_url == "https://content.twilio.com/v1"

    def test_is_configured_false_when_empty(self):
        """Test is_configured returns False when credentials missing."""
        config = TwilioConfig()
        assert config.is_configured is False
        
        config = TwilioConfig(account_sid="AC123")
        assert config.is_configured is False
        
        config = TwilioConfig(auth_token="token")
        assert config.is_configured is False

    def test_is_configured_true_when_complete(self):
        """Test is_configured returns True when credentials present."""
        config = TwilioConfig(
            account_sid="AC1234567890abcdef1234567890abcdef",
            auth_token="test_token",
        )
        assert config.is_configured is True

    @patch.dict(os.environ, {
        "TWILIO_ACCOUNT_SID": "ACtest123456789012345678901234",
        "TWILIO_AUTH_TOKEN": "test_token_from_env",
        "TWILIO_DEFAULT_FROM_NUMBER": "+19876543210",
        "TWILIO_MESSAGING_SERVICE_SID": "MGtest123",
        "TWILIO_WHATSAPP_FROM_NUMBER": "+11234567890",
    })
    def test_from_env(self):
        """Test loading config from environment variables."""
        config = TwilioConfig.from_env()
        
        assert config.account_sid == "ACtest123456789012345678901234"
        assert config.auth_token == "test_token_from_env"
        assert config.default_from_number == "+19876543210"
        assert config.messaging_service_sid == "MGtest123"
        assert config.whatsapp_from_number == "+11234567890"

    @patch.dict(os.environ, {}, clear=True)
    def test_from_env_empty(self):
        """Test from_env with no environment variables set."""
        # Clear any existing env vars
        for key in ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", 
                    "TWILIO_DEFAULT_FROM_NUMBER", "TWILIO_MESSAGING_SERVICE_SID",
                    "TWILIO_WHATSAPP_FROM_NUMBER"]:
            os.environ.pop(key, None)
            
        config = TwilioConfig.from_env()
        
        assert config.account_sid == ""
        assert config.auth_token == ""
        assert config.default_from_number is None

    def test_validate_success(self):
        """Test validate returns True for valid config."""
        config = TwilioConfig(
            account_sid="AC1234567890abcdef1234567890abcdef",
            auth_token="valid_token",
        )
        assert config.validate() is True

    def test_validate_missing_account_sid(self):
        """Test validate raises error for missing account_sid."""
        config = TwilioConfig(auth_token="token")
        
        with pytest.raises(ValueError, match="TWILIO_ACCOUNT_SID is required"):
            config.validate()

    def test_validate_missing_auth_token(self):
        """Test validate raises error for missing auth_token."""
        config = TwilioConfig(account_sid="AC1234567890abcdef1234567890abcdef")
        
        with pytest.raises(ValueError, match="TWILIO_AUTH_TOKEN is required"):
            config.validate()

    def test_validate_invalid_account_sid_format(self):
        """Test validate raises error for invalid account_sid format."""
        config = TwilioConfig(
            account_sid="invalid_sid",
            auth_token="valid_token",
        )
        
        with pytest.raises(ValueError, match="Invalid TWILIO_ACCOUNT_SID format"):
            config.validate()

    def test_auth_token_hidden_in_repr(self):
        """Test that auth_token is hidden in repr output."""
        config = TwilioConfig(
            account_sid="AC123",
            auth_token="secret_token_should_not_appear",
        )
        
        repr_str = repr(config)
        assert "secret_token_should_not_appear" not in repr_str

    @patch("google.cloud.secretmanager.SecretManagerServiceClient")
    def test_from_gcp_secret_manager(self, mock_client_class):
        """Test loading config from GCP Secret Manager."""
        # Setup mock
        mock_client = MagicMock()
        mock_client_class.return_value = mock_client
        
        def mock_access_secret(request):
            secret_name = request["name"]
            mock_response = MagicMock()
            if "account-sid" in secret_name:
                mock_response.payload.data = b"ACsecretmanager123456789012345"
            else:
                mock_response.payload.data = b"secret_auth_token"
            return mock_response
        
        mock_client.access_secret_version = mock_access_secret
        
        config = TwilioConfig.from_gcp_secret_manager(
            project_id="test-project",
            account_sid_secret="twilio-account-sid",
            auth_token_secret="twilio-auth-token",
        )
        
        assert config.account_sid == "ACsecretmanager123456789012345"
        assert config.auth_token == "secret_auth_token"

