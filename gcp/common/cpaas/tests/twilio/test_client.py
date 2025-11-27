"""Unit tests for TwilioClient."""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime

from cpaas.twilio import (
    TwilioConfig,
    TwilioClient,
    TwilioClientError,
    SMSMessage,
    MMSMessage,
    TemplateMessage,
    OTTMessage,
    MessageStatus,
    OTTChannel,
)


class MockResponse:
    """Mock HTTP response for testing."""
    
    def __init__(self, data: dict, status_code: int = 200):
        self._data = data
        self.status_code = status_code
        self.text = str(data)
    
    def json(self):
        return self._data


@pytest.fixture
def config():
    """Create test configuration."""
    return TwilioConfig(
        account_sid="AC1234567890abcdef1234567890abcdef",
        auth_token="test_auth_token",
        default_from_number="+15551234567",
        whatsapp_from_number="+15559876543",
    )


@pytest.fixture
def client(config):
    """Create test client."""
    return TwilioClient(config)


class TestTwilioClientInit:
    """Tests for TwilioClient initialization."""

    def test_client_initialization(self, config):
        """Test client initializes with config."""
        client = TwilioClient(config)
        
        assert client.config == config
        assert client._http_client is None

    def test_auth_header_generation(self, client):
        """Test Basic Auth header is generated correctly."""
        auth_header = client._auth_header
        
        assert auth_header.startswith("Basic ")
        # The header should be base64 encoded "account_sid:auth_token"
        assert len(auth_header) > 10

    def test_messages_url(self, client):
        """Test messages URL is constructed correctly."""
        url = client._messages_url
        
        assert "api.twilio.com" in url
        assert client.config.account_sid in url
        assert url.endswith("/Messages")


class TestTwilioClientSMS:
    """Tests for SMS operations."""

    @pytest.mark.asyncio
    async def test_send_sms_success(self, client):
        """Test successful SMS send."""
        mock_response = MockResponse({
            "sid": "SM1234567890",
            "account_sid": "AC123",
            "to": "+1234567890",
            "from": "+15551234567",
            "body": "Hello!",
            "status": "queued",
        })
        
        with patch.object(client, "_get_client") as mock_get_client:
            mock_http = AsyncMock()
            mock_http.post = AsyncMock(return_value=mock_response)
            mock_get_client.return_value = mock_http
            
            response = await client.send_sms(
                SMSMessage(to="+1234567890", body="Hello!")
            )
            
            assert response.sid == "SM1234567890"
            assert response.status == MessageStatus.QUEUED
            mock_http.post.assert_called_once()

    @pytest.mark.asyncio
    async def test_send_sms_applies_defaults(self, client):
        """Test SMS send applies default from number."""
        mock_response = MockResponse({
            "sid": "SM123",
            "account_sid": "AC123",
            "to": "+1234567890",
            "status": "queued",
        })
        
        with patch.object(client, "_get_client") as mock_get_client:
            mock_http = AsyncMock()
            mock_http.post = AsyncMock(return_value=mock_response)
            mock_get_client.return_value = mock_http
            
            await client.send_sms(
                SMSMessage(to="+1234567890", body="Test")
            )
            
            # Check that default From was added
            call_kwargs = mock_http.post.call_args
            assert "From" in call_kwargs.kwargs["data"]
            assert call_kwargs.kwargs["data"]["From"] == "+15551234567"

    @pytest.mark.asyncio
    async def test_read_sms_single(self, client):
        """Test reading a single SMS message."""
        mock_response = MockResponse({
            "sid": "SM123",
            "account_sid": "AC123",
            "to": "+1234567890",
            "from": "+0987654321",
            "body": "Test message",
            "status": "delivered",
        })
        
        with patch.object(client, "_get_client") as mock_get_client:
            mock_http = AsyncMock()
            mock_http.get = AsyncMock(return_value=mock_response)
            mock_get_client.return_value = mock_http
            
            response = await client.read_sms(message_sid="SM123")
            
            assert response.sid == "SM123"
            assert response.body == "Test message"
            assert response.status == MessageStatus.DELIVERED

    @pytest.mark.asyncio
    async def test_read_sms_list(self, client):
        """Test listing SMS messages."""
        mock_response = MockResponse({
            "messages": [
                {
                    "sid": "SM1",
                    "account_sid": "AC123",
                    "to": "+1234567890",
                    "status": "delivered",
                },
                {
                    "sid": "SM2",
                    "account_sid": "AC123",
                    "to": "+1234567890",
                    "status": "sent",
                },
            ],
            "next_page_uri": None,
        })
        
        with patch.object(client, "_get_client") as mock_get_client:
            mock_http = AsyncMock()
            mock_http.get = AsyncMock(return_value=mock_response)
            mock_get_client.return_value = mock_http
            
            response = await client.read_sms(to="+1234567890")
            
            assert len(response.messages) == 2
            assert response.messages[0].sid == "SM1"
            assert response.messages[1].sid == "SM2"


