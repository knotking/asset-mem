"""
Google Conversational AI Client for Dialogflow CX.

Provides async methods for:
- Sending text queries to agents
- Triggering events
- Managing sessions
- Streaming conversations
"""

import logging
from typing import Optional, Dict, Any, AsyncIterator
import uuid

from .config import DialogflowCXConfig
from .models import (
    ConversationRequest,
    ConversationResponse,
    QueryParameters,
    TextInput,
    EventInput,
    AudioInput,
    AudioEncoding,
)

logger = logging.getLogger(__name__)


class DialogflowCXError(Exception):
    """Base exception for Dialogflow CX client errors."""
    def __init__(
        self, 
        message: str, 
        status_code: Optional[int] = None, 
        details: Optional[Dict[str, Any]] = None
    ):
        super().__init__(message)
        self.status_code = status_code
        self.details = details or {}


class DialogflowCXClient:
    """
    Async Dialogflow CX client for conversational AI operations.
    
    Supports text queries, events, audio input, and session management.
    
    Example:
        config = DialogflowCXConfig.from_env()
        client = DialogflowCXClient(config)
        
        # Send text message
        response = await client.send_message(
            ConversationRequest(
                text="Hello, I need help",
                session_id="user-123"
            )
        )
        
        # Or use simple method
        response = await client.detect_intent(
            session_id="user-123",
            text="What's the weather?"
        )
    """
    
    def __init__(self, config: DialogflowCXConfig):
        """
        Initialize Dialogflow CX client.
        
        Args:
            config: DialogflowCXConfig instance with agent settings
        """
        self.config = config
        self._client = None
        self._sessions_client = None
    
    def _get_client(self):
        """Get or create the Sessions client."""
        if self._client is None:
            from google.cloud.dialogflowcx_v3 import SessionsClient
            from google.api_core.client_options import ClientOptions
            
            # Configure client options with regional endpoint
            client_options = ClientOptions(
                api_endpoint=self.config.api_endpoint
            )
            
            self._client = SessionsClient(client_options=client_options)
        
        return self._client
    
    async def close(self):
        """Close the client connection."""
        if self._client:
            # SessionsClient doesn't require explicit closing
            # but we reset the reference
            self._client = None
    
    async def __aenter__(self):
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.close()
    
    def _build_session_path(self, session_id: str) -> str:
        """
        Build the full session path.
        
        Args:
            session_id: Session ID
            
        Returns:
            Full session resource path
        """
        if self.config.environment_id:
            return (
                f"projects/{self.config.project_id}"
                f"/locations/{self.config.location}"
                f"/agents/{self.config.agent_id}"
                f"/environments/{self.config.environment_id}"
                f"/sessions/{session_id}"
            )
        return (
            f"projects/{self.config.project_id}"
            f"/locations/{self.config.location}"
            f"/agents/{self.config.agent_id}"
            f"/sessions/{session_id}"
        )
    
    def _build_query_input(
        self,
        text: Optional[str] = None,
        event: Optional[str] = None,
        audio: Optional[AudioInput] = None,
        language_code: Optional[str] = None,
    ):
        """Build QueryInput from the provided inputs."""
        from google.cloud.dialogflowcx_v3 import QueryInput, TextInput as DFTextInput
        from google.cloud.dialogflowcx_v3 import EventInput as DFEventInput
        from google.cloud.dialogflowcx_v3 import AudioInput as DFAudioInput
        from google.cloud.dialogflowcx_v3 import InputAudioConfig
        
        lang = language_code or self.config.language_code
        
        if text:
            return QueryInput(
                text=DFTextInput(text=text),
                language_code=lang,
            )
        elif event:
            return QueryInput(
                event=DFEventInput(event=event),
                language_code=lang,
            )
        elif audio:
            audio_config = InputAudioConfig(
                audio_encoding=audio.encoding.value,
                sample_rate_hertz=audio.sample_rate_hertz,
                single_utterance=audio.single_utterance,
            )
            return QueryInput(
                audio=DFAudioInput(
                    config=audio_config,
                    audio=audio.audio,
                ),
                language_code=lang,
            )
        
        raise ValueError("At least one of text, event, or audio must be provided")
    
    def _build_query_params(self, params: Optional[QueryParameters]):
        """Build QueryParameters from the model."""
        if not params:
            return None
        
        from google.cloud.dialogflowcx_v3 import QueryParameters as DFQueryParams
        from google.protobuf import struct_pb2
        
        df_params = DFQueryParams()
        
        if params.time_zone:
            df_params.time_zone = params.time_zone
        
        if params.geo_location:
            from google.type import latlng_pb2
            df_params.geo_location = latlng_pb2.LatLng(
                latitude=params.geo_location.get("latitude", 0),
                longitude=params.geo_location.get("longitude", 0),
            )
        
        if params.parameters:
            struct = struct_pb2.Struct()
            struct.update(params.parameters)
            df_params.parameters = struct
        
        if params.current_page:
            df_params.current_page = params.current_page
        
        if params.disable_webhook:
            df_params.disable_webhook = params.disable_webhook
        
        if params.analyze_query_text_sentiment:
            df_params.analyze_query_text_sentiment = params.analyze_query_text_sentiment
        
        if params.webhook_headers:
            df_params.webhook_headers.update(params.webhook_headers)
        
        if params.flow_versions:
            df_params.flow_versions.extend(params.flow_versions)
        
        if params.channel:
            df_params.channel = params.channel
        
        if params.session_ttl:
            from google.protobuf import duration_pb2
            df_params.session_ttl = duration_pb2.Duration(seconds=params.session_ttl)
        
        return df_params
    
    async def send_message(
        self, 
        request: ConversationRequest
    ) -> ConversationResponse:
        """
        Send a message to the conversational agent.
        
        Args:
            request: ConversationRequest with text, event, or audio input
            
        Returns:
            ConversationResponse with agent's reply
            
        Example:
            response = await client.send_message(
                ConversationRequest(
                    session_id="user-123",
                    text="Hello!",
                    query_params=QueryParameters(
                        parameters={"user_name": "John"}
                    )
                )
            )
            print(response.combined_text)
        """
        from google.cloud.dialogflowcx_v3 import DetectIntentRequest
        
        client = self._get_client()
        session_id = request.session_id or str(uuid.uuid4())
        session_path = self._build_session_path(session_id)
        
        # Build query input
        query_input = self._build_query_input(
            text=request.text,
            event=request.event,
            audio=request.audio,
            language_code=request.language_code,
        )
        
        # Build query parameters
        query_params = self._build_query_params(request.query_params)
        
        # Create request
        detect_intent_request = DetectIntentRequest(
            session=session_path,
            query_input=query_input,
        )
        
        if query_params:
            detect_intent_request.query_params = query_params
        
        try:
            logger.info(f"Sending message to agent. Session: {session_id}")
            
            # Make the API call (sync call wrapped for async compatibility)
            import asyncio
            response = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: client.detect_intent(request=detect_intent_request)
            )
            
            logger.info(f"Received response. Response ID: {response.response_id}")
            
            return ConversationResponse.from_dialogflow_response(response, session_id)
            
        except Exception as e:
            logger.error(f"Dialogflow CX API error: {e}")
            raise DialogflowCXError(
                message=str(e),
                details={"session_id": session_id}
            )
    
    async def detect_intent(
        self,
        session_id: str,
        text: Optional[str] = None,
        event: Optional[str] = None,
        language_code: Optional[str] = None,
        parameters: Optional[Dict[str, Any]] = None,
        analyze_sentiment: bool = False,
    ) -> ConversationResponse:
        """
        Simplified method to detect intent from text or event.
        
        Args:
            session_id: Session ID for conversation continuity
            text: Text input (mutually exclusive with event)
            event: Event to trigger (mutually exclusive with text)
            language_code: Language code (uses config default if not provided)
            parameters: Additional session parameters
            analyze_sentiment: Whether to analyze sentiment
            
        Returns:
            ConversationResponse with agent's reply
            
        Example:
            # Text query
            response = await client.detect_intent(
                session_id="user-123",
                text="What's the weather like?"
            )
            
            # Trigger event
            response = await client.detect_intent(
                session_id="user-123",
                event="welcome"
            )
        """
        if not text and not event:
            raise ValueError("Either text or event must be provided")
        
        query_params = None
        if parameters or analyze_sentiment:
            query_params = QueryParameters(
                parameters=parameters,
                analyze_query_text_sentiment=analyze_sentiment,
            )
        
        request = ConversationRequest(
            session_id=session_id,
            text=text,
            event=event,
            language_code=language_code or self.config.language_code,
            query_params=query_params,
        )
        
        return await self.send_message(request)
    
    async def trigger_event(
        self,
        session_id: str,
        event: str,
        parameters: Optional[Dict[str, Any]] = None,
    ) -> ConversationResponse:
        """
        Trigger a specific event in the conversation.
        
        Args:
            session_id: Session ID
            event: Event name to trigger (e.g., 'welcome', 'end_session')
            parameters: Optional parameters to pass with the event
            
        Returns:
            ConversationResponse with agent's reply
            
        Example:
            # Start conversation with welcome event
            response = await client.trigger_event(
                session_id="user-123",
                event="welcome"
            )
        """
        return await self.detect_intent(
            session_id=session_id,
            event=event,
            parameters=parameters,
        )
    
    async def match_intent(
        self,
        text: str,
        session_id: Optional[str] = None,
    ) -> ConversationResponse:
        """
        Match intent for a given text without affecting session state.
        
        Creates a temporary session if session_id is not provided.
        
        Args:
            text: Text to match intent for
            session_id: Optional session ID
            
        Returns:
            ConversationResponse with intent match information
            
        Example:
            response = await client.match_intent("I want to book a flight")
            print(f"Matched intent: {response.intent_match.intent}")
        """
        temp_session = session_id or f"match-{uuid.uuid4()}"
        
        return await self.detect_intent(
            session_id=temp_session,
            text=text,
        )
    
    async def fulfill_intent(
        self,
        session_id: str,
        text: str,
        output_audio_config: Optional[Dict[str, Any]] = None,
    ) -> ConversationResponse:
        """
        Send text and get fulfillment response.
        
        Args:
            session_id: Session ID
            text: User's text input
            output_audio_config: Optional audio output configuration
            
        Returns:
            ConversationResponse with agent's fulfillment
        """
        return await self.detect_intent(
            session_id=session_id,
            text=text,
        )
    
    def generate_session_id(self, user_id: Optional[str] = None) -> str:
        """
        Generate a new session ID.
        
        Args:
            user_id: Optional user ID to include in session
            
        Returns:
            New session ID string
        """
        if user_id:
            return f"{user_id}-{uuid.uuid4()}"
        return str(uuid.uuid4())
    
    async def get_agent_info(self) -> Dict[str, Any]:
        """
        Get information about the configured agent.
        
        Returns:
            Dict with agent information
        """
        from google.cloud.dialogflowcx_v3 import AgentsClient
        from google.api_core.client_options import ClientOptions
        
        client_options = ClientOptions(
            api_endpoint=self.config.api_endpoint
        )
        
        agents_client = AgentsClient(client_options=client_options)
        
        try:
            import asyncio
            agent = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: agents_client.get_agent(name=self.config.agent_path)
            )
            
            return {
                "name": agent.name,
                "display_name": agent.display_name,
                "default_language_code": agent.default_language_code,
                "supported_language_codes": list(agent.supported_language_codes),
                "time_zone": agent.time_zone,
                "description": agent.description,
                "enable_speech_adaptation": agent.speech_to_text_settings.enable_speech_adaptation if agent.speech_to_text_settings else False,
            }
        except Exception as e:
            logger.error(f"Failed to get agent info: {e}")
            raise DialogflowCXError(
                message=f"Failed to get agent info: {e}",
                details={"agent_path": self.config.agent_path}
            )
    
    async def list_flows(self) -> list:
        """
        List all flows in the agent.
        
        Returns:
            List of flow information dicts
        """
        from google.cloud.dialogflowcx_v3 import FlowsClient
        from google.api_core.client_options import ClientOptions
        
        client_options = ClientOptions(
            api_endpoint=self.config.api_endpoint
        )
        
        flows_client = FlowsClient(client_options=client_options)
        
        try:
            import asyncio
            flows = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: list(flows_client.list_flows(parent=self.config.agent_path))
            )
            
            return [
                {
                    "name": flow.name,
                    "display_name": flow.display_name,
                    "description": flow.description,
                }
                for flow in flows
            ]
        except Exception as e:
            logger.error(f"Failed to list flows: {e}")
            raise DialogflowCXError(
                message=f"Failed to list flows: {e}",
                details={"agent_path": self.config.agent_path}
            )
    
    async def list_intents(self) -> list:
        """
        List all intents in the agent.
        
        Returns:
            List of intent information dicts
        """
        from google.cloud.dialogflowcx_v3 import IntentsClient
        from google.api_core.client_options import ClientOptions
        
        client_options = ClientOptions(
            api_endpoint=self.config.api_endpoint
        )
        
        intents_client = IntentsClient(client_options=client_options)
        
        try:
            import asyncio
            intents = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: list(intents_client.list_intents(parent=self.config.agent_path))
            )
            
            return [
                {
                    "name": intent.name,
                    "display_name": intent.display_name,
                    "description": intent.description,
                    "priority": intent.priority,
                    "is_fallback": intent.is_fallback,
                    "labels": dict(intent.labels),
                }
                for intent in intents
            ]
        except Exception as e:
            logger.error(f"Failed to list intents: {e}")
            raise DialogflowCXError(
                message=f"Failed to list intents: {e}",
                details={"agent_path": self.config.agent_path}
            )

