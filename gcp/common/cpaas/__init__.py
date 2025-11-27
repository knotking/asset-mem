"""
CPaaS - Communication Platform as a Service

Multi-provider messaging module for sending and receiving messages via:
- SMS (Short Message Service)
- MMS (Multimedia Messaging Service)
- Content Templates (Pre-approved message templates)
- OTT (Over-the-Top messaging: WhatsApp, Facebook Messenger, Viber, etc.)

Supported Providers:
- Twilio
- Infobip
"""

# Twilio imports
from .twilio_client import TwilioClient, TwilioClientError
from .config import TwilioConfig, InfobipConfig

# Twilio models
from .models import (
    # Twilio request models
    SMSMessage,
    MMSMessage,
    TemplateMessage,
    OTTMessage,
    # Twilio response models
    MessageResponse,
    MessageListResponse,
    MediaResource,
    ContentTemplate,
    ContentTemplateListResponse,
    # Twilio enums
    MessageStatus,
    MessageDirection,
    OTTChannel,
)

# Infobip imports
from .infobip_client import InfobipClient, InfobipClientError

# Infobip models
from .models import (
    # Infobip request models
    InfobipSMSMessage,
    InfobipMMSMessage,
    InfobipMMSContent,
    InfobipWhatsAppTextMessage,
    InfobipWhatsAppTemplateMessage,
    InfobipWhatsAppMediaMessage,
    InfobipViberMessage,
    InfobipDestination,
    # Infobip response models
    InfobipSendResponse,
    InfobipMessageResult,
    InfobipMessageStatusDetail,
    InfobipDeliveryReport,
    InfobipDeliveryReportResponse,
    InfobipPrice,
    # Infobip enums
    InfobipMessageStatus,
    InfobipChannel,
)

__all__ = [
    # Twilio
    "TwilioClient",
    "TwilioClientError",
    "TwilioConfig",
    "SMSMessage",
    "MMSMessage",
    "TemplateMessage",
    "OTTMessage",
    "MessageResponse",
    "MessageListResponse",
    "MediaResource",
    "ContentTemplate",
    "ContentTemplateListResponse",
    "MessageStatus",
    "MessageDirection",
    "OTTChannel",
    # Infobip
    "InfobipClient",
    "InfobipClientError",
    "InfobipConfig",
    "InfobipSMSMessage",
    "InfobipMMSMessage",
    "InfobipMMSContent",
    "InfobipWhatsAppTextMessage",
    "InfobipWhatsAppTemplateMessage",
    "InfobipWhatsAppMediaMessage",
    "InfobipViberMessage",
    "InfobipDestination",
    "InfobipSendResponse",
    "InfobipMessageResult",
    "InfobipMessageStatusDetail",
    "InfobipDeliveryReport",
    "InfobipDeliveryReportResponse",
    "InfobipPrice",
    "InfobipMessageStatus",
    "InfobipChannel",
]

