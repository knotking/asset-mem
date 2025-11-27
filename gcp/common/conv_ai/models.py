"""
Pydantic models for Google Conversational AI (Dialogflow CX).

Supports:
- Text queries to agents
- Event triggering
- Audio input/output
- Session management
- Query parameters and contexts
"""

from datetime import datetime
from enum import Enum
from typing import Optional, List, Dict, Any, Union
from pydantic import BaseModel, Field, field_validator
import uuid


class ResponseType(str, Enum):
    """Types of agent responses."""
    TEXT = "text"
    PAYLOAD = "payload"
    AUDIO = "audio"
    END_INTERACTION = "end_interaction"
    PLAY_AUDIO = "play_audio"
    MIXED = "mixed"
    TELEPHONY_TRANSFER = "telephony_transfer"


class MatchType(str, Enum):
    """Intent match types."""
    MATCH_TYPE_UNSPECIFIED = "MATCH_TYPE_UNSPECIFIED"
    INTENT = "INTENT"
    DIRECT_INTENT = "DIRECT_INTENT"
    PARAMETER_FILLING = "PARAMETER_FILLING"
    NO_MATCH = "NO_MATCH"
    NO_INPUT = "NO_INPUT"
    EVENT = "EVENT"
    KNOWLEDGE_CONNECTOR = "KNOWLEDGE_CONNECTOR"
    PLAYBOOK = "PLAYBOOK"


class AudioEncoding(str, Enum):
    """Audio encoding formats."""
    AUDIO_ENCODING_UNSPECIFIED = "AUDIO_ENCODING_UNSPECIFIED"
    AUDIO_ENCODING_LINEAR_16 = "AUDIO_ENCODING_LINEAR_16"
    AUDIO_ENCODING_FLAC = "AUDIO_ENCODING_FLAC"
    AUDIO_ENCODING_MULAW = "AUDIO_ENCODING_MULAW"
    AUDIO_ENCODING_AMR = "AUDIO_ENCODING_AMR"
    AUDIO_ENCODING_AMR_WB = "AUDIO_ENCODING_AMR_WB"
    AUDIO_ENCODING_OGG_OPUS = "AUDIO_ENCODING_OGG_OPUS"
    AUDIO_ENCODING_SPEEX_WITH_HEADER_BYTE = "AUDIO_ENCODING_SPEEX_WITH_HEADER_BYTE"
    AUDIO_ENCODING_MP3 = "AUDIO_ENCODING_MP3"


class SentimentAnalysisResult(BaseModel):
    """Sentiment analysis result from the agent."""
    score: float = Field(default=0.0, description="Sentiment score (-1.0 to 1.0)")
    magnitude: float = Field(default=0.0, description="Sentiment magnitude (0.0 to infinity)")


# ============================================================================
# Request Models (for sending to agent)
# ============================================================================

class TextInput(BaseModel):
    """
    Text input for the conversational agent.
    
    Example:
        text_input = TextInput(text="What's the weather like today?")
    """
    text: str = Field(..., description="User's text message", max_length=256)
    
    @field_validator("text")
    @classmethod
    def validate_text_not_empty(cls, v: str) -> str:
        """Validate text is not empty."""
        if not v or not v.strip():
            raise ValueError("Text input cannot be empty")
        return v


class EventInput(BaseModel):
    """
    Event input for triggering specific agent behaviors.
    
    Example:
        event = EventInput(event="welcome")
    """
    event: str = Field(..., description="Event name to trigger")
    
    @field_validator("event")
    @classmethod
    def validate_event_not_empty(cls, v: str) -> str:
        """Validate event name is not empty."""
        if not v or not v.strip():
            raise ValueError("Event name cannot be empty")
        return v


