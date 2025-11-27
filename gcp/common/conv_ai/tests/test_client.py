"""Unit tests for DialogflowCXClient."""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
import uuid

from ..config import DialogflowCXConfig
from ..client import DialogflowCXClient, DialogflowCXError
from ..models import (
    ConversationRequest,
    ConversationResponse,
    QueryParameters,
    AudioInput,
    AudioEncoding,
    ResponseMessage,
    TextResponse,
    IntentMatch,
    MatchType,
)


@pytest.fixture
def config():
    """Create test configuration."""
    return DialogflowCXConfig(
        project_id="test-project-123",
        location="us-central1",
        agent_id="test-agent-abc-123",
        language_code="en",
    )


@pytest.fixture
def config_with_environment():
    """Create test configuration with environment."""
    return DialogflowCXConfig(
        project_id="test-project-123",
        location="us-central1",
        agent_id="test-agent-abc-123",
        language_code="en",
        environment_id="production",
    )


@pytest.fixture
def client(config):
    """Create test client."""
    return DialogflowCXClient(config)


@pytest.fixture
def mock_detect_intent_response():
    """Create mock DetectIntentResponse."""
    mock_response = MagicMock()
    mock_response.response_id = "response-123"
    
    # Mock query result
    query_result = MagicMock()
    
    # Mock response messages
    text_msg = MagicMock()
    text_msg.text.text = ["Hello! How can I help you today?"]
    text_msg.text.allow_playback_interruption = False
    text_msg.payload = None
    text_msg.end_interaction = False
    text_msg.play_audio = None
    
    query_result.response_messages = [text_msg]
    
    # Mock match
    match = MagicMock()
    match.intent.display_name = "Default Welcome Intent"
    match.intent.name = "projects/p/locations/l/agents/a/intents/i"
    match.confidence = 0.95
    match.match_type.name = "INTENT"
    match.event = None
    query_result.match = match
    query_result.parameters = {}
    
    # Mock current page
    query_result.current_page.display_name = "Start Page"
    query_result.current_page.name = "projects/p/locations/l/agents/a/flows/f/pages/p"
    
    # Mock sentiment
    query_result.sentiment_analysis_result = None
    
    mock_response.query_result = query_result
    
    return mock_response


class TestDialogflowCXClientInit:
    """Tests for DialogflowCXClient initialization."""

    def test_client_initialization(self, config):
        """Test client initializes with config."""
        client = DialogflowCXClient(config)
        
        assert client.config == config
        assert client._client is None

    def test_client_stores_config(self, config):
        """Test client stores configuration correctly."""
        client = DialogflowCXClient(config)
        
        assert client.config.project_id == "test-project-123"
        assert client.config.location == "us-central1"
        assert client.config.agent_id == "test-agent-abc-123"


class TestDialogflowCXClientSessionPath:
    """Tests for session path building."""

    def test_build_session_path_without_environment(self, client):
        """Test session path without environment."""
        session_path = client._build_session_path("session-123")
        
        expected = (
            "projects/test-project-123"
            "/locations/us-central1"
            "/agents/test-agent-abc-123"
            "/sessions/session-123"
        )
        assert session_path == expected

    def test_build_session_path_with_environment(self, config_with_environment):
        """Test session path with environment."""
        client = DialogflowCXClient(config_with_environment)
        session_path = client._build_session_path("session-456")
        
        expected = (
            "projects/test-project-123"
            "/locations/us-central1"
            "/agents/test-agent-abc-123"
            "/environments/production"
            "/sessions/session-456"
        )
        assert session_path == expected


class TestDialogflowCXClientQueryInput:
    """Tests for query input building."""

    def test_build_query_input_text(self, client):
        """Test building text query input."""
        with patch("google.cloud.dialogflowcx_v3.QueryInput") as mock_qi:
            with patch("google.cloud.dialogflowcx_v3.TextInput") as mock_ti:
                client._build_query_input(text="Hello", language_code="en")
                
                mock_ti.assert_called_once_with(text="Hello")
                mock_qi.assert_called_once()

    def test_build_query_input_event(self, client):
        """Test building event query input."""
        with patch("google.cloud.dialogflowcx_v3.QueryInput") as mock_qi:
            with patch("google.cloud.dialogflowcx_v3.EventInput") as mock_ei:
                client._build_query_input(event="welcome", language_code="en")
                
                mock_ei.assert_called_once_with(event="welcome")
                mock_qi.assert_called_once()

    def test_build_query_input_requires_input(self, client):
        """Test query input requires at least one input type."""
        with pytest.raises(ValueError) as exc_info:
            client._build_query_input(language_code="en")
        
        assert "at least one of text, event, or audio" in str(exc_info.value)


