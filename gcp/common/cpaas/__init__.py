"""
CPaaS - Communication Platform as a Service

Multi-provider messaging module for sending and receiving messages via:
- SMS (Short Message Service)
- MMS (Multimedia Messaging Service)
- Content Templates (Pre-approved message templates)
- OTT (Over-the-Top messaging: WhatsApp, Facebook Messenger, Viber, etc.)

Supported Providers:
- Twilio (cpaas.twilio)
- Infobip (cpaas.infobip)

Usage:
    # Twilio
    from cpaas.twilio import TwilioClient, TwilioConfig, SMSMessage
    
    config = TwilioConfig.from_env()
    async with TwilioClient(config) as client:
        response = await client.send_sms(SMSMessage(to="+1234567890", body="Hello!"))
    
    # Infobip
    from cpaas.infobip import InfobipClient, InfobipConfig, InfobipSMSMessage, InfobipDestination
    
    config = InfobipConfig.from_env()
    async with InfobipClient(config) as client:
        response = await client.send_sms(
            InfobipSMSMessage(
                destinations=[InfobipDestination(to="+1234567890")],
                text="Hello!"
            )
        )
"""

# Twilio imports (for backwards compatibility)
from .twilio import (
    TwilioClient,
    TwilioClientError,
    TwilioConfig,
    SMSMessage,
    MMSMessage,
    TemplateMessage,
    OTTMessage,
    MessageResponse,
    MessageListResponse,
    MediaResource,
    ContentTemplate,
    ContentTemplateListResponse,
    MessageStatus,
    MessageDirection,
    OTTChannel,
)

# Infobip imports (for backwards compatibility)
from .infobip import (
    InfobipClient,
    InfobipClientError,
    InfobipConfig,
    InfobipSMSMessage,
    InfobipMMSMessage,
    InfobipMMSContent,
    InfobipWhatsAppTextMessage,
    InfobipWhatsAppTemplateMessage,
    InfobipWhatsAppMediaMessage,
    InfobipViberMessage,
    InfobipDestination,
    InfobipSendResponse,
    InfobipMessageResult,
    InfobipMessageStatusDetail,
    InfobipDeliveryReport,
    InfobipDeliveryReportResponse,
    InfobipPrice,
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
