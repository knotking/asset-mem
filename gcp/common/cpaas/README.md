# CPaaS - Communication Platform as a Service

A comprehensive Twilio integration module for sending and receiving messages via SMS, MMS, Content Templates, and OTT (Over-the-Top) channels like WhatsApp.

## Features

- **SMS** - Send and read text messages
- **MMS** - Send and read multimedia messages with images, videos, audio
- **Content Templates** - Send pre-approved template messages (required for WhatsApp Business API)
- **OTT (Over-the-Top)** - Send messages via WhatsApp, Facebook Messenger, and other channels

## Installation

Install the required dependencies:

```bash
pip install -r requirements.txt
```

Or install individually:

```bash
pip install httpx pydantic google-cloud-secret-manager python-dotenv
```

## Configuration

### Environment Variables

Set the following environment variables:

```bash
# Required
export TWILIO_ACCOUNT_SID="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
export TWILIO_AUTH_TOKEN="your_auth_token_here"

# Optional
export TWILIO_DEFAULT_FROM_NUMBER="+1234567890"
export TWILIO_MESSAGING_SERVICE_SID="MGxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
export TWILIO_WHATSAPP_FROM_NUMBER="+1234567890"
```

### Using .env File

Create a `.env` file in your project root:

```env
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_DEFAULT_FROM_NUMBER=+1234567890
TWILIO_MESSAGING_SERVICE_SID=MGxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_WHATSAPP_FROM_NUMBER=+1234567890
```

Then load it in your code:

```python
from dotenv import load_dotenv
load_dotenv()

from cpaas import TwilioConfig, TwilioClient

config = TwilioConfig.from_env()
```

### Using Google Cloud Secret Manager

For production deployments, store credentials in GCP Secret Manager:

```bash
# Create secrets
gcloud secrets create twilio-account-sid --data-file=-
gcloud secrets create twilio-auth-token --data-file=-
```

Then load in code:

```python
from cpaas import TwilioConfig, TwilioClient

config = TwilioConfig.from_gcp_secret_manager(
    project_id="your-gcp-project-id",
    account_sid_secret="twilio-account-sid",
    auth_token_secret="twilio-auth-token",
)
```

## Usage

### Basic Setup

```python
import asyncio
from cpaas import TwilioClient, TwilioConfig

# Load configuration
config = TwilioConfig.from_env()

# Create client
client = TwilioClient(config)
```

### Sending SMS

```python
from cpaas import SMSMessage

async def send_text_message():
    async with TwilioClient(TwilioConfig.from_env()) as client:
        response = await client.send_sms(
            SMSMessage(
                to="+1234567890",
                body="Hello from CPaaS!",
                from_="+0987654321"  # Optional if default configured
            )
        )
        print(f"Message sent! SID: {response.sid}")
        print(f"Status: {response.status}")

asyncio.run(send_text_message())
```

### Reading SMS Messages

```python
async def read_messages():
    async with TwilioClient(TwilioConfig.from_env()) as client:
        # Get a specific message
        message = await client.read_sms(message_sid="SM...")
        print(f"Message body: {message.body}")
        
        # List messages
        result = await client.read_sms(
            to="+1234567890",
            page_size=20
        )
        for msg in result.messages:
            print(f"{msg.from_} -> {msg.to}: {msg.body}")

asyncio.run(read_messages())
```

### Sending MMS (with Media)

```python
from cpaas import MMSMessage

async def send_picture_message():
    async with TwilioClient(TwilioConfig.from_env()) as client:
        response = await client.send_mms(
            MMSMessage(
                to="+1234567890",
                body="Check out this image!",
                media_urls=[
                    "https://example.com/image.jpg",
                    "https://example.com/video.mp4"
                ]
            )
        )
        print(f"MMS sent! SID: {response.sid}")

asyncio.run(send_picture_message())
```

### Getting Media from MMS

```python
async def get_mms_media():
    async with TwilioClient(TwilioConfig.from_env()) as client:
        media_list = await client.get_message_media("MM...")
        for media in media_list:
            print(f"Media: {media.content_type} - {media.uri}")

asyncio.run(get_mms_media())
```

### Sending Template Messages

Templates are pre-approved message formats required for WhatsApp Business API communications outside the 24-hour messaging window.

```python
from cpaas import TemplateMessage

async def send_template():
    async with TwilioClient(TwilioConfig.from_env()) as client:
        response = await client.send_template(
            TemplateMessage(
                to="whatsapp:+1234567890",
                content_sid="HXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
                content_variables={
                    "1": "John",
                    "2": "Order #12345",
                    "3": "2024-01-15"
                }
            )
        )
        print(f"Template sent! SID: {response.sid}")

asyncio.run(send_template())
```