class TestDialogflowCXClientSendMessage:
    """Tests for send_message method."""

    @pytest.mark.asyncio
    async def test_send_message_text(self, client, mock_detect_intent_response):
        """Test sending text message."""
        with patch.object(client, "_get_client") as mock_get_client:
            mock_sessions_client = MagicMock()
            mock_sessions_client.detect_intent.return_value = mock_detect_intent_response
            mock_get_client.return_value = mock_sessions_client
            
            with patch("asyncio.get_event_loop") as mock_loop:
                mock_loop.return_value.run_in_executor = AsyncMock(
                    return_value=mock_detect_intent_response
                )
                
                request = ConversationRequest(
                    session_id="test-session",
                    text="Hello!",
                )
                
                response = await client.send_message(request)
                
                assert response.session_id == "test-session"
                assert response.response_id == "response-123"

    @pytest.mark.asyncio
    async def test_send_message_with_query_params(self, client, mock_detect_intent_response):
        """Test sending message with query parameters."""
        with patch.object(client, "_get_client") as mock_get_client:
            mock_sessions_client = MagicMock()
            mock_get_client.return_value = mock_sessions_client
            
            with patch("asyncio.get_event_loop") as mock_loop:
                mock_loop.return_value.run_in_executor = AsyncMock(
                    return_value=mock_detect_intent_response
                )
                
                request = ConversationRequest(
                    session_id="test-session",
                    text="What's the weather?",
                    query_params=QueryParameters(
                        time_zone="America/Los_Angeles",
                        parameters={"user_location": "San Francisco"},
                    ),
                )
                
                response = await client.send_message(request)
                
                assert response is not None

    @pytest.mark.asyncio
    async def test_send_message_api_error(self, client):
        """Test handling API errors."""
        with patch.object(client, "_get_client") as mock_get_client:
            mock_sessions_client = MagicMock()
            mock_get_client.return_value = mock_sessions_client
            
            with patch("asyncio.get_event_loop") as mock_loop:
                mock_loop.return_value.run_in_executor = AsyncMock(
                    side_effect=Exception("API Error: Permission denied")
                )
                
                request = ConversationRequest(
                    session_id="test-session",
                    text="Hello!",
                )
                
                with pytest.raises(DialogflowCXError) as exc_info:
                    await client.send_message(request)
                
                assert "Permission denied" in str(exc_info.value)


class TestDialogflowCXClientDetectIntent:
    """Tests for detect_intent method."""

    @pytest.mark.asyncio
    async def test_detect_intent_text(self, client, mock_detect_intent_response):
        """Test detect intent with text."""
        with patch.object(client, "send_message") as mock_send:
            mock_response = ConversationResponse(
                session_id="s1",
                response_id="r1",
                messages=[ResponseMessage(text=TextResponse(text="Hello!"))],
            )
            mock_send.return_value = mock_response
            
            response = await client.detect_intent(
                session_id="session-123",
                text="Hello!",
            )
            
            assert response.session_id == "s1"
            mock_send.assert_called_once()

    @pytest.mark.asyncio
    async def test_detect_intent_event(self, client):
        """Test detect intent with event."""
        with patch.object(client, "send_message") as mock_send:
            mock_response = ConversationResponse(
                session_id="s1",
                response_id="r1",
                messages=[ResponseMessage(text=TextResponse(text="Welcome!"))],
            )
            mock_send.return_value = mock_response
            
            response = await client.detect_intent(
                session_id="session-123",
                event="welcome",
            )
            
            assert response is not None
            call_args = mock_send.call_args[0][0]
            assert call_args.event == "welcome"

    @pytest.mark.asyncio
    async def test_detect_intent_with_parameters(self, client):
        """Test detect intent with parameters."""
        with patch.object(client, "send_message") as mock_send:
            mock_response = ConversationResponse(
                session_id="s1",
                response_id="r1",
                messages=[],
            )
            mock_send.return_value = mock_response
            
            await client.detect_intent(
                session_id="session-123",
                text="Book a flight",
                parameters={"destination": "Paris"},
            )
            
            call_args = mock_send.call_args[0][0]
            assert call_args.query_params is not None
            assert call_args.query_params.parameters["destination"] == "Paris"

    @pytest.mark.asyncio
    async def test_detect_intent_requires_input(self, client):
        """Test detect intent requires text or event."""
        with pytest.raises(ValueError) as exc_info:
            await client.detect_intent(session_id="session-123")
        
        assert "Either text or event must be provided" in str(exc_info.value)