class AudioInput(BaseModel):
    """
    Audio input for voice-based interactions.
    
    Example:
        audio = AudioInput(
            audio=base64_audio_data,
            encoding=AudioEncoding.AUDIO_ENCODING_LINEAR_16,
            sample_rate_hertz=16000
        )
    """
    audio: bytes = Field(..., description="Audio data bytes")
    encoding: AudioEncoding = Field(
        default=AudioEncoding.AUDIO_ENCODING_LINEAR_16,
        description="Audio encoding format"
    )
    sample_rate_hertz: int = Field(
        default=16000, 
        ge=8000, 
        le=48000,
        description="Audio sample rate"
    )
    single_utterance: bool = Field(
        default=False,
        description="If true, stops listening after first utterance"
    )


class QueryParameters(BaseModel):
    """
    Optional parameters for query customization.
    
    Example:
        params = QueryParameters(
            time_zone="America/Los_Angeles",
            geo_location={"latitude": 37.7749, "longitude": -122.4194},
            parameters={"user_name": "John"}
        )
    """
    time_zone: Optional[str] = Field(None, description="User's timezone")
    geo_location: Optional[Dict[str, float]] = Field(
        None, 
        description="User's location with latitude and longitude"
    )
    parameters: Optional[Dict[str, Any]] = Field(
        None, 
        description="Additional session parameters"
    )
    current_page: Optional[str] = Field(
        None, 
        description="Current page to use (full resource name)"
    )
    disable_webhook: bool = Field(
        False, 
        description="Disable webhook calls for this query"
    )
    analyze_query_text_sentiment: bool = Field(
        False, 
        description="Enable sentiment analysis on the query text"
    )
    webhook_headers: Optional[Dict[str, str]] = Field(
        None,
        description="Custom headers for webhook calls"
    )
    flow_versions: Optional[List[str]] = Field(
        None,
        description="List of flow versions to use"
    )
    channel: Optional[str] = Field(
        None,
        description="The channel to use (e.g., 'facebook', 'slack')"
    )
    session_ttl: Optional[int] = Field(
        None,
        ge=60,
        le=86400,
        description="Session TTL in seconds (60-86400)"
    )


class ConversationRequest(BaseModel):
    """
    Main request model for sending messages to the conversational agent.
    
    Example:
        request = ConversationRequest(
            session_id="user-123-session-456",
            text="Hello, I need help with my order",
            language_code="en",
            query_params=QueryParameters(
                parameters={"order_id": "12345"}
            )
        )
    """
    session_id: Optional[str] = Field(
        None, 
        description="Session ID for conversation continuity. Auto-generated if not provided."
    )
    text: Optional[str] = Field(None, description="Text input message")
    event: Optional[str] = Field(None, description="Event to trigger")
    audio: Optional[AudioInput] = Field(None, description="Audio input")
    language_code: str = Field(default="en", description="Language code (BCP-47)")
    query_params: Optional[QueryParameters] = Field(
        None, 
        description="Additional query parameters"
    )
    
    @field_validator("session_id", mode="before")
    @classmethod
    def generate_session_id(cls, v: Optional[str]) -> str:
        """Generate session ID if not provided."""
        if not v:
            return str(uuid.uuid4())
        return v
    
    def model_post_init(self, __context: Any) -> None:
        """Validate that at least one input type is provided."""
        if not self.text and not self.event and not self.audio:
            raise ValueError("At least one of text, event, or audio must be provided")


# ============================================================================
# Response Models (from agent)
# ============================================================================

class TextResponse(BaseModel):
    """Text response from the agent."""
    text: str = Field(..., description="Agent's text response")
    allow_playback_interruption: bool = Field(
        default=False,
        description="Whether playback can be interrupted"
    )


class AudioResponse(BaseModel):
    """Audio response from the agent."""
    audio: bytes = Field(..., description="Audio data bytes")
    encoding: AudioEncoding = Field(..., description="Audio encoding format")
    sample_rate_hertz: int = Field(..., description="Audio sample rate")


class PayloadResponse(BaseModel):
    """Custom payload response from the agent."""
    payload: Dict[str, Any] = Field(
        default_factory=dict, 
        description="Custom JSON payload"
    )


