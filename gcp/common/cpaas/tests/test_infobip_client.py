"""Unit tests for InfobipClient."""

import pytest
from unittest.mock import AsyncMock, patch

from ..config import InfobipConfig
from ..infobip_client import InfobipClient, InfobipClientError
from ..models import (
    InfobipSMSMessage,
    InfobipMMSMessage,
    InfobipMMSContent,
    InfobipWhatsAppTextMessage,
    InfobipWhatsAppTemplateMessage,
    InfobipWhatsAppMediaMessage,
    InfobipViberMessage,
    InfobipDestination,
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
    return InfobipConfig(
        api_key="test-api-key-12345",
        base_url="https://api.infobip.com",
        default_from="TestSender",
        whatsapp_sender="+15559876543",
        viber_sender="ViberService",
    )


@pytest.fixture
def client(config):
    """Create test client."""
    return InfobipClient(config)


class TestInfobipClientInit:
    """Tests for InfobipClient initialization."""

    def test_client_initialization(self, config):
        """Test client initializes with config."""
        client = InfobipClient(config)
        
        assert client.config == config
        assert client._http_client is None

    def test_headers_generation(self, client):
        """Test authorization headers are generated correctly."""
        headers = client._headers
        
        assert "Authorization" in headers
        assert headers["Authorization"] == "App test-api-key-12345"
        assert headers["Content-Type"] == "application/json"

    def test_build_url(self, client):
        """Test URL building."""
        url = client._build_url("/sms/2/text/advanced")
        
        assert url == "https://api.infobip.com/sms/2/text/advanced"


class TestInfobipClientSMS:
    """Tests for SMS operations."""

    @pytest.mark.asyncio
    async def test_send_sms_success(self, client):
        """Test successful SMS send."""
        mock_response = MockResponse({
            "bulkId": "BULK-123",
            "messages": [
                {
                    "messageId": "MSG-123",
                    "to": "+1234567890",
                    "status": {
                        "groupId": 1,
                        "groupName": "PENDING",
                        "id": 7,
                        "name": "PENDING_ENROUTE",
                        "description": "Message sent to next instance",
                    },
                    "smsCount": 1,
                }
            ],
        })
        
        with patch.object(client, "_get_client") as mock_get_client:
            mock_http = AsyncMock()
            mock_http.post = AsyncMock(return_value=mock_response)
            mock_get_client.return_value = mock_http
            
            response = await client.send_sms(
                InfobipSMSMessage(
                    destinations=[InfobipDestination(to="+1234567890")],
                    text="Hello!"
                )
            )
            
            assert response.bulk_id == "BULK-123"
            assert len(response.messages) == 1
            assert response.messages[0].message_id == "MSG-123"
            assert response.messages[0].to == "+1234567890"
            mock_http.post.assert_called_once()

    @pytest.mark.asyncio
    async def test_send_sms_applies_defaults(self, client):
        """Test SMS send applies default sender."""
        mock_response = MockResponse({
            "bulkId": "BULK-123",
            "messages": [
                {
                    "messageId": "MSG-123",
                    "to": "+1234567890",
                    "status": {
                        "groupId": 1,
                        "groupName": "PENDING",
                        "id": 7,
                        "name": "PENDING_ENROUTE",
                    },
                }
            ],
        })
        
        with patch.object(client, "_get_client") as mock_get_client:
            mock_http = AsyncMock()
            mock_http.post = AsyncMock(return_value=mock_response)
            mock_get_client.return_value = mock_http
            
            await client.send_sms(
                InfobipSMSMessage(
                    destinations=[InfobipDestination(to="+1234567890")],
                    text="Test"
                )
            )
            
            # Check that default From was added
            call_kwargs = mock_http.post.call_args
            json_data = call_kwargs.kwargs["json"]
            assert json_data["messages"][0]["from"] == "TestSender"

    @pytest.mark.asyncio
    async def test_send_sms_simple(self, client):
        """Test simplified SMS send."""
        mock_response = MockResponse({
            "bulkId": "BULK-123",
            "messages": [
                {
                    "messageId": "MSG-123",
                    "to": "+1234567890",
                    "status": {
                        "groupId": 1,
                        "groupName": "PENDING",
                        "id": 7,
                        "name": "PENDING_ENROUTE",
                    },
                }
            ],
        })
        
        with patch.object(client, "_get_client") as mock_get_client:
            mock_http = AsyncMock()
            mock_http.post = AsyncMock(return_value=mock_response)
            mock_get_client.return_value = mock_http
            
            response = await client.send_sms_simple("+1234567890", "Hello!")
            
            assert response.bulk_id == "BULK-123"

    @pytest.mark.asyncio
    async def test_send_sms_multiple_recipients(self, client):
        """Test SMS to multiple recipients."""
        mock_response = MockResponse({
            "bulkId": "BULK-123",
            "messages": [
                {
                    "messageId": "MSG-1",
                    "to": "+1234567890",
                    "status": {"groupId": 1, "groupName": "PENDING", "id": 7, "name": "PENDING_ENROUTE"},
                },
                {
                    "messageId": "MSG-2",
                    "to": "+0987654321",
                    "status": {"groupId": 1, "groupName": "PENDING", "id": 7, "name": "PENDING_ENROUTE"},
                },
            ],
        })
        
        with patch.object(client, "_get_client") as mock_get_client:
            mock_http = AsyncMock()
            mock_http.post = AsyncMock(return_value=mock_response)
            mock_get_client.return_value = mock_http
            
            response = await client.send_sms_simple(
                ["+1234567890", "+0987654321"],
                "Hello everyone!"
            )
            
            assert len(response.messages) == 2

    @pytest.mark.asyncio
    async def test_get_delivery_reports(self, client):
        """Test getting delivery reports."""
        mock_response = MockResponse({
            "results": [
                {
                    "messageId": "MSG-123",
                    "to": "+1234567890",
                    "sentAt": "2024-01-15T10:00:00.000+0000",
                    "doneAt": "2024-01-15T10:00:05.000+0000",
                    "smsCount": 1,
                    "price": {
                        "pricePerMessage": 0.01,
                        "currency": "USD",
                    },
                    "status": {
                        "groupId": 3,
                        "groupName": "DELIVERED",
                        "id": 5,
                        "name": "DELIVERED_TO_HANDSET",
                        "description": "Message delivered to handset",
                    },
                }
            ],
        })
        
        with patch.object(client, "_get_client") as mock_get_client:
            mock_http = AsyncMock()
            mock_http.get = AsyncMock(return_value=mock_response)
            mock_get_client.return_value = mock_http
            
            reports = await client.get_delivery_reports(bulk_id="BULK-123")
            
            assert len(reports.results) == 1
            assert reports.results[0].message_id == "MSG-123"
            assert reports.results[0].status.group_name == "DELIVERED"


class TestInfobipClientMMS:
    """Tests for MMS operations."""

    @pytest.mark.asyncio
    async def test_send_mms_success(self, client):
        """Test successful MMS send."""
        mock_response = MockResponse({
            "bulkId": "BULK-MMS-123",
            "messages": [
                {
                    "messageId": "MMS-123",
                    "to": "+1234567890",
                    "status": {
                        "groupId": 1,
                        "groupName": "PENDING",
                        "id": 7,
                        "name": "PENDING_ENROUTE",
                    },
                }
            ],
        })
        
        with patch.object(client, "_get_client") as mock_get_client:
            mock_http = AsyncMock()
            mock_http.post = AsyncMock(return_value=mock_response)
            mock_get_client.return_value = mock_http
            
            response = await client.send_mms(
                InfobipMMSMessage(
                    destinations=[InfobipDestination(to="+1234567890")],
                    text="Check this!",
                    content=[
                        InfobipMMSContent(
                            content_type="image/jpeg",
                            content_id="img1",
                            content_url="https://example.com/img.jpg",
                        )
                    ],
                )
            )
            
            assert response.bulk_id == "BULK-MMS-123"
            assert len(response.messages) == 1


class TestInfobipClientWhatsApp:
    """Tests for WhatsApp operations."""

    @pytest.mark.asyncio
    async def test_send_whatsapp_text_success(self, client):
        """Test successful WhatsApp text send."""
        mock_response = MockResponse({
            "messages": [
                {
                    "messageId": "WA-123",
                    "to": "+1234567890",
                    "status": {
                        "groupId": 1,
                        "groupName": "PENDING",
                        "id": 7,
                        "name": "PENDING_ENROUTE",
                    },
                }
            ],
        })
        
        with patch.object(client, "_get_client") as mock_get_client:
            mock_http = AsyncMock()
            mock_http.post = AsyncMock(return_value=mock_response)
            mock_get_client.return_value = mock_http
            
            response = await client.send_whatsapp_text(
                InfobipWhatsAppTextMessage(
                    to="+1234567890",
                    text="Hello WhatsApp!"
                )
            )
            
            assert len(response.messages) == 1
            assert response.messages[0].message_id == "WA-123"

    @pytest.mark.asyncio
    async def test_send_whatsapp_applies_default_from(self, client):
        """Test WhatsApp uses default sender number."""
        mock_response = MockResponse({
            "messages": [
                {
                    "messageId": "WA-123",
                    "to": "+1234567890",
                    "status": {
                        "groupId": 1,
                        "groupName": "PENDING",
                        "id": 7,
                        "name": "PENDING_ENROUTE",
                    },
                }
            ],
        })
        
        with patch.object(client, "_get_client") as mock_get_client:
            mock_http = AsyncMock()
            mock_http.post = AsyncMock(return_value=mock_response)
            mock_get_client.return_value = mock_http
            
            await client.send_whatsapp_text(
                InfobipWhatsAppTextMessage(
                    to="+1234567890",
                    text="Test"
                )
            )
            
            call_kwargs = mock_http.post.call_args
            assert call_kwargs.kwargs["json"]["from"] == "+15559876543"

    @pytest.mark.asyncio
    async def test_send_whatsapp_template_success(self, client):
        """Test successful WhatsApp template send."""
        mock_response = MockResponse({
            "messages": [
                {
                    "messageId": "WA-TPL-123",
                    "to": "+1234567890",
                    "status": {
                        "groupId": 1,
                        "groupName": "PENDING",
                        "id": 7,
                        "name": "PENDING_ENROUTE",
                    },
                }
            ],
        })
        
        with patch.object(client, "_get_client") as mock_get_client:
            mock_http = AsyncMock()
            mock_http.post = AsyncMock(return_value=mock_response)
            mock_get_client.return_value = mock_http
            
            response = await client.send_whatsapp_template(
                InfobipWhatsAppTemplateMessage(
                    to="+1234567890",
                    template_name="order_confirmation",
                    template_data={"body": {"placeholders": ["John"]}},
                )
            )
            
            assert len(response.messages) == 1
            assert response.messages[0].message_id == "WA-TPL-123"

    @pytest.mark.asyncio
    async def test_send_whatsapp_media_image(self, client):
        """Test sending WhatsApp image."""
        mock_response = MockResponse({
            "messages": [
                {
                    "messageId": "WA-IMG-123",
                    "to": "+1234567890",
                    "status": {
                        "groupId": 1,
                        "groupName": "PENDING",
                        "id": 7,
                        "name": "PENDING_ENROUTE",
                    },
                }
            ],
        })
        
        with patch.object(client, "_get_client") as mock_get_client:
            mock_http = AsyncMock()
            mock_http.post = AsyncMock(return_value=mock_response)
            mock_get_client.return_value = mock_http
            
            response = await client.send_whatsapp_media(
                InfobipWhatsAppMediaMessage(
                    to="+1234567890",
                    media_type="image",
                    media_url="https://example.com/image.jpg",
                    caption="Check this out!",
                )
            )
            
            assert len(response.messages) == 1
            # Verify correct endpoint was called
            call_args = mock_http.post.call_args
            assert "/whatsapp/1/message/image" in call_args.args[0]

    @pytest.mark.asyncio
    async def test_send_whatsapp_simple(self, client):
        """Test simplified WhatsApp send."""
        mock_response = MockResponse({
            "messages": [
                {
                    "messageId": "WA-123",
                    "to": "+1234567890",
                    "status": {
                        "groupId": 1,
                        "groupName": "PENDING",
                        "id": 7,
                        "name": "PENDING_ENROUTE",
                    },
                }
            ],
        })
        
        with patch.object(client, "_get_client") as mock_get_client:
            mock_http = AsyncMock()
            mock_http.post = AsyncMock(return_value=mock_response)
            mock_get_client.return_value = mock_http
            
            response = await client.send_whatsapp_simple("+1234567890", "Hello!")
            
            assert len(response.messages) == 1


class TestInfobipClientViber:
    """Tests for Viber operations."""

    @pytest.mark.asyncio
    async def test_send_viber_success(self, client):
        """Test successful Viber send."""
        mock_response = MockResponse({
            "bulkId": "VIBER-BULK-123",
            "messages": [
                {
                    "messageId": "VIBER-123",
                    "to": "+1234567890",
                    "status": {
                        "groupId": 1,
                        "groupName": "PENDING",
                        "id": 7,
                        "name": "PENDING_ENROUTE",
                    },
                }
            ],
        })
        
        with patch.object(client, "_get_client") as mock_get_client:
            mock_http = AsyncMock()
            mock_http.post = AsyncMock(return_value=mock_response)
            mock_get_client.return_value = mock_http
            
            response = await client.send_viber(
                InfobipViberMessage(
                    to="+1234567890",
                    text="Hello Viber!"
                )
            )
            
            assert response.bulk_id == "VIBER-BULK-123"
            assert len(response.messages) == 1

    @pytest.mark.asyncio
    async def test_send_viber_with_button(self, client):
        """Test Viber with button."""
        mock_response = MockResponse({
            "bulkId": "VIBER-BULK-123",
            "messages": [
                {
                    "messageId": "VIBER-123",
                    "to": "+1234567890",
                    "status": {
                        "groupId": 1,
                        "groupName": "PENDING",
                        "id": 7,
                        "name": "PENDING_ENROUTE",
                    },
                }
            ],
        })
        
        with patch.object(client, "_get_client") as mock_get_client:
            mock_http = AsyncMock()
            mock_http.post = AsyncMock(return_value=mock_response)
            mock_get_client.return_value = mock_http
            
            response = await client.send_viber_simple(
                to="+1234567890",
                text="Check out our site!",
                button_text="Visit",
                button_url="https://example.com",
            )
            
            assert response.bulk_id == "VIBER-BULK-123"

    @pytest.mark.asyncio
    async def test_send_viber_applies_default_from(self, client):
        """Test Viber uses default sender."""
        mock_response = MockResponse({
            "bulkId": "VIBER-BULK-123",
            "messages": [
                {
                    "messageId": "VIBER-123",
                    "to": "+1234567890",
                    "status": {
                        "groupId": 1,
                        "groupName": "PENDING",
                        "id": 7,
                        "name": "PENDING_ENROUTE",
                    },
                }
            ],
        })
        
        with patch.object(client, "_get_client") as mock_get_client:
            mock_http = AsyncMock()
            mock_http.post = AsyncMock(return_value=mock_response)
            mock_get_client.return_value = mock_http
            
            await client.send_viber(
                InfobipViberMessage(
                    to="+1234567890",
                    text="Test"
                )
            )
            
            call_kwargs = mock_http.post.call_args
            assert call_kwargs.kwargs["json"]["messages"][0]["from"] == "ViberService"


class TestInfobipClientErrors:
    """Tests for error handling."""

    @pytest.mark.asyncio
    async def test_api_error_handling(self, client):
        """Test handling of API errors."""
        mock_response = MockResponse(
            data={
                "requestError": {
                    "serviceException": {
                        "messageId": "BAD_REQUEST",
                        "text": "Invalid 'to' phone number",
                    }
                }
            },
            status_code=400,
        )
        
        with patch.object(client, "_get_client") as mock_get_client:
            mock_http = AsyncMock()
            mock_http.post = AsyncMock(return_value=mock_response)
            mock_get_client.return_value = mock_http
            
            with pytest.raises(InfobipClientError) as exc_info:
                await client.send_sms(
                    InfobipSMSMessage(
                        destinations=[InfobipDestination(to="invalid")],
                        text="Test"
                    )
                )
            
            assert exc_info.value.status_code == 400
            assert "Invalid 'to' phone number" in str(exc_info.value)

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
            
            with pytest.raises(InfobipClientError) as exc_info:
                await client.send_sms(
                    InfobipSMSMessage(
                        destinations=[InfobipDestination(to="+1234567890")],
                        text="Test"
                    )
                )
            
            assert exc_info.value.status_code == 500

    @pytest.mark.asyncio
    async def test_unauthorized_error(self, client):
        """Test handling of authentication errors."""
        mock_response = MockResponse(
            data={
                "requestError": {
                    "serviceException": {
                        "messageId": "UNAUTHORIZED",
                        "text": "Invalid API key",
                    }
                }
            },
            status_code=401,
        )
        
        with patch.object(client, "_get_client") as mock_get_client:
            mock_http = AsyncMock()
            mock_http.post = AsyncMock(return_value=mock_response)
            mock_get_client.return_value = mock_http
            
            with pytest.raises(InfobipClientError) as exc_info:
                await client.send_sms(
                    InfobipSMSMessage(
                        destinations=[InfobipDestination(to="+1234567890")],
                        text="Test"
                    )
                )
            
            assert exc_info.value.status_code == 401


class TestInfobipClientContextManager:
    """Tests for context manager functionality."""

    @pytest.mark.asyncio
    async def test_async_context_manager(self, config):
        """Test client works as async context manager."""
        async with InfobipClient(config) as client:
            assert client.config == config
        
        # Client should be closed after exiting context

    @pytest.mark.asyncio
    async def test_close_method(self, client):
        """Test close method."""
        # Should not raise even if client wasn't opened
        await client.close()


class TestInfobipClientUtility:
    """Tests for utility methods."""

    @pytest.mark.asyncio
    async def test_get_account_balance(self, client):
        """Test getting account balance."""
        mock_response = MockResponse({
            "balance": 100.50,
            "currency": "USD",
        })
        
        with patch.object(client, "_get_client") as mock_get_client:
            mock_http = AsyncMock()
            mock_http.get = AsyncMock(return_value=mock_response)
            mock_get_client.return_value = mock_http
            
            balance = await client.get_account_balance()
            
            assert balance["balance"] == 100.50
            assert balance["currency"] == "USD"