class TestTwilioClientMMS:
    """Tests for MMS operations."""

    @pytest.mark.asyncio
    async def test_send_mms_success(self, client):
        """Test successful MMS send."""
        mock_response = MockResponse({
            "sid": "MM1234567890",
            "account_sid": "AC123",
            "to": "+1234567890",
            "status": "queued",
            "num_media": 1,
        })
        
        with patch.object(client, "_get_client") as mock_get_client:
            mock_http = AsyncMock()
            mock_http.post = AsyncMock(return_value=mock_response)
            mock_get_client.return_value = mock_http
            
            response = await client.send_mms(
                MMSMessage(
                    to="+1234567890",
                    body="Check this!",
                    media_urls=["https://example.com/img.jpg"],
                )
            )
            
            assert response.sid == "MM1234567890"
            assert response.num_media == 1

    @pytest.mark.asyncio
    async def test_get_message_media(self, client):
        """Test getting media from MMS."""
        mock_response = MockResponse({
            "media_list": [
                {
                    "sid": "ME123",
                    "account_sid": "AC123",
                    "parent_sid": "MM123",
                    "content_type": "image/jpeg",
                    "uri": "/media/ME123.json",
                },
            ],
        })
        
        with patch.object(client, "_get_client") as mock_get_client:
            mock_http = AsyncMock()
            mock_http.get = AsyncMock(return_value=mock_response)
            mock_get_client.return_value = mock_http
            
            media_list = await client.get_message_media("MM123")
            
            assert len(media_list) == 1
            assert media_list[0].sid == "ME123"
            assert media_list[0].content_type == "image/jpeg"


class TestTwilioClientTemplate:
    """Tests for template operations."""

    @pytest.mark.asyncio
    async def test_send_template_success(self, client):
        """Test successful template send."""
        mock_response = MockResponse({
            "sid": "SM123",
            "account_sid": "AC123",
            "to": "whatsapp:+1234567890",
            "status": "queued",
        })
        
        with patch.object(client, "_get_client") as mock_get_client:
            mock_http = AsyncMock()
            mock_http.post = AsyncMock(return_value=mock_response)
            mock_get_client.return_value = mock_http
            
            response = await client.send_template(
                TemplateMessage(
                    to="whatsapp:+1234567890",
                    content_sid="HX123456",
                    content_variables={"1": "John"},
                )
            )
            
            assert response.sid == "SM123"

    @pytest.mark.asyncio
    async def test_list_content_templates(self, client):
        """Test listing content templates."""
        mock_response = MockResponse({
            "contents": [
                {
                    "sid": "HX123",
                    "account_sid": "AC123",
                    "friendly_name": "Order Confirmation",
                    "language": "en",
                },
            ],
            "meta": {"page": 0},
        })
        
        with patch.object(client, "_get_client") as mock_get_client:
            mock_http = AsyncMock()
            mock_http.get = AsyncMock(return_value=mock_response)
            mock_get_client.return_value = mock_http
            
            response = await client.list_content_templates()
            
            assert len(response.contents) == 1
            assert response.contents[0].sid == "HX123"


