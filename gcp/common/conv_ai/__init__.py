"""
Conv AI - Google Conversational AI Client

Dialogflow CX integration module for communicating with conversational agents.
Supports:
- Text queries to agents
- Event triggering
- Session management
- Intent matching and fulfillment
"""

from .client import DialogflowCXClient, DialogflowCXError
from .models import (
    ConversationRequest,
    ConversationResponse,
    TextInput,
    EventInput,
    AudioInput,
    AudioEncoding,
    QueryParameters,
    ResponseMessage,
    TextResponse,
    IntentMatch,
    PageInfo,
    SessionInfo,
    ResponseType,
    MatchType,
    SentimentAnalysisResult,
    ConversationHistory,
)
from .config import DialogflowCXConfig

__all__ = [
    # Client
    "DialogflowCXClient",
    "DialogflowCXError",
    # Config
    "DialogflowCXConfig",
    # Request Models
    "ConversationRequest",
    "TextInput",
    "EventInput",
    "AudioInput",
    "AudioEncoding",
    "QueryParameters",
    # Response Models
    "ConversationResponse",
    "ResponseMessage",
    "TextResponse",
    "IntentMatch",
    "PageInfo",
    "SessionInfo",
    "ResponseType",
    "MatchType",
    "SentimentAnalysisResult",
    # Utility Models
    "ConversationHistory",
]

