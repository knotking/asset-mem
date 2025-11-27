"""Unit tests for Conv AI models."""

import pytest
from datetime import datetime
import uuid

from ..models import (
    TextInput,
    EventInput,
    AudioInput,
    AudioEncoding,
    QueryParameters,
    ConversationRequest,
    TextResponse,
    ResponseMessage,
    IntentMatch,
    PageInfo,
    SessionInfo,
    ConversationResponse,
    ConversationHistory,
    ResponseType,
    MatchType,
    SentimentAnalysisResult,
)


class TestTextInput:
    """Tests for TextInput model."""

    def test_valid_text_input(self):
        """Test creating valid text input."""
        text_input = TextInput(text="Hello, how are you?")
        
        assert text_input.text == "Hello, how are you?"

    def test_empty_text_raises_error(self):
        """Test empty text raises validation error."""
        with pytest.raises(ValueError) as exc_info:
            TextInput(text="")
        
        assert "cannot be empty" in str(exc_info.value)

    def test_whitespace_only_raises_error(self):
        """Test whitespace-only text raises validation error."""
        with pytest.raises(ValueError) as exc_info:
            TextInput(text="   ")
        
        assert "cannot be empty" in str(exc_info.value)


class TestEventInput:
    """Tests for EventInput model."""

    def test_valid_event_input(self):
        """Test creating valid event input."""
        event_input = EventInput(event="welcome")
        
        assert event_input.event == "welcome"

    def test_empty_event_raises_error(self):
        """Test empty event raises validation error."""
        with pytest.raises(ValueError) as exc_info:
            EventInput(event="")
        
        assert "cannot be empty" in str(exc_info.value)


class TestAudioInput:
    """Tests for AudioInput model."""

    def test_valid_audio_input(self):
        """Test creating valid audio input."""
        audio_input = AudioInput(
            audio=b"audio_data",
            encoding=AudioEncoding.AUDIO_ENCODING_LINEAR_16,
            sample_rate_hertz=16000,
        )
        
        assert audio_input.audio == b"audio_data"
        assert audio_input.encoding == AudioEncoding.AUDIO_ENCODING_LINEAR_16
        assert audio_input.sample_rate_hertz == 16000

    def test_default_values(self):
        """Test audio input default values."""
        audio_input = AudioInput(audio=b"data")
        
        assert audio_input.encoding == AudioEncoding.AUDIO_ENCODING_LINEAR_16
        assert audio_input.sample_rate_hertz == 16000
        assert audio_input.single_utterance is False


class TestQueryParameters:
    """Tests for QueryParameters model."""

    def test_minimal_query_params(self):
        """Test creating minimal query parameters."""
        params = QueryParameters()
        
        assert params.time_zone is None
        assert params.geo_location is None
        assert params.parameters is None
        assert params.disable_webhook is False

    def test_full_query_params(self):
        """Test creating fully specified query parameters."""
        params = QueryParameters(
            time_zone="America/Los_Angeles",
            geo_location={"latitude": 37.7749, "longitude": -122.4194},
            parameters={"user_id": "123", "role": "admin"},
            current_page="projects/p/locations/l/agents/a/flows/f/pages/p",
            disable_webhook=True,
            analyze_query_text_sentiment=True,
            webhook_headers={"X-Custom": "value"},
            channel="web",
            session_ttl=3600,
        )
        
        assert params.time_zone == "America/Los_Angeles"
        assert params.geo_location["latitude"] == 37.7749
        assert params.parameters["user_id"] == "123"
        assert params.disable_webhook is True
        assert params.analyze_query_text_sentiment is True
        assert params.session_ttl == 3600


class TestConversationRequest:
    """Tests for ConversationRequest model."""

    def test_text_request(self):
        """Test creating text conversation request."""
        request = ConversationRequest(
            session_id="session-123",
            text="Hello!",
            language_code="en",
        )
        
        assert request.session_id == "session-123"
        assert request.text == "Hello!"
        assert request.language_code == "en"

    def test_event_request(self):
        """Test creating event conversation request."""
        request = ConversationRequest(
            session_id="session-456",
            event="welcome",
        )
        
        assert request.event == "welcome"

    def test_auto_generate_session_id(self):
        """Test session ID is auto-generated if not provided."""
        request = ConversationRequest(text="Test")
        
        assert request.session_id is not None
        assert len(request.session_id) > 0
        # Should be valid UUID format
        uuid.UUID(request.session_id)

    def test_request_with_query_params(self):
        """Test request with query parameters."""
        request = ConversationRequest(
            text="Test",
            query_params=QueryParameters(
                parameters={"key": "value"}
            ),
        )
        
        assert request.query_params is not None
        assert request.query_params.parameters["key"] == "value"

    def test_request_requires_input(self):
        """Test request requires at least one input type."""
        with pytest.raises(ValueError) as exc_info:
            ConversationRequest(session_id="test")
        
        assert "at least one of text, event, or audio" in str(exc_info.value)


