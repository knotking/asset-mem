# Conv AI - Google Conversational AI Client

A comprehensive Dialogflow CX integration module for communicating with Google conversational agents.

## Features

- **Text Queries** - Send text messages to agents and receive responses
- **Event Triggering** - Trigger specific events in conversations
- **Session Management** - Manage conversation sessions with auto-generated IDs
- **Intent Matching** - Match intents without affecting session state
- **Agent Inspection** - List flows, intents, and get agent information
- **Async Support** - Full async/await support for high-performance applications

## Installation

Install the required dependencies:

```bash
pip install -r requirements.txt
```

Or install individually:

```bash
pip install google-cloud-dialogflow-cx pydantic google-cloud-secret-manager
```

## Configuration

### Environment Variables

Set the following environment variables:

```bash
# Required
export DIALOGFLOW_PROJECT_ID="your-gcp-project-id"
export DIALOGFLOW_LOCATION="us-central1"
export DIALOGFLOW_AGENT_ID="your-agent-uuid"

# Optional
export DIALOGFLOW_LANGUAGE_CODE="en"
export DIALOGFLOW_ENVIRONMENT_ID="production"
export DIALOGFLOW_TIMEOUT="30"
```

### Using .env File

Create a `.env` file in your project root:

```env
DIALOGFLOW_PROJECT_ID=your-gcp-project-id
DIALOGFLOW_LOCATION=us-central1
DIALOGFLOW_AGENT_ID=your-agent-uuid
DIALOGFLOW_LANGUAGE_CODE=en
DIALOGFLOW_ENVIRONMENT_ID=production
```

Then load it in your code:

```python
from dotenv import load_dotenv
load_dotenv()

from conv_ai import DialogflowCXConfig, DialogflowCXClient

config = DialogflowCXConfig.from_env()
```

### Using Google Cloud Secret Manager

For production deployments, store configuration in GCP Secret Manager:

```bash
# Create secret with JSON config
echo '{"project_id": "...", "location": "...", "agent_id": "..."}' | \
  gcloud secrets create dialogflow-agent-config --data-file=-
```

Then load in code:

```python
from conv_ai import DialogflowCXConfig, DialogflowCXClient

config = DialogflowCXConfig.from_gcp_secret_manager(
    project_id="your-secrets-project-id",
    agent_config_secret="dialogflow-agent-config",
)
```

## Usage

### Basic Setup

```python
import asyncio
from conv_ai import DialogflowCXClient, DialogflowCXConfig

# Load configuration
config = DialogflowCXConfig.from_env()

# Create client
client = DialogflowCXClient(config)
```

### Sending Text Messages

```python
from conv_ai import ConversationRequest

async def chat_with_agent():
    async with DialogflowCXClient(DialogflowCXConfig.from_env()) as client:
        response = await client.send_message(
            ConversationRequest(
                session_id="user-123-session",
                text="Hello, I need help with my order",
            )
        )
        print(f"Agent says: {response.combined_text}")
        print(f"Intent matched: {response.intent_match.intent if response.intent_match else 'None'}")

asyncio.run(chat_with_agent())
```

### Simple Intent Detection

```python
async def simple_query():
    async with DialogflowCXClient(DialogflowCXConfig.from_env()) as client:
        response = await client.detect_intent(
            session_id="user-123",
            text="What's the status of my order #12345?",
        )
        print(f"Response: {response.combined_text}")
        print(f"Extracted parameters: {response.extracted_parameters}")

asyncio.run(simple_query())
```

### Triggering Events

```python
async def start_conversation():
    async with DialogflowCXClient(DialogflowCXConfig.from_env()) as client:
        # Trigger welcome event to start conversation
        response = await client.trigger_event(
            session_id="new-user-session",
            event="welcome",
        )
        print(f"Welcome message: {response.combined_text}")

asyncio.run(start_conversation())
```

### With Query Parameters

```python
from conv_ai import ConversationRequest, QueryParameters

async def query_with_context():
    async with DialogflowCXClient(DialogflowCXConfig.from_env()) as client:
        response = await client.send_message(
            ConversationRequest(
                session_id="user-456",
                text="What's the weather?",
                query_params=QueryParameters(
                    time_zone="America/Los_Angeles",
                    geo_location={"latitude": 37.7749, "longitude": -122.4194},
                    parameters={"user_name": "John", "membership_level": "gold"},
                ),
            )
        )
        print(response.combined_text)

asyncio.run(query_with_context())
```

### Matching Intents Without Session

```python
async def intent_only():
    async with DialogflowCXClient(DialogflowCXConfig.from_env()) as client:
        # Match intent without affecting any session
        response = await client.match_intent("I want to book a flight to Paris")
        
        if response.intent_match:
            print(f"Matched intent: {response.intent_match.intent}")
            print(f"Confidence: {response.intent_match.confidence}")
            print(f"Parameters: {response.intent_match.parameters}")

asyncio.run(intent_only())
```

