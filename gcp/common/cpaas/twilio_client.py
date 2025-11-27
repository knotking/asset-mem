"""
Twilio API Client for CPaaS (Communication Platform as a Service).

Provides async methods for:
- Sending/Reading SMS messages
- Sending/Reading MMS messages (with media)
- Sending/Reading Template messages (Content API)
- Sending/Reading OTT messages (WhatsApp, Messenger, etc.)
"""

import logging
from datetime import datetime
from typing import Optional, List, Dict, Any, Union
import httpx
from base64 import b64encode

from .config import TwilioConfig
from .models import (
    SMSMessage,
    MMSMessage,
    TemplateMessage,
    OTTMessage,
    MessageResponse,
    MessageListResponse,
    MessageStatus,
    MessageDirection,
    OTTChannel,
    MediaResource,
    ContentTemplate,
    ContentTemplateListResponse,
)

logger = logging.getLogger(__name__)


class TwilioClientError(Exception):
    """Base exception for Twilio client errors."""
    def __init__(self, message: str, status_code: Optional[int] = None, error_code: Optional[int] = None):
        super().__init__(message)
        self.status_code = status_code
        self.error_code = error_code


class TwilioClient:
    """
    Async Twilio API client for messaging operations.
    
    Supports SMS, MMS, Content Templates, and OTT (WhatsApp, Messenger) channels.
    
    Example:
        config = TwilioConfig.from_env()
        client = TwilioClient(config)
        
        # Send SMS
        response = await client.send_sms(
            SMSMessage(to="+1234567890", body="Hello!")
        )
        
        # Send WhatsApp
        response = await client.send_ott(
            OTTMessage(
                to="+1234567890",
                channel=OTTChannel.WHATSAPP,
                body="Hello via WhatsApp!"
            )
        )
    """
    
    def __init__(self, config: TwilioConfig):
        """
        Initialize Twilio client.
        
        Args:
            config: TwilioConfig instance with credentials
        """
        self.config = config
        self._http_client: Optional[httpx.AsyncClient] = None
        
    @property
    def _auth_header(self) -> str:
        """Generate Basic Auth header."""
        credentials = f"{self.config.account_sid}:{self.config.auth_token}"
        encoded = b64encode(credentials.encode()).decode()
        return f"Basic {encoded}"
    
    @property
    def _messages_url(self) -> str:
        """Base URL for Messages API."""
        return f"{self.config.api_base_url}/Accounts/{self.config.account_sid}/Messages"
    
    async def _get_client(self) -> httpx.AsyncClient:
        """Get or create HTTP client."""
        if self._http_client is None or self._http_client.is_closed:
            self._http_client = httpx.AsyncClient(
                headers={"Authorization": self._auth_header},
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
    
    def _apply_defaults(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Apply default configuration values to request params."""
        if "From" not in params and "MessagingServiceSid" not in params:
            if self.config.default_from_number:
                params["From"] = self.config.default_from_number
            elif self.config.messaging_service_sid:
                params["MessagingServiceSid"] = self.config.messaging_service_sid
        return params
    
    async def _handle_response(self, response: httpx.Response) -> Dict[str, Any]:
        """Handle API response and raise errors if needed."""
        if response.status_code >= 400:
            try:
                error_data = response.json()
                error_message = error_data.get("message", "Unknown error")
                error_code = error_data.get("code")
            except Exception:
                error_message = response.text or "Unknown error"
                error_code = None
            
            logger.error(f"Twilio API error: {error_message} (status={response.status_code})")
            raise TwilioClientError(
                message=error_message,
                status_code=response.status_code,
                error_code=error_code,
            )
        
        return response.json()
    
    # =========================================================================
    # SMS Operations
    # =========================================================================
    
    async def send_sms(self, message: SMSMessage) -> MessageResponse:
        """
        Send an SMS message.
        
        Args:
            message: SMSMessage with recipient and content
            
        Returns:
            MessageResponse with message details and status
            
        Example:
            response = await client.send_sms(
                SMSMessage(
                    to="+1234567890",
                    body="Hello from Twilio!",
                    from_="+0987654321"  # Optional if default configured
                )
            )
        """
        client = await self._get_client()
        params = self._apply_defaults(message.to_twilio_params())
        
        logger.info(f"Sending SMS to {message.to}")
        response = await client.post(f"{self._messages_url}.json", data=params)
        data = await self._handle_response(response)
        
        logger.info(f"SMS sent successfully. SID: {data.get('sid')}")
        return MessageResponse.from_twilio_response(data)
    
    async def read_sms(
        self,
        message_sid: Optional[str] = None,
        to: Optional[str] = None,
        from_: Optional[str] = None,
        date_sent: Optional[datetime] = None,
        date_sent_after: Optional[datetime] = None,
        date_sent_before: Optional[datetime] = None,
        page_size: int = 50,
        page: int = 0,
    ) -> Union[MessageResponse, MessageListResponse]:
        """
        Read SMS messages.
        
        If message_sid is provided, returns a single message.
        Otherwise, returns a list of messages matching the filters.
        
        Args:
            message_sid: Specific message SID to retrieve
            to: Filter by recipient number
            from_: Filter by sender number
            date_sent: Filter by exact send date
            date_sent_after: Filter messages sent after this date
            date_sent_before: Filter messages sent before this date
            page_size: Number of messages per page (max 1000)
            page: Page number (0-indexed)
            
        Returns:
            MessageResponse (single) or MessageListResponse (list)
            
        Example:
            # Get single message
            msg = await client.read_sms(message_sid="SM...")
            
            # List messages
            msgs = await client.read_sms(to="+1234567890", page_size=20)
        """
        client = await self._get_client()
        
        if message_sid:
            # Fetch single message
            response = await client.get(f"{self._messages_url}/{message_sid}.json")
            data = await self._handle_response(response)
            return MessageResponse.from_twilio_response(data)
        
        # Build query params for listing
        params: Dict[str, Any] = {"PageSize": page_size, "Page": page}
        if to:
            params["To"] = to
        if from_:
            params["From"] = from_
        if date_sent:
            params["DateSent"] = date_sent.strftime("%Y-%m-%d")
        if date_sent_after:
            params["DateSent>"] = date_sent_after.strftime("%Y-%m-%d")
        if date_sent_before:
            params["DateSent<"] = date_sent_before.strftime("%Y-%m-%d")
        
        response = await client.get(f"{self._messages_url}.json", params=params)
        data = await self._handle_response(response)
        
        messages = [
            MessageResponse.from_twilio_response(m) 
            for m in data.get("messages", [])
        ]
        
        return MessageListResponse(
            messages=messages,
            page=page,
            page_size=page_size,
            next_page_uri=data.get("next_page_uri"),
            previous_page_uri=data.get("previous_page_uri"),
        )
    
    # =========================================================================
    # MMS Operations
    # =========================================================================
    
    async def send_mms(self, message: MMSMessage) -> MessageResponse:
        """
        Send an MMS message with media attachments.
        
        Args:
            message: MMSMessage with recipient, content, and media URLs
            
        Returns:
            MessageResponse with message details and status
            
        Example:
            response = await client.send_mms(
                MMSMessage(
                    to="+1234567890",
                    body="Check this out!",
                    media_urls=["https://example.com/image.jpg"]
                )
            )
        """
        client = await self._get_client()
        params = self._apply_defaults(message.to_twilio_params())
        
        logger.info(f"Sending MMS to {message.to} with {len(message.media_urls)} media items")
        response = await client.post(f"{self._messages_url}.json", data=params)
        data = await self._handle_response(response)
        
        logger.info(f"MMS sent successfully. SID: {data.get('sid')}")
        return MessageResponse.from_twilio_response(data)
    
    async def read_mms(
        self,
        message_sid: Optional[str] = None,
        **kwargs,
    ) -> Union[MessageResponse, MessageListResponse]:
        """
        Read MMS messages. Same interface as read_sms().
        
        MMS messages are stored in the same Messages resource as SMS.
        """
        return await self.read_sms(message_sid=message_sid, **kwargs)
    
    async def get_message_media(self, message_sid: str) -> List[MediaResource]:
        """
        Get media resources attached to an MMS message.
        
        Args:
            message_sid: Message SID to get media for
            
        Returns:
            List of MediaResource objects
        """
        client = await self._get_client()
        url = f"{self._messages_url}/{message_sid}/Media.json"
        
        response = await client.get(url)
        data = await self._handle_response(response)
        
        return [
            MediaResource(
                sid=m["sid"],
                account_sid=m["account_sid"],
                parent_sid=m["parent_sid"],
                content_type=m["content_type"],
                date_created=m.get("date_created"),
                date_updated=m.get("date_updated"),
                uri=m["uri"],
            )
            for m in data.get("media_list", [])
        ]
    
    # =========================================================================
    # Template Operations (Content API)
    # =========================================================================
    
    async def send_template(self, message: TemplateMessage) -> MessageResponse:
        """
        Send a message using a Content Template.
        
        Templates must be pre-created and approved in Twilio Console.
        Required for WhatsApp Business API outside the 24-hour window.
        
        Args:
            message: TemplateMessage with recipient and template details
            
        Returns:
            MessageResponse with message details and status
            
        Example:
            response = await client.send_template(
                TemplateMessage(
                    to="whatsapp:+1234567890",
                    content_sid="HXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
                    content_variables={"1": "John", "2": "Order #12345"}
                )
            )
        """
        client = await self._get_client()
        params = self._apply_defaults(message.to_twilio_params())
        
        logger.info(f"Sending template {message.content_sid} to {message.to}")
        response = await client.post(f"{self._messages_url}.json", data=params)
        data = await self._handle_response(response)
        
        logger.info(f"Template message sent successfully. SID: {data.get('sid')}")
        return MessageResponse.from_twilio_response(data)
    
    async def list_content_templates(
        self,
        page_size: int = 50,
    ) -> ContentTemplateListResponse:
        """
        List available Content Templates.
        
        Args:
            page_size: Number of templates per page
            
        Returns:
            ContentTemplateListResponse with template list
        """
        client = await self._get_client()
        url = f"{self.config.content_api_url}/Content"
        
        response = await client.get(url, params={"PageSize": page_size})
        data = await self._handle_response(response)
        
        templates = [
            ContentTemplate(
                sid=t["sid"],
                account_sid=t["account_sid"],
                friendly_name=t.get("friendly_name", ""),
                language=t.get("language", "en"),
                variables=t.get("variables"),
                types=t.get("types"),
                date_created=t.get("date_created"),
                date_updated=t.get("date_updated"),
                url=t.get("url"),
            )
            for t in data.get("contents", [])
        ]
        
        return ContentTemplateListResponse(
            contents=templates,
            meta=data.get("meta"),
        )
    
    async def get_content_template(self, content_sid: str) -> ContentTemplate:
        """
        Get a specific Content Template by SID.
        
        Args:
            content_sid: Template SID (starts with 'HX')
            
        Returns:
            ContentTemplate details
        """
        client = await self._get_client()
        url = f"{self.config.content_api_url}/Content/{content_sid}"
        
        response = await client.get(url)
        data = await self._handle_response(response)
        
        return ContentTemplate(
            sid=data["sid"],
            account_sid=data["account_sid"],
            friendly_name=data.get("friendly_name", ""),
            language=data.get("language", "en"),
            variables=data.get("variables"),
            types=data.get("types"),
            date_created=data.get("date_created"),
            date_updated=data.get("date_updated"),
            url=data.get("url"),
        )
    
    # =========================================================================
    # OTT Operations (WhatsApp, Messenger, etc.)
    # =========================================================================
    
    async def send_ott(self, message: OTTMessage) -> MessageResponse:
        """
        Send an OTT (Over-the-Top) message via WhatsApp, Messenger, etc.
        
        Args:
            message: OTTMessage with channel, recipient, and content
            
        Returns:
            MessageResponse with message details and status
            
        Example (WhatsApp):
            response = await client.send_ott(
                OTTMessage(
                    to="+1234567890",  # Will be formatted as whatsapp:+...
                    channel=OTTChannel.WHATSAPP,
                    body="Hello via WhatsApp!"
                )
            )
            
        Example (WhatsApp with media):
            response = await client.send_ott(
                OTTMessage(
                    to="+1234567890",
                    channel=OTTChannel.WHATSAPP,
                    body="Check this image!",
                    media_urls=["https://example.com/image.jpg"]
                )
            )
        """
        client = await self._get_client()
        params = message.to_twilio_params()
        
        # Apply WhatsApp-specific defaults
        if message.channel == OTTChannel.WHATSAPP:
            if "From" not in params and self.config.whatsapp_from_number:
                from_num = self.config.whatsapp_from_number
                if not from_num.startswith("whatsapp:"):
                    from_num = f"whatsapp:{from_num}"
                params["From"] = from_num
        
        # Fall back to general defaults
        params = self._apply_defaults(params)
        
        logger.info(f"Sending {message.channel.value} message to {message.to}")
        response = await client.post(f"{self._messages_url}.json", data=params)
        data = await self._handle_response(response)
        
        logger.info(f"OTT message sent successfully. SID: {data.get('sid')}")
        return MessageResponse.from_twilio_response(data)
    
    async def read_ott(
        self,
        message_sid: Optional[str] = None,
        channel: Optional[OTTChannel] = None,
        **kwargs,
    ) -> Union[MessageResponse, MessageListResponse]:
        """
        Read OTT messages. 
        
        OTT messages are stored in the same Messages resource.
        Filter by 'to' or 'from_' with channel prefix (e.g., 'whatsapp:+1234567890').
        
        Args:
            message_sid: Specific message SID
            channel: OTT channel to filter by
            **kwargs: Additional filter arguments (to, from_, date_sent, etc.)
            
        Returns:
            MessageResponse (single) or MessageListResponse (list)
        """
        # Add channel prefix to phone number filters if channel specified
        if channel == OTTChannel.WHATSAPP:
            if "to" in kwargs and not kwargs["to"].startswith("whatsapp:"):
                kwargs["to"] = f"whatsapp:{kwargs['to']}"
            if "from_" in kwargs and not kwargs["from_"].startswith("whatsapp:"):
                kwargs["from_"] = f"whatsapp:{kwargs['from_']}"
        
        return await self.read_sms(message_sid=message_sid, **kwargs)
    
    # =========================================================================
    # Utility Methods
    # =========================================================================
    
    async def get_message_status(self, message_sid: str) -> MessageStatus:
        """
        Get the current status of a message.
        
        Args:
            message_sid: Message SID to check
            
        Returns:
            MessageStatus enum value
        """
        response = await self.read_sms(message_sid=message_sid)
        if isinstance(response, MessageResponse):
            return response.status
        raise TwilioClientError(f"Unexpected response type for message {message_sid}")
    
    async def delete_message(self, message_sid: str) -> bool:
        """
        Delete a message from Twilio.
        
        Note: Messages can only be deleted after delivery.
        
        Args:
            message_sid: Message SID to delete
            
        Returns:
            True if successful
        """
        client = await self._get_client()
        response = await client.delete(f"{self._messages_url}/{message_sid}.json")
        
        if response.status_code == 204:
            logger.info(f"Message {message_sid} deleted successfully")
            return True
        
        await self._handle_response(response)
        return False
    
    async def cancel_message(self, message_sid: str) -> MessageResponse:
        """
        Cancel a scheduled message.
        
        Only works for messages with status 'scheduled'.
        
        Args:
            message_sid: Message SID to cancel
            
        Returns:
            Updated MessageResponse
        """
        client = await self._get_client()
        response = await client.post(
            f"{self._messages_url}/{message_sid}.json",
            data={"Status": "canceled"},
        )
        data = await self._handle_response(response)
        
        logger.info(f"Message {message_sid} canceled")
        return MessageResponse.from_twilio_response(data)