class TestTextResponse:
    """Tests for TextResponse model."""

    def test_basic_text_response(self):
        """Test creating text response."""
        response = TextResponse(text="Hello! How can I help?")
        
        assert response.text == "Hello! How can I help?"
        assert response.allow_playback_interruption is False

    def test_text_response_with_interruption(self):
        """Test text response with playback interruption enabled."""
        response = TextResponse(
            text="Please listen carefully.",
            allow_playback_interruption=True,
        )
        
        assert response.allow_playback_interruption is True


class TestResponseMessage:
    """Tests for ResponseMessage model."""

    def test_text_message(self):
        """Test text response message."""
        msg = ResponseMessage(
            text=TextResponse(text="Hello!")
        )
        
        assert msg.response_type == ResponseType.TEXT
        assert msg.text.text == "Hello!"

    def test_payload_message(self):
        """Test payload response message."""
        msg = ResponseMessage(
            payload={"custom": "data", "action": "redirect"}
        )
        
        assert msg.response_type == ResponseType.PAYLOAD
        assert msg.payload["action"] == "redirect"

    def test_end_interaction_message(self):
        """Test end interaction message."""
        msg = ResponseMessage(end_interaction=True)
        
        assert msg.response_type == ResponseType.END_INTERACTION
        assert msg.end_interaction is True


class TestIntentMatch:
    """Tests for IntentMatch model."""

    def test_basic_intent_match(self):
        """Test basic intent match."""
        match = IntentMatch(
            intent="booking_flight",
            confidence=0.95,
            match_type=MatchType.INTENT,
        )
        
        assert match.intent == "booking_flight"
        assert match.confidence == 0.95
        assert match.match_type == MatchType.INTENT

    def test_intent_match_with_parameters(self):
        """Test intent match with extracted parameters."""
        match = IntentMatch(
            intent="book_hotel",
            confidence=0.88,
            match_type=MatchType.INTENT,
            parameters={
                "city": "Paris",
                "check_in_date": "2024-03-15",
                "nights": 3,
            },
        )
        
        assert match.parameters["city"] == "Paris"
        assert match.parameters["nights"] == 3

    def test_event_match(self):
        """Test event match."""
        match = IntentMatch(
            event="welcome",
            match_type=MatchType.EVENT,
        )
        
        assert match.event == "welcome"
        assert match.match_type == MatchType.EVENT


class TestPageInfo:
    """Tests for PageInfo model."""

    def test_page_info(self):
        """Test page info."""
        page = PageInfo(
            current_page="Start Page",
            current_page_name="projects/p/locations/l/agents/a/flows/f/pages/start",
        )
        
        assert page.current_page == "Start Page"
        assert "pages/start" in page.current_page_name


class TestSessionInfo:
    """Tests for SessionInfo model."""

    def test_session_info(self):
        """Test session info."""
        session = SessionInfo(
            session="projects/p/locations/l/agents/a/sessions/s123",
            parameters={"user_authenticated": True},
        )
        
        assert "sessions/s123" in session.session
        assert session.parameters["user_authenticated"] is True


