"""Tests for Gemini File Search configuration."""

import os
import pytest
from ..config import GeminiFileSearchConfig


class TestGeminiFileSearchConfig:
    """Test GeminiFileSearchConfig."""
    
    def test_from_env_with_project_id(self, monkeypatch):
        """Test loading config from env with project ID."""
        monkeypatch.setenv("GEMINI_PROJECT_ID", "test-project")
        monkeypatch.setenv("GEMINI_LOCATION", "us-east1")
        
        config = GeminiFileSearchConfig.from_env()
        
        assert config.project_id == "test-project"
        assert config.location == "us-east1"
        assert config.use_vertex_ai is True
    
    def test_from_env_with_api_key(self, monkeypatch):
        """Test loading config from env with API key."""
        monkeypatch.setenv("GEMINI_API_KEY", "test-key")
        monkeypatch.setenv("GEMINI_USE_VERTEX_AI", "false")
        
        config = GeminiFileSearchConfig.from_env()
        
        assert config.api_key == "test-key"
        assert config.use_vertex_ai is False
    
    def test_validate_vertex_ai(self):
        """Test validation with Vertex AI."""
        config = GeminiFileSearchConfig(
            project_id="test-project",
            use_vertex_ai=True
        )
        
        assert config.validate() is True
    
    def test_validate_api_key(self):
        """Test validation with API key."""
        config = GeminiFileSearchConfig(
            api_key="test-key",
            use_vertex_ai=False
        )
        
        assert config.validate() is True
    
    def test_validate_fails_missing_project_id(self):
        """Test validation fails without project ID for Vertex AI."""
        config = GeminiFileSearchConfig(
            use_vertex_ai=True
        )
        
        with pytest.raises(ValueError, match="GEMINI_PROJECT_ID"):
            config.validate()
    
    def test_validate_fails_missing_api_key(self):
        """Test validation fails without API key for API key auth."""
        config = GeminiFileSearchConfig(
            use_vertex_ai=False
        )
        
        with pytest.raises(ValueError, match="GEMINI_API_KEY"):
            config.validate()
    
    def test_is_configured(self):
        """Test is_configured property."""
        config1 = GeminiFileSearchConfig(project_id="test", use_vertex_ai=True)
        assert config1.is_configured is True
        
        config2 = GeminiFileSearchConfig(api_key="test-key", use_vertex_ai=False)
        assert config2.is_configured is True
        
        config3 = GeminiFileSearchConfig(use_vertex_ai=True)
        assert config3.is_configured is False

