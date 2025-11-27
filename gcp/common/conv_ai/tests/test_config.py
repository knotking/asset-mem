"""Unit tests for DialogflowCXConfig."""

import pytest
import os
from unittest.mock import patch, MagicMock

from ..config import DialogflowCXConfig


class TestDialogflowCXConfigInit:
    """Tests for DialogflowCXConfig initialization."""

    def test_default_initialization(self):
        """Test config initializes with defaults."""
        config = DialogflowCXConfig()
        
        assert config.project_id == ""
        assert config.location == "us-central1"
        assert config.agent_id == ""
        assert config.language_code == "en"
        assert config.environment_id is None
        assert config.timeout == 30.0

    def test_custom_initialization(self):
        """Test config initializes with custom values."""
        config = DialogflowCXConfig(
            project_id="my-project",
            location="us-east1",
            agent_id="abc-123-def",
            language_code="es",
            environment_id="production",
            timeout=60.0,
        )
        
        assert config.project_id == "my-project"
        assert config.location == "us-east1"
        assert config.agent_id == "abc-123-def"
        assert config.language_code == "es"
        assert config.environment_id == "production"
        assert config.timeout == 60.0

    def test_api_endpoint_regional(self):
        """Test API endpoint is set correctly for regional location."""
        config = DialogflowCXConfig(
            project_id="test",
            location="us-central1",
            agent_id="agent-123",
        )
        
        assert config.api_endpoint == "us-central1-dialogflow.googleapis.com"

    def test_api_endpoint_global(self):
        """Test API endpoint is set correctly for global location."""
        config = DialogflowCXConfig(
            project_id="test",
            location="global",
            agent_id="agent-123",
        )
        
        assert config.api_endpoint == "dialogflow.googleapis.com"

    def test_custom_api_endpoint(self):
        """Test custom API endpoint is preserved."""
        config = DialogflowCXConfig(
            project_id="test",
            location="us-central1",
            agent_id="agent-123",
            api_endpoint="custom.dialogflow.googleapis.com",
        )
        
        assert config.api_endpoint == "custom.dialogflow.googleapis.com"


class TestDialogflowCXConfigFromEnv:
    """Tests for loading config from environment variables."""

    def test_from_env_with_all_vars(self):
        """Test loading config from environment variables."""
        env_vars = {
            "DIALOGFLOW_PROJECT_ID": "env-project",
            "DIALOGFLOW_LOCATION": "europe-west1",
            "DIALOGFLOW_AGENT_ID": "env-agent-id",
            "DIALOGFLOW_LANGUAGE_CODE": "fr",
            "DIALOGFLOW_ENVIRONMENT_ID": "staging",
            "DIALOGFLOW_TIMEOUT": "45.0",
        }
        
        with patch.dict(os.environ, env_vars, clear=False):
            config = DialogflowCXConfig.from_env()
            
            assert config.project_id == "env-project"
            assert config.location == "europe-west1"
            assert config.agent_id == "env-agent-id"
            assert config.language_code == "fr"
            assert config.environment_id == "staging"
            assert config.timeout == 45.0

    def test_from_env_with_defaults(self):
        """Test loading config uses defaults for missing env vars."""
        env_vars = {
            "DIALOGFLOW_PROJECT_ID": "test-project",
            "DIALOGFLOW_AGENT_ID": "test-agent",
        }
        
        with patch.dict(os.environ, env_vars, clear=True):
            config = DialogflowCXConfig.from_env()
            
            assert config.project_id == "test-project"
            assert config.location == "us-central1"  # default
            assert config.agent_id == "test-agent"
            assert config.language_code == "en"  # default
            assert config.environment_id is None
            assert config.timeout == 30.0  # default

    def test_from_env_invalid_timeout(self):
        """Test loading config handles invalid timeout value."""
        env_vars = {
            "DIALOGFLOW_PROJECT_ID": "test",
            "DIALOGFLOW_AGENT_ID": "agent",
            "DIALOGFLOW_TIMEOUT": "invalid",
        }
        
        with patch.dict(os.environ, env_vars, clear=True):
            config = DialogflowCXConfig.from_env()
            
            assert config.timeout == 30.0  # default on invalid

    def test_from_env_empty_vars(self):
        """Test loading config from empty environment."""
        with patch.dict(os.environ, {}, clear=True):
            config = DialogflowCXConfig.from_env()
            
            assert config.project_id == ""
            assert config.agent_id == ""