### Getting Agent Information

```python
async def inspect_agent():
    async with DialogflowCXClient(DialogflowCXConfig.from_env()) as client:
        # Get agent details
        info = await client.get_agent_info()
        print(f"Agent: {info['display_name']}")
        print(f"Languages: {info['supported_language_codes']}")
        
        # List all flows
        flows = await client.list_flows()
        print("\nFlows:")
        for flow in flows:
            print(f"  - {flow['display_name']}")
        
        # List all intents
        intents = await client.list_intents()
        print("\nIntents:")
        for intent in intents:
            print(f"  - {intent['display_name']} (fallback: {intent['is_fallback']})")

asyncio.run(inspect_agent())
```

### Multi-turn Conversation

```python
from conv_ai import ConversationHistory

async def multi_turn_conversation():
    async with DialogflowCXClient(DialogflowCXConfig.from_env()) as client:
        session_id = client.generate_session_id(user_id="user-789")
        history = ConversationHistory(session_id=session_id)
        
        # Turn 1
        response1 = await client.detect_intent(
            session_id=session_id,
            text="I want to order a pizza",
        )
        history.add_turn("I want to order a pizza", response1)
        print(f"Agent: {response1.combined_text}")
        
        # Turn 2
        response2 = await client.detect_intent(
            session_id=session_id,
            text="Large pepperoni",
        )
        history.add_turn("Large pepperoni", response2)
        print(f"Agent: {response2.combined_text}")
        
        # Turn 3
        response3 = await client.detect_intent(
            session_id=session_id,
            text="123 Main Street",
        )
        history.add_turn("123 Main Street", response3)
        print(f"Agent: {response3.combined_text}")
        
        # Check if conversation ended
        if response3.is_end_interaction:
            print("\n--- Conversation ended ---")
        
        # Review history
        print(f"\nTotal turns: {len(history.turns)}")

asyncio.run(multi_turn_conversation())
```

## API Reference

### DialogflowCXConfig

Configuration container for Dialogflow CX agent.

| Attribute | Type | Description |
|-----------|------|-------------|
| `project_id` | str | GCP project ID containing the agent |
| `location` | str | Agent location (e.g., 'us-central1', 'global') |
| `agent_id` | str | Dialogflow CX Agent ID (UUID format) |
| `language_code` | str | Default language code (default: 'en') |
| `environment_id` | str | Optional environment ID |
| `timeout` | float | Request timeout in seconds (default: 30.0) |

### DialogflowCXClient Methods

#### Core Methods
- `send_message(request: ConversationRequest) -> ConversationResponse`
- `detect_intent(session_id, text?, event?, language_code?, parameters?, analyze_sentiment?) -> ConversationResponse`
- `trigger_event(session_id, event, parameters?) -> ConversationResponse`
- `match_intent(text, session_id?) -> ConversationResponse`
- `fulfill_intent(session_id, text, output_audio_config?) -> ConversationResponse`

#### Utility Methods
- `generate_session_id(user_id?) -> str`
- `get_agent_info() -> Dict[str, Any]`
- `list_flows() -> List[Dict]`
- `list_intents() -> List[Dict]`

### Request Models

#### ConversationRequest
```python
ConversationRequest(
    session_id: str = None,        # Auto-generated if not provided
    text: str = None,              # Text message (mutually exclusive with event)
    event: str = None,             # Event to trigger
    audio: AudioInput = None,      # Audio input
    language_code: str = "en",     # Language code
    query_params: QueryParameters = None,  # Additional parameters
)
```

#### QueryParameters
```python
QueryParameters(
    time_zone: str = None,         # User's timezone
    geo_location: Dict = None,     # {"latitude": float, "longitude": float}
    parameters: Dict = None,       # Additional session parameters
    current_page: str = None,      # Force specific page
    disable_webhook: bool = False, # Disable webhooks
    analyze_query_text_sentiment: bool = False,  # Enable sentiment analysis
    webhook_headers: Dict = None,  # Custom webhook headers
    channel: str = None,           # Channel identifier
    session_ttl: int = None,       # Session TTL in seconds
)
```

### Response Models

#### ConversationResponse
```python
response.session_id          # Session ID
response.response_id         # Unique response ID
response.messages            # List[ResponseMessage]
response.intent_match        # IntentMatch or None
response.page_info           # PageInfo or None
response.sentiment_analysis  # SentimentAnalysisResult or None

# Convenience properties
response.text_responses      # List[str] - all text responses
response.combined_text       # str - concatenated text
response.has_payload         # bool - has custom payload
response.payloads            # List[Dict] - all payloads
response.is_end_interaction  # bool - conversation ended
response.extracted_parameters # Dict - parameters from intent match
```