class TestConversationResponse:
    """Tests for ConversationResponse model."""

    def test_basic_response(self):
        """Test basic conversation response."""
        response = ConversationResponse(
            session_id="session-123",
            response_id="resp-456",
            messages=[
                ResponseMessage(text=TextResponse(text="Hello!")),
                ResponseMessage(text=TextResponse(text="How can I help?")),
            ],
        )
        
        assert response.session_id == "session-123"
        assert response.response_id == "resp-456"
        assert len(response.messages) == 2

    def test_text_responses_property(self):
        """Test text_responses property."""
        response = ConversationResponse(
            session_id="s1",
            response_id="r1",
            messages=[
                ResponseMessage(text=TextResponse(text="Hello!")),
                ResponseMessage(payload={"action": "show_menu"}),
                ResponseMessage(text=TextResponse(text="What would you like?")),
            ],
        )
        
        texts = response.text_responses
        assert len(texts) == 2
        assert texts[0] == "Hello!"
        assert texts[1] == "What would you like?"

    def test_combined_text_property(self):
        """Test combined_text property."""
        response = ConversationResponse(
            session_id="s1",
            response_id="r1",
            messages=[
                ResponseMessage(text=TextResponse(text="Hello!")),
                ResponseMessage(text=TextResponse(text="How are you?")),
            ],
        )
        
        assert response.combined_text == "Hello! How are you?"

    def test_has_payload_property(self):
        """Test has_payload property."""
        response_with_payload = ConversationResponse(
            session_id="s1",
            response_id="r1",
            messages=[ResponseMessage(payload={"data": "value"})],
        )
        
        response_without_payload = ConversationResponse(
            session_id="s2",
            response_id="r2",
            messages=[ResponseMessage(text=TextResponse(text="Hi"))],
        )
        
        assert response_with_payload.has_payload is True
        assert response_without_payload.has_payload is False

    def test_payloads_property(self):
        """Test payloads property."""
        response = ConversationResponse(
            session_id="s1",
            response_id="r1",
            messages=[
                ResponseMessage(text=TextResponse(text="Hello")),
                ResponseMessage(payload={"action": "show_list"}),
                ResponseMessage(payload={"data": [1, 2, 3]}),
            ],
        )
        
        payloads = response.payloads
        assert len(payloads) == 2
        assert payloads[0]["action"] == "show_list"
        assert payloads[1]["data"] == [1, 2, 3]

    def test_is_end_interaction_property(self):
        """Test is_end_interaction property."""
        response_ended = ConversationResponse(
            session_id="s1",
            response_id="r1",
            messages=[
                ResponseMessage(text=TextResponse(text="Goodbye!")),
                ResponseMessage(end_interaction=True),
            ],
        )
        
        response_ongoing = ConversationResponse(
            session_id="s2",
            response_id="r2",
            messages=[ResponseMessage(text=TextResponse(text="Continue..."))],
        )
        
        assert response_ended.is_end_interaction is True
        assert response_ongoing.is_end_interaction is False

    def test_extracted_parameters_property(self):
        """Test extracted_parameters property."""
        response = ConversationResponse(
            session_id="s1",
            response_id="r1",
            messages=[],
            intent_match=IntentMatch(
                intent="order_food",
                confidence=0.9,
                match_type=MatchType.INTENT,
                parameters={"food": "pizza", "quantity": 2},
            ),
        )
        
        params = response.extracted_parameters
        assert params["food"] == "pizza"
        assert params["quantity"] == 2

    def test_extracted_parameters_without_match(self):
        """Test extracted_parameters without intent match."""
        response = ConversationResponse(
            session_id="s1",
            response_id="r1",
            messages=[],
        )
        
        assert response.extracted_parameters == {}


class TestSentimentAnalysisResult:
    """Tests for SentimentAnalysisResult model."""

    def test_sentiment_positive(self):
        """Test positive sentiment result."""
        sentiment = SentimentAnalysisResult(score=0.8, magnitude=0.9)
        
        assert sentiment.score == 0.8
        assert sentiment.magnitude == 0.9

    def test_sentiment_negative(self):
        """Test negative sentiment result."""
        sentiment = SentimentAnalysisResult(score=-0.7, magnitude=0.6)
        
        assert sentiment.score == -0.7

    def test_sentiment_defaults(self):
        """Test sentiment defaults."""
        sentiment = SentimentAnalysisResult()
        
        assert sentiment.score == 0.0
        assert sentiment.magnitude == 0.0


class TestConversationHistory:
    """Tests for ConversationHistory model."""

    def test_create_history(self):
        """Test creating conversation history."""
        history = ConversationHistory(
            session_id="session-123",
            metadata={"user_id": "user-456"},
        )
        
        assert history.session_id == "session-123"
        assert len(history.turns) == 0
        assert history.metadata["user_id"] == "user-456"

    def test_add_turn(self):
        """Test adding turns to history."""
        history = ConversationHistory(session_id="s1")
        
        response = ConversationResponse(
            session_id="s1",
            response_id="r1",
            messages=[ResponseMessage(text=TextResponse(text="Hi there!"))],
            intent_match=IntentMatch(
                intent="greeting",
                confidence=0.95,
                match_type=MatchType.INTENT,
            ),
        )
        
        history.add_turn("Hello", response)
        
        assert len(history.turns) == 1
        assert history.turns[0]["user_input"] == "Hello"
        assert history.turns[0]["agent_response"] == "Hi there!"
        assert history.turns[0]["intent"] == "greeting"

    def test_multiple_turns(self):
        """Test adding multiple turns."""
        history = ConversationHistory(session_id="s1")
        
        for i in range(3):
            response = ConversationResponse(
                session_id="s1",
                response_id=f"r{i}",
                messages=[ResponseMessage(text=TextResponse(text=f"Response {i}"))],
            )
            history.add_turn(f"Message {i}", response)
        
        assert len(history.turns) == 3
        assert history.turns[2]["user_input"] == "Message 2"