class TestDialogflowCXConfigFromSecretManager:
    """Tests for loading config from GCP Secret Manager."""

    def test_from_secret_manager_success(self):
        """Test loading config from Secret Manager."""
        mock_config = {
            "project_id": "secret-project",
            "location": "asia-northeast1",
            "agent_id": "secret-agent",
            "language_code": "ja",
            "environment_id": "production",
        }
        
        with patch("google.cloud.secretmanager.SecretManagerServiceClient") as mock_client:
            mock_response = MagicMock()
            mock_response.payload.data.decode.return_value = str(mock_config).replace("'", '"')
            mock_client.return_value.access_secret_version.return_value = mock_response
            
            import json
            mock_response.payload.data.decode.return_value = json.dumps(mock_config)
            
            config = DialogflowCXConfig.from_gcp_secret_manager(
                project_id="secrets-project",
                agent_config_secret="dialogflow-config"
            )
            
            assert config.project_id == "secret-project"
            assert config.location == "asia-northeast1"
            assert config.agent_id == "secret-agent"
            assert config.language_code == "ja"
            assert config.environment_id == "production"

    def test_from_secret_manager_failure(self):
        """Test handling Secret Manager errors."""
        with patch("google.cloud.secretmanager.SecretManagerServiceClient") as mock_client:
            mock_client.return_value.access_secret_version.side_effect = Exception("Access denied")
            
            with pytest.raises(Exception) as exc_info:
                DialogflowCXConfig.from_gcp_secret_manager(
                    project_id="test-project",
                    agent_config_secret="missing-secret"
                )
            
            assert "Access denied" in str(exc_info.value)


class TestDialogflowCXConfigValidation:
    """Tests for config validation."""

    def test_validate_success(self):
        """Test validation passes with valid config."""
        config = DialogflowCXConfig(
            project_id="valid-project",
            location="us-central1",
            agent_id="valid-agent-id",
        )
        
        assert config.validate() is True

    def test_validate_missing_project_id(self):
        """Test validation fails without project_id."""
        config = DialogflowCXConfig(
            location="us-central1",
            agent_id="agent-123",
        )
        
        with pytest.raises(ValueError) as exc_info:
            config.validate()
        
        assert "DIALOGFLOW_PROJECT_ID" in str(exc_info.value)

    def test_validate_missing_agent_id(self):
        """Test validation fails without agent_id."""
        config = DialogflowCXConfig(
            project_id="test-project",
            location="us-central1",
        )
        
        with pytest.raises(ValueError) as exc_info:
            config.validate()
        
        assert "DIALOGFLOW_AGENT_ID" in str(exc_info.value)

    def test_validate_missing_location(self):
        """Test validation fails without location."""
        config = DialogflowCXConfig(
            project_id="test-project",
            location="",
            agent_id="agent-123",
        )
        
        with pytest.raises(ValueError) as exc_info:
            config.validate()
        
        assert "DIALOGFLOW_LOCATION" in str(exc_info.value)


class TestDialogflowCXConfigProperties:
    """Tests for config properties."""

    def test_is_configured_true(self):
        """Test is_configured returns True when configured."""
        config = DialogflowCXConfig(
            project_id="my-project",
            location="us-central1",
            agent_id="my-agent",
        )
        
        assert config.is_configured is True

    def test_is_configured_false(self):
        """Test is_configured returns False when not configured."""
        config = DialogflowCXConfig()
        
        assert config.is_configured is False

    def test_is_configured_partial(self):
        """Test is_configured returns False with partial config."""
        config = DialogflowCXConfig(project_id="test")
        
        assert config.is_configured is False

    def test_agent_path(self):
        """Test agent_path property."""
        config = DialogflowCXConfig(
            project_id="my-project",
            location="us-central1",
            agent_id="agent-abc-123",
        )
        
        expected = "projects/my-project/locations/us-central1/agents/agent-abc-123"
        assert config.agent_path == expected

    def test_environment_path_with_env(self):
        """Test environment_path with environment_id set."""
        config = DialogflowCXConfig(
            project_id="my-project",
            location="us-central1",
            agent_id="agent-123",
            environment_id="production",
        )
        
        expected = "projects/my-project/locations/us-central1/agents/agent-123/environments/production"
        assert config.environment_path == expected

    def test_environment_path_without_env(self):
        """Test environment_path without environment_id."""
        config = DialogflowCXConfig(
            project_id="my-project",
            location="us-central1",
            agent_id="agent-123",
        )
        
        assert config.environment_path is None

