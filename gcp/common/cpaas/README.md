# CPaaS - Communication Platform as a Service

A comprehensive multi-provider messaging module for sending and receiving messages via SMS, MMS, Content Templates, and OTT (Over-the-Top) channels like WhatsApp, Viber, and more.

## Supported Providers

- **[Twilio](#twilio)** - Full-featured CPaaS with SMS, MMS, WhatsApp, and more
- **[Infobip](#infobip)** - Global CPaaS with SMS, MMS, WhatsApp, Viber, and RCS

## Project Structure

```
cpaas/
├── __init__.py           # Main exports (backwards compatible)
├── twilio/               # Twilio provider
│   ├── __init__.py
│   ├── client.py         # TwilioClient
│   ├── config.py         # TwilioConfig
│   └── models.py         # Twilio models
├── infobip/              # Infobip provider
│   ├── __init__.py
│   ├── client.py         # InfobipClient
│   ├── config.py         # InfobipConfig
│   └── models.py         # Infobip models
├── tests/
│   ├── twilio/           # Twilio tests
│   └── infobip/          # Infobip tests
├── requirements.txt
└── README.md
```

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

---

# Twilio

## Twilio Configuration

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

from cpaas.twilio import TwilioConfig, TwilioClient

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
from cpaas.twilio import TwilioConfig, TwilioClient

config = TwilioConfig.from_gcp_secret_manager(
    project_id="your-gcp-project-id",
    account_sid_secret="twilio-account-sid",
    auth_token_secret="twilio-auth-token",
)
```

## Twilio Usage

### Basic Setup

```python
import asyncio
from cpaas.twilio import TwilioClient, TwilioConfig

# Load configuration
config = TwilioConfig.from_env()

# Create client
client = TwilioClient(config)
```

### Sending SMS

```python
from cpaas.twilio import SMSMessage

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
from cpaas.twilio import MMSMessage

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

### Sending Template Messages

Templates are pre-approved message formats required for WhatsApp Business API communications outside the 24-hour messaging window.

```python
from cpaas.twilio import TemplateMessage

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

### Sending WhatsApp Messages (OTT)

```python
from cpaas.twilio import OTTMessage, OTTChannel

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

## Twilio API Reference

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
from cpaas.infobip import InfobipConfig, InfobipClient

config = InfobipConfig.from_gcp_secret_manager(
    project_id="your-gcp-project-id",
    api_key_secret="infobip-api-key",
)
```

## Infobip Usage

### Basic Setup

```python
import asyncio
from cpaas.infobip import InfobipClient, InfobipConfig

# Load configuration
config = InfobipConfig.from_env()

# Create client
client = InfobipClient(config)
```

### Sending SMS

```python
from cpaas.infobip import InfobipSMSMessage, InfobipDestination

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

### Sending WhatsApp Messages

#### Text Message

```python
from cpaas.infobip import InfobipWhatsAppTextMessage

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

#### Template Message

```python
from cpaas.infobip import InfobipWhatsAppTemplateMessage

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
from cpaas.infobip import InfobipWhatsAppMediaMessage

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

asyncio.run(send_whatsapp_media())
```

### Sending Viber Messages

```python
from cpaas.infobip import InfobipViberMessage

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

---

## Error Handling

### Twilio

```python
from cpaas.twilio import TwilioClient, TwilioConfig, TwilioClientError, SMSMessage

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

### Infobip

```python
from cpaas.infobip import InfobipClient, InfobipConfig, InfobipClientError

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

---

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
from cpaas.twilio import TwilioConfig
config = TwilioConfig.from_gcp_secret_manager(project_id="your-project")

# Development
config = TwilioConfig.from_env()
```

### 3. Rotate Tokens Regularly

Generate new tokens periodically and update your secrets/environment variables.

---

## Testing

Run tests with pytest:

```bash
cd gcp/common/cpaas
PYTHONPATH=.. python -m pytest tests/ -v
```

---

## License

Internal use only.