class TestTwilioClientOTT:
    """Tests for OTT (WhatsApp, etc.) operations."""

    @pytest.mark.asyncio
    async def test_send_whatsapp_success(self, client):
        """Test successful WhatsApp message send."""
        mock_response = MockResponse({
            "sid": "SM123",
            "account_sid": "AC123",
            "to": "whatsapp:+1234567890",
            "from": "whatsapp:+15559876543",
            "status": "queued",
        })
        
        with patch.object(client, "_get_client") as mock_get_client:
            mock_http = AsyncMock()
            mock_http.post = AsyncMock(return_value=mock_response)
            mock_get_client.return_value = mock_http
            
            response = await client.send_ott(
                OTTMessage(
                    to="+1234567890",
                    channel=OTTChannel.WHATSAPP,
                    body="Hello WhatsApp!",
                )
            )
            
            assert response.sid == "SM123"
            
            # Verify WhatsApp formatting was applied
            call_kwargs = mock_http.post.call_args
            assert call_kwargs.kwargs["data"]["To"] == "whatsapp:+1234567890"

    @pytest.mark.asyncio
    async def test_send_whatsapp_applies_default_from(self, client):
        """Test WhatsApp uses default WhatsApp from number."""
        mock_response = MockResponse({
            "sid": "SM123",
            "account_sid": "AC123",
            "to": "whatsapp:+1234567890",
            "status": "queued",
        })
        
        with patch.object(client, "_get_client") as mock_get_client:
            mock_http = AsyncMock()
            mock_http.post = AsyncMock(return_value=mock_response)
            mock_get_client.return_value = mock_http
            
            await client.send_ott(
                OTTMessage(
                    to="+1234567890",
                    channel=OTTChannel.WHATSAPP,
                    body="Test",
                )
            )
            
            call_kwargs = mock_http.post.call_args
            assert "whatsapp:" in call_kwargs.kwargs["data"]["From"]


class TestTwilioClientUtility:
    """Tests for utility methods."""

    @pytest.mark.asyncio
    async def test_get_message_status(self, client):
        """Test getting message status."""
        mock_response = MockResponse({
            "sid": "SM123",
            "account_sid": "AC123",
            "to": "+1234567890",
            "status": "delivered",
        })
        
        with patch.object(client, "_get_client") as mock_get_client:
            mock_http = AsyncMock()
            mock_http.get = AsyncMock(return_value=mock_response)
            mock_get_client.return_value = mock_http
            
            status = await client.get_message_status("SM123")
            
            assert status == MessageStatus.DELIVERED

    @pytest.mark.asyncio
    async def test_delete_message(self, client):
        """Test deleting a message."""
        mock_response = MagicMock()
        mock_response.status_code = 204
        
        with patch.object(client, "_get_client") as mock_get_client:
            mock_http = AsyncMock()
            mock_http.delete = AsyncMock(return_value=mock_response)
            mock_get_client.return_value = mock_http
            
            result = await client.delete_message("SM123")
            
            assert result is True

    @pytest.mark.asyncio
    async def test_cancel_message(self, client):
        """Test canceling a scheduled message."""
        mock_response = MockResponse({
            "sid": "SM123",
            "account_sid": "AC123",
            "to": "+1234567890",
            "status": "canceled",
        })
        
        with patch.object(client, "_get_client") as mock_get_client:
            mock_http = AsyncMock()
            mock_http.post = AsyncMock(return_value=mock_response)
            mock_get_client.return_value = mock_http
            
            response = await client.cancel_message("SM123")
            
            assert response.status == MessageStatus.CANCELED


class TestTwilioClientErrors:
    """Tests for error handling."""

    @pytest.mark.asyncio
    async def test_api_error_handling(self, client):
        """Test handling of API errors."""
        mock_response = MockResponse(
            data={
                "code": 21608,
                "message": "The 'From' phone number is not valid.",
            },
            status_code=400,
        )
        
        with patch.object(client, "_get_client") as mock_get_client:
            mock_http = AsyncMock()
            mock_http.post = AsyncMock(return_value=mock_response)
            mock_get_client.return_value = mock_http
            
            with pytest.raises(TwilioClientError) as exc_info:
                await client.send_sms(
                    SMSMessage(to="+1234567890", body="Test")
                )
            
            assert exc_info.value.status_code == 400
            assert exc_info.value.error_code == 21608

    @pytest.mark.asyncio
    async def test_server_error_handling(self, client):
        """Test handling of server errors."""
        mock_response = MockResponse(
            data={"message": "Internal server error"},
            status_code=500,
        )
        
        with patch.object(client, "_get_client") as mock_get_client:
            mock_http = AsyncMock()
            mock_http.post = AsyncMock(return_value=mock_response)
            mock_get_client.return_value = mock_http
            
            with pytest.raises(TwilioClientError) as exc_info:
                await client.send_sms(
                    SMSMessage(to="+1234567890", body="Test")
                )
            
            assert exc_info.value.status_code == 500


class TestTwilioClientContextManager:
    """Tests for context manager functionality."""

    @pytest.mark.asyncio
    async def test_async_context_manager(self, config):
        """Test client works as async context manager."""
        async with TwilioClient(config) as client:
            assert client.config == config
        
        # Client should be closed after exiting context

    @pytest.mark.asyncio
    async def test_close_method(self, client):
        """Test close method."""
        # Should not raise even if client wasn't opened
        await client.close()