class TestDialogflowCXClientTriggerEvent:
    """Tests for trigger_event method."""

    @pytest.mark.asyncio
    async def test_trigger_event(self, client):
        """Test triggering an event."""
        with patch.object(client, "detect_intent") as mock_detect:
            mock_response = ConversationResponse(
                session_id="s1",
                response_id="r1",
                messages=[ResponseMessage(text=TextResponse(text="Welcome!"))],
            )
            mock_detect.return_value = mock_response
            
            response = await client.trigger_event(
                session_id="session-123",
                event="welcome",
            )
            
            assert response is not None
            mock_detect.assert_called_once_with(
                session_id="session-123",
                event="welcome",
                parameters=None,
            )

    @pytest.mark.asyncio
    async def test_trigger_event_with_params(self, client):
        """Test triggering event with parameters."""
        with patch.object(client, "detect_intent") as mock_detect:
            mock_response = ConversationResponse(
                session_id="s1",
                response_id="r1",
                messages=[],
            )
            mock_detect.return_value = mock_response
            
            await client.trigger_event(
                session_id="session-123",
                event="custom_event",
                parameters={"key": "value"},
            )
            
            mock_detect.assert_called_once_with(
                session_id="session-123",
                event="custom_event",
                parameters={"key": "value"},
            )


class TestDialogflowCXClientMatchIntent:
    """Tests for match_intent method."""

    @pytest.mark.asyncio
    async def test_match_intent(self, client):
        """Test matching intent for text."""
        with patch.object(client, "detect_intent") as mock_detect:
            mock_response = ConversationResponse(
                session_id="temp",
                response_id="r1",
                messages=[],
                intent_match=IntentMatch(
                    intent="book_flight",
                    confidence=0.9,
                    match_type=MatchType.INTENT,
                ),
            )
            mock_detect.return_value = mock_response
            
            response = await client.match_intent("I want to book a flight")
            
            assert response.intent_match.intent == "book_flight"

    @pytest.mark.asyncio
    async def test_match_intent_with_session(self, client):
        """Test matching intent with provided session."""
        with patch.object(client, "detect_intent") as mock_detect:
            mock_response = ConversationResponse(
                session_id="my-session",
                response_id="r1",
                messages=[],
            )
            mock_detect.return_value = mock_response
            
            await client.match_intent(
                text="Test text",
                session_id="my-session",
            )
            
            call_args = mock_detect.call_args
            assert call_args[1]["session_id"] == "my-session"


class TestDialogflowCXClientGenerateSessionId:
    """Tests for generate_session_id method."""

    def test_generate_session_id(self, client):
        """Test generating session ID."""
        session_id = client.generate_session_id()
        
        assert session_id is not None
        assert len(session_id) > 0
        # Should be valid UUID
        uuid.UUID(session_id)

    def test_generate_session_id_with_user(self, client):
        """Test generating session ID with user ID."""
        session_id = client.generate_session_id(user_id="user-123")
        
        assert session_id.startswith("user-123-")


class TestDialogflowCXClientAgentInfo:
    """Tests for get_agent_info method."""

    @pytest.mark.asyncio
    async def test_get_agent_info(self, client):
        """Test getting agent info."""
        mock_agent = MagicMock()
        mock_agent.name = "projects/p/locations/l/agents/a"
        mock_agent.display_name = "Test Agent"
        mock_agent.default_language_code = "en"
        mock_agent.supported_language_codes = ["en", "es", "fr"]
        mock_agent.time_zone = "America/Los_Angeles"
        mock_agent.description = "A test agent"
        mock_agent.speech_to_text_settings = None
        
        with patch("google.cloud.dialogflowcx_v3.AgentsClient") as mock_client_class:
            mock_agents_client = MagicMock()
            mock_client_class.return_value = mock_agents_client
            
            with patch("asyncio.get_event_loop") as mock_loop:
                mock_loop.return_value.run_in_executor = AsyncMock(
                    return_value=mock_agent
                )
                
                info = await client.get_agent_info()
                
                assert info["display_name"] == "Test Agent"
                assert info["default_language_code"] == "en"
                assert "es" in info["supported_language_codes"]

    @pytest.mark.asyncio
    async def test_get_agent_info_error(self, client):
        """Test handling agent info error."""
        with patch("google.cloud.dialogflowcx_v3.AgentsClient") as mock_client_class:
            mock_agents_client = MagicMock()
            mock_client_class.return_value = mock_agents_client
            
            with patch("asyncio.get_event_loop") as mock_loop:
                mock_loop.return_value.run_in_executor = AsyncMock(
                    side_effect=Exception("Agent not found")
                )
                
                with pytest.raises(DialogflowCXError) as exc_info:
                    await client.get_agent_info()
                
                assert "Agent not found" in str(exc_info.value)