class ResponseMessage(BaseModel):
    """
    A single response message from the agent.
    
    Can contain text, payload, audio, or other response types.
    """
    text: Optional[TextResponse] = Field(None, description="Text response")
    payload: Optional[Dict[str, Any]] = Field(None, description="Custom payload")
    end_interaction: bool = Field(
        default=False, 
        description="Indicates end of interaction"
    )
    play_audio: Optional[Dict[str, Any]] = Field(
        None, 
        description="Audio to play"
    )
    telephony_transfer_call: Optional[Dict[str, Any]] = Field(
        None,
        description="Telephony transfer information"
    )
    
    @property
    def response_type(self) -> ResponseType:
        """Determine the type of response."""
        if self.text:
            return ResponseType.TEXT
        if self.payload:
            return ResponseType.PAYLOAD
        if self.end_interaction:
            return ResponseType.END_INTERACTION
        if self.play_audio:
            return ResponseType.PLAY_AUDIO
        if self.telephony_transfer_call:
            return ResponseType.TELEPHONY_TRANSFER
        return ResponseType.MIXED


class IntentMatch(BaseModel):
    """Information about the matched intent."""
    intent: Optional[str] = Field(None, description="Matched intent display name")
    intent_name: Optional[str] = Field(None, description="Full intent resource name")
    confidence: float = Field(default=0.0, description="Match confidence (0.0-1.0)")
    match_type: MatchType = Field(
        default=MatchType.MATCH_TYPE_UNSPECIFIED,
        description="Type of match"
    )
    event: Optional[str] = Field(None, description="Matched event name")
    parameters: Dict[str, Any] = Field(
        default_factory=dict,
        description="Extracted parameters"
    )


class PageInfo(BaseModel):
    """Information about the current conversation page."""
    current_page: Optional[str] = Field(None, description="Current page display name")
    current_page_name: Optional[str] = Field(None, description="Full page resource name")
    form_info: Optional[Dict[str, Any]] = Field(None, description="Form filling info")


class SessionInfo(BaseModel):
    """Session information from the response."""
    session: str = Field(..., description="Full session resource name")
    parameters: Dict[str, Any] = Field(
        default_factory=dict,
        description="Session parameters"
    )


