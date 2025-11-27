# CPaaS - Communication Platform as a Service

A comprehensive multi-provider messaging module for sending and receiving messages via SMS, MMS, Content Templates, and OTT (Over-the-Top) channels like WhatsApp, Viber, and more.

## Supported Providers

- **[Twilio](#twilio)** - Full-featured CPaaS with SMS, MMS, WhatsApp, and more
- **[Infobip](#infobip)** - Global CPaaS with SMS, MMS, WhatsApp, Viber, and RCS

## Features

- **SMS** - Send and read text messages
- **MMS** - Send and read multimedia messages with images, videos, audio
- **Content Templates** - Send pre-approved template messages (required for WhatsApp Business API)
- **OTT (Over-the-Top)** - Send messages via WhatsApp, Facebook Messenger, Viber, and other channels

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

---

# Infobip

## Infobip Configuration

### Environment Variables

Set the following environment variables for Infobip:

```bash
# Required
export INFOBIP_API_KEY="your_api_key_here"

# Optional
export INFOBIP_BASE_URL="https://api.infobip.com"  # Varies by account region
export INFOBIP_DEFAULT_FROM="MySender"
export INFOBIP_WHATSAPP_SENDER="+1234567890"
export INFOBIP_VIBER_SENDER="ViberService"
```

### Using .env File

```env
INFOBIP_API_KEY=your_api_key_here
INFOBIP_BASE_URL=https://api.infobip.com
INFOBIP_DEFAULT_FROM=MySender
INFOBIP_WHATSAPP_SENDER=+1234567890
INFOBIP_VIBER_SENDER=ViberService
```

### Using Google Cloud Secret Manager

```python
from cpaas import InfobipConfig, InfobipClient

config = InfobipConfig.from_gcp_secret_manager(
    project_id="your-gcp-project-id",
    api_key_secret="infobip-api-key",
)
```

## Infobip Usage

### Basic Setup

```python
import asyncio
from cpaas import InfobipClient, InfobipConfig

# Load configuration
config = InfobipConfig.from_env()

# Create client
client = InfobipClient(config)
```

### Sending SMS

```python
from cpaas import InfobipSMSMessage, InfobipDestination

async def send_text_message():
    async with InfobipClient(InfobipConfig.from_env()) as client:
        response = await client.send_sms(
            InfobipSMSMessage(
                destinations=[InfobipDestination(to="+1234567890")],
                text="Hello from Infobip!",
                from_="MySender"  # Optional if default configured
            )
        )
        print(f"Bulk ID: {response.bulk_id}")
        for msg in response.messages:
            print(f"Message ID: {msg.message_id}, Status: {msg.status.name}")

asyncio.run(send_text_message())
```

### Simplified SMS (Single or Multiple Recipients)

```python
async def send_simple_sms():
    async with InfobipClient(InfobipConfig.from_env()) as client:
        # Single recipient
        response = await client.send_sms_simple("+1234567890", "Hello!")
        
        # Multiple recipients
        response = await client.send_sms_simple(
            ["+1234567890", "+0987654321"],
            "Hello everyone!"
        )
        print(f"Sent to {len(response.messages)} recipients")

asyncio.run(send_simple_sms())
```

### Getting Delivery Reports

```python
async def get_reports():
    async with InfobipClient(InfobipConfig.from_env()) as client:
        reports = await client.get_delivery_reports(bulk_id="BULK-123")
        for report in reports.results:
            print(f"{report.message_id}: {report.status.name}")
            if report.price:
                print(f"  Price: {report.price.price_per_message} {report.price.currency}")

asyncio.run(get_reports())
```

### Sending MMS

```python
from cpaas import InfobipMMSMessage, InfobipMMSContent, InfobipDestination

async def send_mms():
    async with InfobipClient(InfobipConfig.from_env()) as client:
        response = await client.send_mms(
            InfobipMMSMessage(
                destinations=[InfobipDestination(to="+1234567890")],
                text="Check out this image!",
                content=[
                    InfobipMMSContent(
                        content_type="image/jpeg",
                        content_id="image1",
                        content_url="https://example.com/image.jpg"
                    )
                ]
            )
        )
        print(f"MMS sent! Bulk ID: {response.bulk_id}")

asyncio.run(send_mms())
```

### Sending WhatsApp Messages

#### Text Message

```python
from cpaas import InfobipWhatsAppTextMessage

async def send_whatsapp():
    async with InfobipClient(InfobipConfig.from_env()) as client:
        response = await client.send_whatsapp_text(
            InfobipWhatsAppTextMessage(
                to="+1234567890",
                text="Hello via WhatsApp!"
            )
        )
        print(f"WhatsApp sent! Message ID: {response.messages[0].message_id}")

asyncio.run(send_whatsapp())
```

#### Simplified WhatsApp

```python
async def send_whatsapp_simple():
    async with InfobipClient(InfobipConfig.from_env()) as client:
        response = await client.send_whatsapp_simple("+1234567890", "Hello!")
        print(f"Message sent!")

asyncio.run(send_whatsapp_simple())
```

#### Template Message

```python
from cpaas import InfobipWhatsAppTemplateMessage

async def send_whatsapp_template():
    async with InfobipClient(InfobipConfig.from_env()) as client:
        response = await client.send_whatsapp_template(
            InfobipWhatsAppTemplateMessage(
                to="+1234567890",
                template_name="order_confirmation",
                template_data={
                    "body": {
                        "placeholders": ["John", "Order #12345"]
                    }
                },
                language="en"
            )
        )
        print(f"Template sent!")

asyncio.run(send_whatsapp_template())
```

#### Media Message

```python
from cpaas import InfobipWhatsAppMediaMessage

async def send_whatsapp_media():
    async with InfobipClient(InfobipConfig.from_env()) as client:
        # Send image
        response = await client.send_whatsapp_media(
            InfobipWhatsAppMediaMessage(
                to="+1234567890",
                media_type="image",
                media_url="https://example.com/photo.jpg",
                caption="Check out this photo!"
            )
        )
        
        # Send document
        response = await client.send_whatsapp_media(
            InfobipWhatsAppMediaMessage(
                to="+1234567890",
                media_type="document",
                media_url="https://example.com/invoice.pdf",
                filename="invoice.pdf"
            )
        )

asyncio.run(send_whatsapp_media())
```

### Sending Viber Messages

```python
from cpaas import InfobipViberMessage

async def send_viber():
    async with InfobipClient(InfobipConfig.from_env()) as client:
        response = await client.send_viber(
            InfobipViberMessage(
                to="+1234567890",
                text="Hello via Viber!",
                image_url="https://example.com/promo.jpg",
                button_text="Visit Site",
                button_url="https://example.com"
            )
        )
        print(f"Viber sent! Bulk ID: {response.bulk_id}")

asyncio.run(send_viber())
```

#### Simplified Viber

```python
async def send_viber_simple():
    async with InfobipClient(InfobipConfig.from_env()) as client:
        response = await client.send_viber_simple(
            to="+1234567890",
            text="Hello Viber!",
            button_text="Learn More",
            button_url="https://example.com"
        )

asyncio.run(send_viber_simple())
```

### Account Balance

```python
async def check_balance():
    async with InfobipClient(InfobipConfig.from_env()) as client:
        balance = await client.get_account_balance()
        print(f"Balance: {balance['balance']} {balance['currency']}")

asyncio.run(check_balance())
```

## Infobip API Reference

### InfobipConfig

Configuration container for Infobip credentials.

| Attribute | Type | Description |
|-----------|------|-------------|
| `api_key` | str | Infobip API Key |
| `base_url` | str | API base URL (varies by region) |
| `default_from` | str | Default sender ID for SMS |
| `whatsapp_sender` | str | WhatsApp sender number |
| `viber_sender` | str | Viber sender ID |

### InfobipClient Methods

#### SMS
- `send_sms(message: InfobipSMSMessage) -> InfobipSendResponse`
- `send_sms_simple(to: str | List[str], text: str, ...) -> InfobipSendResponse`
- `get_delivery_reports(bulk_id?, message_id?, limit?) -> InfobipDeliveryReportResponse`

#### MMS
- `send_mms(message: InfobipMMSMessage) -> InfobipSendResponse`

#### WhatsApp
- `send_whatsapp_text(message: InfobipWhatsAppTextMessage) -> InfobipSendResponse`
- `send_whatsapp_template(message: InfobipWhatsAppTemplateMessage) -> InfobipSendResponse`
- `send_whatsapp_media(message: InfobipWhatsAppMediaMessage) -> InfobipSendResponse`
- `send_whatsapp_simple(to: str, text: str, ...) -> InfobipSendResponse`

#### Viber
- `send_viber(message: InfobipViberMessage) -> InfobipSendResponse`
- `send_viber_simple(to: str, text: str, ...) -> InfobipSendResponse`

#### Utility
- `get_account_balance() -> Dict`

### Infobip Message Models

#### InfobipSMSMessage
```python
InfobipSMSMessage(
    destinations: List[InfobipDestination],  # Recipients
    text: str,                               # Message text
    from_: str = None,                       # Sender ID
    flash: bool = None,                      # Flash SMS
    transliteration: str = None,             # Transliteration type
    notify_url: str = None,                  # Webhook URL
    validity_period: int = None,             # Validity in minutes
    send_at: str = None,                     # Scheduled send time (ISO 8601)
)
```

#### InfobipWhatsAppTextMessage
```python
InfobipWhatsAppTextMessage(
    to: str,                    # Recipient number
    text: str,                  # Message text
    from_: str = None,          # Sender number
    preview_url: bool = None,   # Enable URL preview
    notify_url: str = None,     # Webhook URL
)
```

#### InfobipWhatsAppTemplateMessage
```python
InfobipWhatsAppTemplateMessage(
    to: str,                          # Recipient number
    template_name: str,               # Template name
    template_data: Dict[str, Any],    # Template variables
    language: str = "en",             # Language code
    from_: str = None,                # Sender number
)
```

#### InfobipWhatsAppMediaMessage
```python
InfobipWhatsAppMediaMessage(
    to: str,                    # Recipient number
    media_type: str,            # image, video, audio, document
    media_url: str,             # Media URL
    caption: str = None,        # Caption (image/video/document)
    filename: str = None,       # Filename (document)
    from_: str = None,          # Sender number
)
```

#### InfobipViberMessage
```python
InfobipViberMessage(
    to: str,                    # Recipient number
    text: str = None,           # Message text
    from_: str = None,          # Sender ID
    image_url: str = None,      # Image URL
    button_text: str = None,    # Button text
    button_url: str = None,     # Button URL
    validity_period: int = None,# Validity in seconds
)
```

## Infobip Error Handling

```python
from cpaas import InfobipClient, InfobipConfig
from cpaas.infobip_client import InfobipClientError

async def safe_send():
    try:
        async with InfobipClient(InfobipConfig.from_env()) as client:
            response = await client.send_sms_simple("+1234567890", "Hello!")
    except InfobipClientError as e:
        print(f"Infobip error: {e}")
        print(f"Status code: {e.status_code}")
        if e.request_error:
            print(f"Error details: {e.request_error}")
    except Exception as e:
        print(f"Unexpected error: {e}")

asyncio.run(safe_send())
```

## Infobip Troubleshooting

### Common Issues

**Error: "INFOBIP_API_KEY is required"**
- Ensure environment variables are set correctly
- Check that `.env` file is being loaded

**Error: "401 Unauthorized"**
- Verify your API key is correct
- Check if the API key has the required permissions

**Error: "Invalid recipient"**
- Use E.164 format for phone numbers (+1234567890)
- Verify the number is correct and active

**WhatsApp messages not delivered**
- Ensure template is approved (for messages outside 24hr window)
- Verify WhatsApp sender number is registered with Infobip
- Check recipient has WhatsApp installed

**Viber messages not delivered**
- Ensure you have a registered Viber Business account
- Verify the recipient has Viber installed

---

## License

Internal use only.