class TestDialogflowCXClientListFlows:
    """Tests for list_flows method."""

    @pytest.mark.asyncio
    async def test_list_flows(self, client):
        """Test listing flows."""
        mock_flow1 = MagicMock()
        mock_flow1.name = "projects/p/locations/l/agents/a/flows/f1"
        mock_flow1.display_name = "Default Start Flow"
        mock_flow1.description = "Main conversation flow"
        
        mock_flow2 = MagicMock()
        mock_flow2.name = "projects/p/locations/l/agents/a/flows/f2"
        mock_flow2.display_name = "Support Flow"
        mock_flow2.description = "Customer support flow"
        
        with patch("google.cloud.dialogflowcx_v3.FlowsClient") as mock_client_class:
            mock_flows_client = MagicMock()
            mock_client_class.return_value = mock_flows_client
            
            with patch("asyncio.get_event_loop") as mock_loop:
                mock_loop.return_value.run_in_executor = AsyncMock(
                    return_value=[mock_flow1, mock_flow2]
                )
                
                flows = await client.list_flows()
                
                assert len(flows) == 2
                assert flows[0]["display_name"] == "Default Start Flow"
                assert flows[1]["display_name"] == "Support Flow"


class TestDialogflowCXClientListIntents:
    """Tests for list_intents method."""

    @pytest.mark.asyncio
    async def test_list_intents(self, client):
        """Test listing intents."""
        mock_intent1 = MagicMock()
        mock_intent1.name = "projects/p/locations/l/agents/a/intents/i1"
        mock_intent1.display_name = "Welcome"
        mock_intent1.description = "Welcome intent"
        mock_intent1.priority = 500000
        mock_intent1.is_fallback = False
        mock_intent1.labels = {"category": "greeting"}
        
        mock_intent2 = MagicMock()
        mock_intent2.name = "projects/p/locations/l/agents/a/intents/i2"
        mock_intent2.display_name = "Fallback"
        mock_intent2.description = "Fallback intent"
        mock_intent2.priority = 0
        mock_intent2.is_fallback = True
        mock_intent2.labels = {}
        
        with patch("google.cloud.dialogflowcx_v3.IntentsClient") as mock_client_class:
            mock_intents_client = MagicMock()
            mock_client_class.return_value = mock_intents_client
            
            with patch("asyncio.get_event_loop") as mock_loop:
                mock_loop.return_value.run_in_executor = AsyncMock(
                    return_value=[mock_intent1, mock_intent2]
                )
                
                intents = await client.list_intents()
                
                assert len(intents) == 2
                assert intents[0]["display_name"] == "Welcome"
                assert intents[0]["is_fallback"] is False
                assert intents[1]["is_fallback"] is True


class TestDialogflowCXClientContextManager:
    """Tests for context manager functionality."""

    @pytest.mark.asyncio
    async def test_async_context_manager(self, config):
        """Test client works as async context manager."""
        async with DialogflowCXClient(config) as client:
            assert client.config == config
        
        # Client reference should still exist after exit

    @pytest.mark.asyncio
    async def test_close_method(self, client):
        """Test close method."""
        # Should not raise even if client wasn't initialized
        await client.close()
        
        assert client._client is None


class TestDialogflowCXError:
    """Tests for DialogflowCXError exception."""

    def test_error_basic(self):
        """Test basic error creation."""
        error = DialogflowCXError("Something went wrong")
        
        assert str(error) == "Something went wrong"
        assert error.status_code is None
        assert error.details == {}

    def test_error_with_details(self):
        """Test error with status code and details."""
        error = DialogflowCXError(
            "API Error",
            status_code=403,
            details={"session_id": "s123", "reason": "quota exceeded"}
        )
        
        assert error.status_code == 403
        assert error.details["session_id"] == "s123"
        assert error.details["reason"] == "quota exceeded"