### Listing Content Templates

```python
async def list_templates():
    async with TwilioClient(TwilioConfig.from_env()) as client:
        templates = await client.list_content_templates()
        for template in templates.contents:
            print(f"{template.sid}: {template.friendly_name}")

asyncio.run(list_templates())
```

### Sending WhatsApp Messages (OTT)

```python
from cpaas import OTTMessage, OTTChannel

async def send_whatsapp():
    async with TwilioClient(TwilioConfig.from_env()) as client:
        # Simple text message
        response = await client.send_ott(
            OTTMessage(
                to="+1234567890",  # Automatically formatted as whatsapp:+1234567890
                channel=OTTChannel.WHATSAPP,
                body="Hello via WhatsApp!"
            )
        )
        print(f"WhatsApp message sent! SID: {response.sid}")

asyncio.run(send_whatsapp())
```

### Sending WhatsApp with Media

```python
from cpaas import OTTMessage, OTTChannel

async def send_whatsapp_media():
    async with TwilioClient(TwilioConfig.from_env()) as client:
        response = await client.send_ott(
            OTTMessage(
                to="+1234567890",
                channel=OTTChannel.WHATSAPP,
                body="Check out this photo!",
                media_urls=["https://example.com/photo.jpg"]
            )
        )
        print(f"WhatsApp media sent! SID: {response.sid}")

asyncio.run(send_whatsapp_media())
```

### Reading WhatsApp Messages (OTT)

```python
from cpaas import OTTChannel

async def read_whatsapp():
    async with TwilioClient(TwilioConfig.from_env()) as client:
        # Read messages from a specific WhatsApp number
        result = await client.read_ott(
            channel=OTTChannel.WHATSAPP,
            from_="+1234567890"  # Will be formatted as whatsapp:+1234567890
        )
        for msg in result.messages:
            print(f"{msg.from_} -> {msg.to}: {msg.body}")

asyncio.run(read_whatsapp())
```

### Message Status & Management

```python
async def manage_messages():
    async with TwilioClient(TwilioConfig.from_env()) as client:
        # Check message status
        status = await client.get_message_status("SM...")
        print(f"Status: {status}")
        
        # Delete a message
        await client.delete_message("SM...")
        
        # Cancel a scheduled message
        await client.cancel_message("SM...")

asyncio.run(manage_messages())
```

## API Reference

### TwilioConfig

Configuration container for Twilio credentials.

| Attribute | Type | Description |
|-----------|------|-------------|
| `account_sid` | str | Twilio Account SID (starts with 'AC') |
| `auth_token` | str | Twilio Auth Token |
| `default_from_number` | str | Default sender phone number |
| `messaging_service_sid` | str | Messaging Service SID for sender pools |
| `whatsapp_from_number` | str | WhatsApp sender number |

### TwilioClient Methods

#### SMS
- `send_sms(message: SMSMessage) -> MessageResponse`
- `read_sms(message_sid?, to?, from_?, date_sent?, ...) -> MessageResponse | MessageListResponse`

#### MMS
- `send_mms(message: MMSMessage) -> MessageResponse`
- `read_mms(message_sid?, ...) -> MessageResponse | MessageListResponse`
- `get_message_media(message_sid: str) -> List[MediaResource]`

#### Templates
- `send_template(message: TemplateMessage) -> MessageResponse`
- `list_content_templates(page_size?) -> ContentTemplateListResponse`
- `get_content_template(content_sid: str) -> ContentTemplate`

#### OTT (WhatsApp, etc.)
- `send_ott(message: OTTMessage) -> MessageResponse`
- `read_ott(message_sid?, channel?, ...) -> MessageResponse | MessageListResponse`

#### Utility
- `get_message_status(message_sid: str) -> MessageStatus`
- `delete_message(message_sid: str) -> bool`
- `cancel_message(message_sid: str) -> MessageResponse`

### Message Models

#### SMSMessage
```python
SMSMessage(
    to: str,                          # Recipient phone (E.164 format)
    body: str,                        # Message text
    from_: str = None,                # Sender phone
    messaging_service_sid: str = None,# Messaging Service SID
    status_callback: str = None,      # Webhook URL
    max_price: float = None,          # Max price in USD
    validity_period: int = None,      # Validity in seconds (1-14400)
)
```