class ConversationResponse(BaseModel):
    """
    Response model from the conversational agent.
    
    Contains all response messages, intent match info, and session state.
    """
    session_id: str = Field(..., description="Session ID")
    response_id: str = Field(..., description="Unique response ID")
    messages: List[ResponseMessage] = Field(
        default_factory=list,
        description="List of response messages"
    )
    intent_match: Optional[IntentMatch] = Field(
        None, 
        description="Intent match information"
    )
    page_info: Optional[PageInfo] = Field(
        None, 
        description="Current page information"
    )
    session_info: Optional[SessionInfo] = Field(
        None, 
        description="Session state information"
    )
    sentiment_analysis: Optional[SentimentAnalysisResult] = Field(
        None,
        description="Sentiment analysis result"
    )
    response_type: ResponseType = Field(
        default=ResponseType.TEXT,
        description="Primary response type"
    )
    
    @property
    def text_responses(self) -> List[str]:
        """Get all text responses as a list of strings."""
        texts = []
        for msg in self.messages:
            if msg.text:
                texts.append(msg.text.text)
        return texts
    
    @property
    def combined_text(self) -> str:
        """Get all text responses combined into a single string."""
        return " ".join(self.text_responses)
    
    @property
    def has_payload(self) -> bool:
        """Check if response contains custom payload."""
        return any(msg.payload for msg in self.messages)
    
    @property
    def payloads(self) -> List[Dict[str, Any]]:
        """Get all payload responses."""
        return [msg.payload for msg in self.messages if msg.payload]
    
    @property
    def is_end_interaction(self) -> bool:
        """Check if this response ends the interaction."""
        return any(msg.end_interaction for msg in self.messages)
    
    @property
    def extracted_parameters(self) -> Dict[str, Any]:
        """Get extracted parameters from intent match."""
        if self.intent_match:
            return self.intent_match.parameters
        return {}

    @classmethod
    def from_dialogflow_response(
        cls, 
        response: Any, 
        session_id: str
    ) -> "ConversationResponse":
        """
        Create ConversationResponse from Dialogflow CX API response.
        
        Args:
            response: DetectIntentResponse from Dialogflow CX
            session_id: Session ID used for the request
            
        Returns:
            ConversationResponse: Parsed response
        """
        query_result = response.query_result
        
        # Parse response messages
        messages = []
        for msg in query_result.response_messages:
            response_msg = ResponseMessage()
            
            if msg.text:
                response_msg.text = TextResponse(
                    text=" ".join(msg.text.text),
                    allow_playback_interruption=getattr(
                        msg.text, "allow_playback_interruption", False
                    )
                )
            
            if msg.payload:
                from google.protobuf.json_format import MessageToDict
                response_msg.payload = MessageToDict(msg.payload)
            
            if msg.end_interaction:
                response_msg.end_interaction = True
                
            if msg.play_audio:
                response_msg.play_audio = {"audio_uri": msg.play_audio.audio_uri}
                
            messages.append(response_msg)
        
        # Parse intent match
        intent_match = None
        if query_result.match:
            match = query_result.match
            intent_match = IntentMatch(
                intent=match.intent.display_name if match.intent else None,
                intent_name=match.intent.name if match.intent else None,
                confidence=match.confidence,
                match_type=MatchType(match.match_type.name) if match.match_type else MatchType.MATCH_TYPE_UNSPECIFIED,
                event=match.event if match.event else None,
                parameters={
                    k: _convert_parameter_value(v) 
                    for k, v in query_result.parameters.items()
                } if query_result.parameters else {},
            )
        
        # Parse page info
        page_info = None
        if query_result.current_page:
            page_info = PageInfo(
                current_page=query_result.current_page.display_name,
                current_page_name=query_result.current_page.name,
            )
        
        # Parse sentiment
        sentiment = None
        if query_result.sentiment_analysis_result:
            sentiment = SentimentAnalysisResult(
                score=query_result.sentiment_analysis_result.score,
                magnitude=query_result.sentiment_analysis_result.magnitude,
            )
        
        # Determine primary response type
        response_type = ResponseType.TEXT
        if messages:
            first_msg = messages[0]
            response_type = first_msg.response_type
        
        return cls(
            session_id=session_id,
            response_id=response.response_id,
            messages=messages,
            intent_match=intent_match,
            page_info=page_info,
            sentiment_analysis=sentiment,
            response_type=response_type,
        )


def _convert_parameter_value(value: Any) -> Any:
    """Convert Dialogflow parameter value to Python native type."""
    if hasattr(value, "string_value"):
        return value.string_value
    if hasattr(value, "number_value"):
        return value.number_value
    if hasattr(value, "bool_value"):
        return value.bool_value
    if hasattr(value, "list_value"):
        return [_convert_parameter_value(v) for v in value.list_value.values]
    if hasattr(value, "struct_value"):
        from google.protobuf.json_format import MessageToDict
        return MessageToDict(value.struct_value)
    return str(value)


class ConversationHistory(BaseModel):
    """Model for storing conversation history."""
    session_id: str = Field(..., description="Session ID")
    turns: List[Dict[str, Any]] = Field(
        default_factory=list,
        description="List of conversation turns"
    )
    created_at: datetime = Field(
        default_factory=datetime.utcnow,
        description="Session creation timestamp"
    )
    updated_at: datetime = Field(
        default_factory=datetime.utcnow,
        description="Last update timestamp"
    )
    metadata: Dict[str, Any] = Field(
        default_factory=dict,
        description="Additional session metadata"
    )
    
    def add_turn(
        self, 
        user_input: str, 
        agent_response: ConversationResponse
    ) -> None:
        """Add a conversation turn to history."""
        self.turns.append({
            "timestamp": datetime.utcnow().isoformat(),
            "user_input": user_input,
            "agent_response": agent_response.combined_text,
            "intent": agent_response.intent_match.intent if agent_response.intent_match else None,
            "parameters": agent_response.extracted_parameters,
        })
        self.updated_at = datetime.utcnow()