#### IntentMatch
```python
intent_match.intent          # Matched intent display name
intent_match.intent_name     # Full intent resource name
intent_match.confidence      # Match confidence (0.0-1.0)
intent_match.match_type      # MatchType enum
intent_match.event           # Matched event name
intent_match.parameters      # Extracted parameters
```

### Enums

#### MatchType
```python
class MatchType(str, Enum):
    MATCH_TYPE_UNSPECIFIED = "MATCH_TYPE_UNSPECIFIED"
    INTENT = "INTENT"
    DIRECT_INTENT = "DIRECT_INTENT"
    PARAMETER_FILLING = "PARAMETER_FILLING"
    NO_MATCH = "NO_MATCH"
    NO_INPUT = "NO_INPUT"
    EVENT = "EVENT"
    KNOWLEDGE_CONNECTOR = "KNOWLEDGE_CONNECTOR"
    PLAYBOOK = "PLAYBOOK"
```

#### ResponseType
```python
class ResponseType(str, Enum):
    TEXT = "text"
    PAYLOAD = "payload"
    AUDIO = "audio"
    END_INTERACTION = "end_interaction"
    PLAY_AUDIO = "play_audio"
    MIXED = "mixed"
    TELEPHONY_TRANSFER = "telephony_transfer"
```

## Authentication

The client uses Google Cloud Application Default Credentials (ADC). Set up authentication using one of these methods:

### Service Account (Recommended for Production)

```bash
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account-key.json"
```

### User Credentials (Development)

```bash
gcloud auth application-default login
```

### Required IAM Roles

The service account needs these roles:
- `roles/dialogflow.client` - For making detect intent calls
- `roles/dialogflow.reader` - For listing flows/intents (optional)

## Error Handling

```python
from conv_ai import DialogflowCXClient, DialogflowCXConfig
from conv_ai.client import DialogflowCXError

async def safe_query():
    try:
        async with DialogflowCXClient(DialogflowCXConfig.from_env()) as client:
            response = await client.detect_intent(
                session_id="test",
                text="Hello!",
            )
            print(response.combined_text)
    except DialogflowCXError as e:
        print(f"Dialogflow error: {e}")
        print(f"Status code: {e.status_code}")
        print(f"Details: {e.details}")
    except Exception as e:
        print(f"Unexpected error: {e}")

asyncio.run(safe_query())
```

## Testing

Run tests with pytest:

```bash
# Install test dependencies
pip install pytest pytest-asyncio

# Run all tests
pytest

# Run with verbose output
pytest -v

# Run specific test file
pytest tests/test_client.py

# Run specific test class
pytest tests/test_client.py::TestDialogflowCXClientSendMessage
```

## Troubleshooting

### Common Issues

**Error: "DIALOGFLOW_PROJECT_ID is required"**
- Ensure environment variables are set correctly
- Check that `.env` file is being loaded

**Error: "Agent not found"**
- Verify agent_id is correct (UUID format)
- Check location matches where agent is deployed
- Confirm project_id contains the agent

**Error: "Permission denied"**
- Verify service account has `roles/dialogflow.client` role
- Check that GOOGLE_APPLICATION_CREDENTIALS is set correctly
- Ensure the agent exists in the specified project

**Error: "Deadline exceeded"**
- Increase timeout in configuration
- Check network connectivity to Dialogflow API
- Verify agent is deployed and healthy

**Empty responses from agent**
- Check agent has a default start flow
- Verify intents are configured with training phrases
- Test agent in Dialogflow CX Console first

## Best Practices

### 1. Session Management

```python
# Generate consistent session IDs for users
session_id = client.generate_session_id(user_id=user_id)

# Use same session_id for entire conversation
response1 = await client.detect_intent(session_id=session_id, text="...")
response2 = await client.detect_intent(session_id=session_id, text="...")
```

### 2. Environment-Specific Configuration

```python
import os

# Use different agents for different environments
if os.getenv("ENV") == "production":
    config = DialogflowCXConfig.from_gcp_secret_manager(
        project_id="prod-secrets",
        agent_config_secret="dialogflow-prod-config"
    )
else:
    config = DialogflowCXConfig.from_env()
```

### 3. Graceful Shutdown

```python
# Always use context manager for proper cleanup
async with DialogflowCXClient(config) as client:
    # ... your code ...
    pass  # Client is automatically closed
```

### 4. Logging

```python
import logging

# Enable debug logging for troubleshooting
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger("conv_ai")
logger.setLevel(logging.DEBUG)
```

## License

Internal use only.