#### MMSMessage
```python
MMSMessage(
    to: str,                          # Recipient phone
    body: str = None,                 # Optional caption
    media_urls: List[str] = [],       # Media URLs (max 10)
    from_: str = None,                # Sender phone
    messaging_service_sid: str = None,# Messaging Service SID
)
```

#### TemplateMessage
```python
TemplateMessage(
    to: str,                          # Recipient (e.g., whatsapp:+1234567890)
    content_sid: str,                 # Template SID (starts with 'HX')
    content_variables: Dict[str, str],# Template variables
    from_: str = None,                # Sender
    messaging_service_sid: str = None,# Messaging Service SID
)
```

#### OTTMessage
```python
OTTMessage(
    to: str,                          # Recipient phone
    channel: OTTChannel,              # WHATSAPP, FACEBOOK_MESSENGER, etc.
    body: str = None,                 # Message text
    media_urls: List[str] = None,     # Media URLs
    content_sid: str = None,          # Template SID
    content_variables: Dict = None,   # Template variables
    from_: str = None,                # Sender
)
```

### Enums

#### MessageStatus
```python
class MessageStatus(str, Enum):
    QUEUED = "queued"
    SENDING = "sending"
    SENT = "sent"
    DELIVERED = "delivered"
    UNDELIVERED = "undelivered"
    FAILED = "failed"
    RECEIVING = "receiving"
    RECEIVED = "received"
    ACCEPTED = "accepted"
    SCHEDULED = "scheduled"
    READ = "read"
    CANCELED = "canceled"
```

#### OTTChannel
```python
class OTTChannel(str, Enum):
    WHATSAPP = "whatsapp"
    FACEBOOK_MESSENGER = "messenger"
    GOOGLE_BUSINESS_MESSAGES = "gbm"
```

## Security Best Practices

### 1. Never Commit Credentials

Add to your `.gitignore`:
```
.env
*.env
```

### 2. Use Secret Manager in Production

```python
# Production
config = TwilioConfig.from_gcp_secret_manager(project_id="your-project")

# Development
config = TwilioConfig.from_env()
```

### 3. Rotate Auth Tokens Regularly

Generate a new Auth Token in the Twilio Console periodically:
1. Go to Twilio Console → Account → API Keys & Tokens
2. Create a new Auth Token
3. Update your secrets/environment variables
4. Delete the old token

### 4. Use Messaging Service SID

For production, use a Messaging Service instead of a direct From number:
- Provides number pooling
- Better delivery optimization
- Compliance features

## Error Handling

```python
from cpaas import TwilioClient, TwilioConfig
from cpaas.twilio_client import TwilioClientError

async def safe_send():
    try:
        async with TwilioClient(TwilioConfig.from_env()) as client:
            response = await client.send_sms(
                SMSMessage(to="+1234567890", body="Hello!")
            )
    except TwilioClientError as e:
        print(f"Twilio error: {e}")
        print(f"Status code: {e.status_code}")
        print(f"Error code: {e.error_code}")
    except Exception as e:
        print(f"Unexpected error: {e}")

asyncio.run(safe_send())
```

## Testing

For testing without making real API calls, you can mock the TwilioClient:

```python
from unittest.mock import AsyncMock, patch

async def test_send_sms():
    with patch('cpaas.twilio_client.httpx.AsyncClient') as mock_client:
        mock_client.return_value.post = AsyncMock(return_value=MockResponse({
            "sid": "SM123",
            "status": "queued",
            "to": "+1234567890",
            "from": "+0987654321",
        }))
        
        client = TwilioClient(TwilioConfig(
            account_sid="ACtest",
            auth_token="test_token"
        ))
        response = await client.send_sms(
            SMSMessage(to="+1234567890", body="Test")
        )
        assert response.sid == "SM123"
```

## Troubleshooting

### Common Issues

**Error: "TWILIO_ACCOUNT_SID is required"**
- Ensure environment variables are set correctly
- Check that `.env` file is being loaded

**Error: "Invalid TWILIO_ACCOUNT_SID format"**
- Account SID must start with "AC"
- Verify you're using the correct credential

**Error: "21408 - Permission to send an SMS has not been enabled"**
- Enable SMS capability in Twilio Console
- Verify the phone number supports SMS

**Error: "21614 - 'To' number is not a valid mobile number"**
- Use E.164 format (+1234567890)
- Verify the number is correct

**WhatsApp messages not delivered**
- Ensure template is approved (for messages outside 24hr window)
- Verify WhatsApp sender number is registered
- Check recipient has WhatsApp

## License

Internal use only.

