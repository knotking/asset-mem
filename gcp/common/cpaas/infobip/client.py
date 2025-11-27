"""
Infobip API Client for CPaaS (Communication Platform as a Service).

Provides async methods for:
- Sending/Reading SMS messages
- Sending MMS messages
- Sending WhatsApp messages (text, template, media)
- Sending Viber messages
- Getting delivery reports
"""

import logging
from typing import Optional, List, Dict, Any, Union
import httpx

from .config import InfobipConfig
from .models import (
    InfobipSMSMessage,
    InfobipMMSMessage,
    InfobipWhatsAppTextMessage,
    InfobipWhatsAppTemplateMessage,
    InfobipWhatsAppMediaMessage,
    InfobipViberMessage,
    InfobipSendResponse,
    InfobipDeliveryReportResponse,
    InfobipDestination,
    InfobipChannel,
)

logger = logging.getLogger(__name__)


class InfobipClientError(Exception):
    """Base exception for Infobip client errors."""
    def __init__(
        self, 
        message: str, 
        status_code: Optional[int] = None, 
        request_error: Optional[Dict[str, Any]] = None
    ):
        super().__init__(message)
        self.status_code = status_code
        self.request_error = request_error


class InfobipClient:
    """
    Async Infobip API client for messaging operations.
    
    Supports SMS, MMS, WhatsApp, and Viber channels.
    
    Example:
        from cpaas.infobip import InfobipConfig, InfobipClient, InfobipSMSMessage, InfobipDestination
        
        config = InfobipConfig.from_env()
        client = InfobipClient(config)
        
        # Send SMS
        response = await client.send_sms(
            InfobipSMSMessage(
                destinations=[InfobipDestination(to="+1234567890")],
                text="Hello!"
            )
        )
        
        # Send WhatsApp
        response = await client.send_whatsapp_text(
            InfobipWhatsAppTextMessage(
                to="+1234567890",
                text="Hello via WhatsApp!"
            )
        )
    """
    
    # API Endpoints
    SMS_ENDPOINT = "/sms/2/text/advanced"
    MMS_ENDPOINT = "/mms/1/single"
    WHATSAPP_TEXT_ENDPOINT = "/whatsapp/1/message/text"
    WHATSAPP_TEMPLATE_ENDPOINT = "/whatsapp/1/message/template"
    WHATSAPP_IMAGE_ENDPOINT = "/whatsapp/1/message/image"
    WHATSAPP_VIDEO_ENDPOINT = "/whatsapp/1/message/video"
    WHATSAPP_AUDIO_ENDPOINT = "/whatsapp/1/message/audio"
    WHATSAPP_DOCUMENT_ENDPOINT = "/whatsapp/1/message/document"
    VIBER_ENDPOINT = "/viber/1/message/text"
    DELIVERY_REPORTS_ENDPOINT = "/sms/1/reports"
    
    def __init__(self, config: InfobipConfig):
        """
        Initialize Infobip client.
        
        Args:
            config: InfobipConfig instance with credentials
        """
        self.config = config
        self._http_client: Optional[httpx.AsyncClient] = None
        
    @property
    def _headers(self) -> Dict[str, str]:
        """Generate request headers with API key authorization."""
        return {
            "Authorization": f"App {self.config.api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        }
    
    def _build_url(self, endpoint: str) -> str:
        """Build full API URL."""
        return f"{self.config.base_url}{endpoint}"
    
    async def _get_client(self) -> httpx.AsyncClient:
        """Get or create HTTP client."""
        if self._http_client is None or self._http_client.is_closed:
            self._http_client = httpx.AsyncClient(
                headers=self._headers,
                timeout=30.0,
            )
        return self._http_client
    
    async def close(self):
        """Close the HTTP client."""
        if self._http_client and not self._http_client.is_closed:
            await self._http_client.aclose()
    
    async def __aenter__(self):
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.close()
    
    def _apply_defaults_sms(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Apply default configuration values to SMS request params."""
        if "messages" in params:
            for message in params["messages"]:
                if "from" not in message and self.config.default_from:
                    message["from"] = self.config.default_from
        return params
    
    def _apply_defaults_whatsapp(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Apply default configuration values to WhatsApp request params."""
        if "from" not in params and self.config.whatsapp_sender:
            params["from"] = self.config.whatsapp_sender
        return params
    
    def _apply_defaults_viber(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Apply default configuration values to Viber request params."""
        if "messages" in params:
            for message in params["messages"]:
                if "from" not in message and self.config.viber_sender:
                    message["from"] = self.config.viber_sender
        return params
    
    async def _handle_response(self, response: httpx.Response) -> Dict[str, Any]:
        """Handle API response and raise errors if needed."""
        if response.status_code >= 400:
            try:
                error_data = response.json()
                error_message = error_data.get("requestError", {}).get(
                    "serviceException", {}
                ).get("text", "Unknown error")
            except Exception:
                error_message = response.text or "Unknown error"
                error_data = None
            
            logger.error(f"Infobip API error: {error_message} (status={response.status_code})")
            raise InfobipClientError(
                message=error_message,
                status_code=response.status_code,
                request_error=error_data,
            )
        
        return response.json()
    
    # =========================================================================
    # SMS Operations
    # =========================================================================
    
    async def send_sms(self, message: InfobipSMSMessage) -> InfobipSendResponse:
        """
        Send an SMS message.
        
        Args:
            message: InfobipSMSMessage with recipients and content
            
        Returns:
            InfobipSendResponse with message details and status
            
        Example:
            response = await client.send_sms(
                InfobipSMSMessage(
                    destinations=[InfobipDestination(to="+1234567890")],
                    text="Hello from Infobip!",
                    from_="MySender"  # Optional if default configured
                )
            )
        """
        client = await self._get_client()
        params = self._apply_defaults_sms(message.to_infobip_params())
        
        destinations_str = ", ".join([d.to for d in message.destinations[:3]])
        if len(message.destinations) > 3:
            destinations_str += f"... (+{len(message.destinations) - 3} more)"
        
        logger.info(f"Sending SMS to {destinations_str}")
        response = await client.post(
            self._build_url(self.SMS_ENDPOINT),
            json=params
        )
        data = await self._handle_response(response)
        
        result = InfobipSendResponse.from_infobip_response(data)
        logger.info(f"SMS sent successfully. Bulk ID: {result.bulk_id}")
        return result
    
    async def send_sms_simple(
        self,
        to: Union[str, List[str]],
        text: str,
        from_: Optional[str] = None,
        notify_url: Optional[str] = None,
    ) -> InfobipSendResponse:
        """
        Simplified SMS send for common use cases.
        
        Args:
            to: Single phone number or list of phone numbers
            text: Message text
            from_: Sender ID (optional if default configured)
            notify_url: Delivery report webhook URL (optional)
            
        Returns:
            InfobipSendResponse
            
        Example:
            # Single recipient
            await client.send_sms_simple("+1234567890", "Hello!")
            
            # Multiple recipients
            await client.send_sms_simple(
                ["+1234567890", "+0987654321"],
                "Hello everyone!"
            )
        """
        if isinstance(to, str):
            to = [to]
        
        message = InfobipSMSMessage(
            destinations=[InfobipDestination(to=num) for num in to],
            text=text,
            from_=from_,
            notify_url=notify_url,
        )
        
        return await self.send_sms(message)
    
    async def get_delivery_reports(
        self,
        bulk_id: Optional[str] = None,
        message_id: Optional[str] = None,
        limit: int = 50,
    ) -> InfobipDeliveryReportResponse:
        """
        Get delivery reports for sent messages.
        
        Args:
            bulk_id: Filter by bulk message ID
            message_id: Filter by specific message ID
            limit: Maximum number of reports to return
            
        Returns:
            InfobipDeliveryReportResponse
        """
        client = await self._get_client()
        
        params: Dict[str, Any] = {"limit": limit}
        if bulk_id:
            params["bulkId"] = bulk_id
        if message_id:
            params["messageId"] = message_id
        
        response = await client.get(
            self._build_url(self.DELIVERY_REPORTS_ENDPOINT),
            params=params
        )
        data = await self._handle_response(response)
        
        return InfobipDeliveryReportResponse.from_infobip_response(data)
    
    # =========================================================================
    # MMS Operations
    # =========================================================================
    
    async def send_mms(self, message: InfobipMMSMessage) -> InfobipSendResponse:
        """
        Send an MMS message with media.
        
        Args:
            message: InfobipMMSMessage with recipients and content
            
        Returns:
            InfobipSendResponse
            
        Example:
            from cpaas.infobip import InfobipMMSContent
            
            response = await client.send_mms(
                InfobipMMSMessage(
                    destinations=[InfobipDestination(to="+1234567890")],
                    text="Check this image!",
                    content=[
                        InfobipMMSContent(
                            content_type="image/jpeg",
                            content_id="img1",
                            content_url="https://example.com/image.jpg"
                        )
                    ]
                )
            )
        """
        client = await self._get_client()
        params = message.to_infobip_params()
        
        # Apply default sender
        if "from" not in params and self.config.default_from:
            params["from"] = self.config.default_from
        
        logger.info(f"Sending MMS to {len(message.destinations)} recipient(s)")
        response = await client.post(
            self._build_url(self.MMS_ENDPOINT),
            json=params
        )
        data = await self._handle_response(response)
        
        result = InfobipSendResponse.from_infobip_response(data)
        logger.info(f"MMS sent successfully. Bulk ID: {result.bulk_id}")
        return result
    
    # =========================================================================
    # WhatsApp Operations
    # =========================================================================
    
    async def send_whatsapp_text(
        self, 
        message: InfobipWhatsAppTextMessage
    ) -> InfobipSendResponse:
        """
        Send a WhatsApp text message.
        
        Args:
            message: InfobipWhatsAppTextMessage with recipient and content
            
        Returns:
            InfobipSendResponse
            
        Example:
            response = await client.send_whatsapp_text(
                InfobipWhatsAppTextMessage(
                    to="+1234567890",
                    text="Hello via WhatsApp!"
                )
            )
        """
        client = await self._get_client()
        params = self._apply_defaults_whatsapp(message.to_infobip_params())
        
        logger.info(f"Sending WhatsApp text to {message.to}")
        response = await client.post(
            self._build_url(self.WHATSAPP_TEXT_ENDPOINT),
            json=params
        )
        data = await self._handle_response(response)
        
        result = InfobipSendResponse.from_infobip_response(data)
        logger.info(f"WhatsApp text sent successfully")
        return result
    
    async def send_whatsapp_template(
        self, 
        message: InfobipWhatsAppTemplateMessage
    ) -> InfobipSendResponse:
        """
        Send a WhatsApp template message.
        
        Templates must be pre-approved by WhatsApp.
        
        Args:
            message: InfobipWhatsAppTemplateMessage with recipient and template
            
        Returns:
            InfobipSendResponse
            
        Example:
            response = await client.send_whatsapp_template(
                InfobipWhatsAppTemplateMessage(
                    to="+1234567890",
                    template_name="order_confirmation",
                    template_data={
                        "body": {
                            "placeholders": ["John", "12345"]
                        }
                    },
                    language="en"
                )
            )
        """
        client = await self._get_client()
        params = self._apply_defaults_whatsapp(message.to_infobip_params())
        
        logger.info(f"Sending WhatsApp template '{message.template_name}' to {message.to}")
        response = await client.post(
            self._build_url(self.WHATSAPP_TEMPLATE_ENDPOINT),
            json=params
        )
        data = await self._handle_response(response)
        
        result = InfobipSendResponse.from_infobip_response(data)
        logger.info(f"WhatsApp template sent successfully")
        return result
    
    async def send_whatsapp_media(
        self, 
        message: InfobipWhatsAppMediaMessage
    ) -> InfobipSendResponse:
        """
        Send a WhatsApp media message (image, video, audio, document).
        
        Args:
            message: InfobipWhatsAppMediaMessage with recipient and media
            
        Returns:
            InfobipSendResponse
            
        Example:
            response = await client.send_whatsapp_media(
                InfobipWhatsAppMediaMessage(
                    to="+1234567890",
                    media_type="image",
                    media_url="https://example.com/image.jpg",
                    caption="Check this out!"
                )
            )
        """
        client = await self._get_client()
        params = self._apply_defaults_whatsapp(message.to_infobip_params())
        
        # Select endpoint based on media type
        endpoint_map = {
            "image": self.WHATSAPP_IMAGE_ENDPOINT,
            "video": self.WHATSAPP_VIDEO_ENDPOINT,
            "audio": self.WHATSAPP_AUDIO_ENDPOINT,
            "document": self.WHATSAPP_DOCUMENT_ENDPOINT,
        }
        endpoint = endpoint_map.get(message.media_type, self.WHATSAPP_IMAGE_ENDPOINT)
        
        logger.info(f"Sending WhatsApp {message.media_type} to {message.to}")
        response = await client.post(
            self._build_url(endpoint),
            json=params
        )
        data = await self._handle_response(response)
        
        result = InfobipSendResponse.from_infobip_response(data)
        logger.info(f"WhatsApp media sent successfully")
        return result
    
    async def send_whatsapp_simple(
        self,
        to: str,
        text: str,
        from_: Optional[str] = None,
    ) -> InfobipSendResponse:
        """
        Simplified WhatsApp text send.
        
        Args:
            to: Recipient phone number
            text: Message text
            from_: Sender number (optional if default configured)
            
        Returns:
            InfobipSendResponse
        """
        message = InfobipWhatsAppTextMessage(
            to=to,
            text=text,
            from_=from_,
        )
        return await self.send_whatsapp_text(message)
    
    # =========================================================================
    # Viber Operations
    # =========================================================================
    
    async def send_viber(self, message: InfobipViberMessage) -> InfobipSendResponse:
        """
        Send a Viber message.
        
        Args:
            message: InfobipViberMessage with recipient and content
            
        Returns:
            InfobipSendResponse
            
        Example:
            response = await client.send_viber(
                InfobipViberMessage(
                    to="+1234567890",
                    text="Hello via Viber!",
                    image_url="https://example.com/image.jpg",
                    button_text="Visit",
                    button_url="https://example.com"
                )
            )
        """
        client = await self._get_client()
        params = self._apply_defaults_viber(message.to_infobip_params())
        
        logger.info(f"Sending Viber message to {message.to}")
        response = await client.post(
            self._build_url(self.VIBER_ENDPOINT),
            json=params
        )
        data = await self._handle_response(response)
        
        result = InfobipSendResponse.from_infobip_response(data)
        logger.info(f"Viber message sent successfully")
        return result
    
    async def send_viber_simple(
        self,
        to: str,
        text: str,
        from_: Optional[str] = None,
        image_url: Optional[str] = None,
        button_text: Optional[str] = None,
        button_url: Optional[str] = None,
    ) -> InfobipSendResponse:
        """
        Simplified Viber send.
        
        Args:
            to: Recipient phone number
            text: Message text
            from_: Sender ID (optional if default configured)
            image_url: Optional image URL
            button_text: Optional button text
            button_url: Optional button URL
            
        Returns:
            InfobipSendResponse
        """
        message = InfobipViberMessage(
            to=to,
            text=text,
            from_=from_,
            image_url=image_url,
            button_text=button_text,
            button_url=button_url,
        )
        return await self.send_viber(message)
    
    # =========================================================================
    # Utility Methods
    # =========================================================================
    
    async def get_account_balance(self) -> Dict[str, Any]:
        """
        Get account balance information.
        
        Returns:
            Dict with balance information
        """
        client = await self._get_client()
        response = await client.get(
            self._build_url("/account/1/balance")
        )
        return await self._handle_response(response)

