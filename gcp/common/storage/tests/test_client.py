"""
Tests for StorageClient.

Note: These are basic unit tests. Integration tests require real GCP credentials.
"""

import pytest
from unittest.mock import Mock, AsyncMock, patch, MagicMock
from datetime import datetime

from ..client import (
    StorageClient,
    StorageError,
    _is_valid_service_account_email,
    _resolve_runtime_service_account_email,
)
from ..config import StorageConfig
from ..models import (
    Bucket,
    Blob,
    BucketMetadata,
    BlobMetadata,
    UploadConfig,
    SignedUrlConfig,
)


@pytest.fixture
def config():
    """Create a test configuration."""
    return StorageConfig(
        project_id="test-project",
        bucket_name="test-bucket",
        location="us-central1",
    )


@pytest.fixture
def client(config):
    """Create a test client."""
    return StorageClient(config)


@pytest.mark.asyncio
async def test_create_bucket(client, config):
    """Test creating a bucket."""
    with patch.object(client, '_get_client') as mock_get_client:
        mock_storage_client = Mock()
        mock_bucket = Mock()
        mock_bucket.location = config.location
        mock_bucket.storage_class = None
        mock_bucket.labels = None
        mock_bucket.versioning_enabled = None
        mock_bucket.time_created = datetime.now()
        mock_bucket.updated = datetime.now()
        mock_bucket.create = Mock()
        
        mock_storage_client.bucket.return_value = mock_bucket
        mock_get_client.return_value = mock_storage_client
        
        bucket = await client.create_bucket("test-bucket")
        
        assert bucket.name == "test-bucket"
        assert bucket.metadata is not None
        mock_bucket.create.assert_called_once()


@pytest.mark.asyncio
async def test_list_buckets(client):
    """Test listing buckets."""
    with patch.object(client, '_get_client') as mock_get_client:
        mock_storage_client = Mock()
        mock_bucket1 = Mock()
        mock_bucket1.name = "bucket1"
        mock_bucket1.location = "us-central1"
        mock_bucket1.storage_class = "STANDARD"
        mock_bucket1.time_created = datetime.now()
        mock_bucket1.updated = datetime.now()
        mock_bucket1.labels = {}
        mock_bucket1.versioning_enabled = False
        
        mock_bucket2 = Mock()
        mock_bucket2.name = "bucket2"
        mock_bucket2.location = "us-east1"
        mock_bucket2.storage_class = "NEARLINE"
        mock_bucket2.time_created = datetime.now()
        mock_bucket2.updated = datetime.now()
        mock_bucket2.labels = {}
        mock_bucket2.versioning_enabled = False
        
        mock_storage_client.list_buckets.return_value = [mock_bucket1, mock_bucket2]
        mock_get_client.return_value = mock_storage_client
        
        buckets = await client.list_buckets()
        
        assert len(buckets) == 2
        assert buckets[0].name == "bucket1"
        assert buckets[1].name == "bucket2"


@pytest.mark.asyncio
async def test_get_bucket(client):
    """Test getting a bucket."""
    with patch.object(client, '_get_client') as mock_get_client:
        mock_storage_client = Mock()
        mock_bucket = Mock()
        mock_bucket.name = "test-bucket"
        mock_bucket.location = "us-central1"
        mock_bucket.storage_class = "STANDARD"
        mock_bucket.time_created = datetime.now()
        mock_bucket.updated = datetime.now()
        mock_bucket.labels = {}
        mock_bucket.versioning_enabled = False
        mock_bucket.reload = Mock()
        
        mock_storage_client.bucket.return_value = mock_bucket
        mock_get_client.return_value = mock_storage_client
        
        bucket = await client.get_bucket("test-bucket")
        
        assert bucket.name == "test-bucket"
        mock_bucket.reload.assert_called_once()


@pytest.mark.asyncio
async def test_delete_bucket(client):
    """Test deleting a bucket."""
    with patch.object(client, '_get_client') as mock_get_client:
        mock_storage_client = Mock()
        mock_bucket = Mock()
        mock_bucket.delete = Mock()
        mock_bucket.list_blobs.return_value = []
        
        mock_storage_client.bucket.return_value = mock_bucket
        mock_get_client.return_value = mock_storage_client
        
        await client.delete_bucket("test-bucket")
        
        mock_bucket.delete.assert_called_once()


@pytest.mark.asyncio
async def test_upload_blob_from_file(client):
    """Test uploading a blob from a file path."""
    with patch.object(client, '_get_client') as mock_get_client, \
         patch('pathlib.Path.exists', return_value=True):
        mock_storage_client = Mock()
        mock_bucket = Mock()
        mock_blob = Mock()
        mock_blob.name = "test.txt"
        mock_blob.size = 100
        mock_blob.content_type = "text/plain"
        mock_blob.etag = "etag123"
        mock_blob.md5_hash = "hash123"
        mock_blob.crc32c = "crc123"
        mock_blob.time_created = datetime.now()
        mock_blob.updated = datetime.now()
        mock_blob.time_deleted = None
        mock_blob.metadata = {}
        mock_blob.cache_control = None
        mock_blob.content_disposition = None
        mock_blob.content_encoding = None
        mock_blob.content_language = None
        mock_blob.storage_class = "STANDARD"
        mock_blob.generation = 1
        mock_blob.metageneration = 1
        mock_blob.upload_from_filename = Mock()
        mock_blob.reload = Mock()
        
        mock_bucket.blob.return_value = mock_blob
        mock_storage_client.bucket.return_value = mock_bucket
        mock_get_client.return_value = mock_storage_client
        
        blob = await client.upload_blob(
            bucket_name="test-bucket",
            blob_name="test.txt",
            file="test_file.txt"
        )
        
        assert blob.name == "test.txt"
        assert blob.bucket == "test-bucket"
        mock_blob.upload_from_filename.assert_called_once()


@pytest.mark.asyncio
async def test_upload_blob_from_bytes(client):
    """Test uploading a blob from bytes."""
    with patch.object(client, '_get_client') as mock_get_client:
        mock_storage_client = Mock()
        mock_bucket = Mock()
        mock_blob = Mock()
        mock_blob.name = "test.txt"
        mock_blob.size = 13
        mock_blob.content_type = "text/plain"
        mock_blob.etag = "etag123"
        mock_blob.md5_hash = "hash123"
        mock_blob.crc32c = "crc123"
        mock_blob.time_created = datetime.now()
        mock_blob.updated = datetime.now()
        mock_blob.time_deleted = None
        mock_blob.metadata = {}
        mock_blob.cache_control = None
        mock_blob.content_disposition = None
        mock_blob.content_encoding = None
        mock_blob.content_language = None
        mock_blob.storage_class = "STANDARD"
        mock_blob.generation = 1
        mock_blob.metageneration = 1
        mock_blob.upload_from_string = Mock()
        mock_blob.reload = Mock()
        
        mock_bucket.blob.return_value = mock_blob
        mock_storage_client.bucket.return_value = mock_bucket
        mock_get_client.return_value = mock_storage_client
        
        blob = await client.upload_blob(
            bucket_name="test-bucket",
            blob_name="test.txt",
            file=b"Hello, World!"
        )
        
        assert blob.name == "test.txt"
        mock_blob.upload_from_string.assert_called_once()


@pytest.mark.asyncio
async def test_download_blob_to_bytes(client):
    """Test downloading a blob to bytes."""
    with patch.object(client, '_get_client') as mock_get_client:
        mock_storage_client = Mock()
        mock_bucket = Mock()
        mock_blob = Mock()
        mock_blob.download_as_bytes.return_value = b"Hello, World!"
        
        mock_bucket.blob.return_value = mock_blob
        mock_storage_client.bucket.return_value = mock_bucket
        mock_get_client.return_value = mock_storage_client
        
        content = await client.download_blob(
            bucket_name="test-bucket",
            blob_name="test.txt"
        )
        
        assert content == b"Hello, World!"
        mock_blob.download_as_bytes.assert_called_once()


@pytest.mark.asyncio
async def test_list_blobs(client):
    """Test listing blobs."""
    with patch.object(client, '_get_client') as mock_get_client:
        mock_storage_client = Mock()
        mock_bucket = Mock()
        mock_blob1 = Mock()
        mock_blob1.name = "file1.txt"
        mock_blob1.size = 100
        mock_blob1.content_type = "text/plain"
        mock_blob1.etag = "etag1"
        mock_blob1.md5_hash = "hash1"
        mock_blob1.crc32c = "crc1"
        mock_blob1.time_created = datetime.now()
        mock_blob1.updated = datetime.now()
        mock_blob1.time_deleted = None
        mock_blob1.metadata = {}
        mock_blob1.cache_control = None
        mock_blob1.content_disposition = None
        mock_blob1.content_encoding = None
        mock_blob1.content_language = None
        mock_blob1.storage_class = "STANDARD"
        mock_blob1.generation = 1
        mock_blob1.metageneration = 1
        
        mock_blob2 = Mock()
        mock_blob2.name = "file2.txt"
        mock_blob2.size = 200
        mock_blob2.content_type = "text/plain"
        mock_blob2.etag = "etag2"
        mock_blob2.md5_hash = "hash2"
        mock_blob2.crc32c = "crc2"
        mock_blob2.time_created = datetime.now()
        mock_blob2.updated = datetime.now()
        mock_blob2.time_deleted = None
        mock_blob2.metadata = {}
        mock_blob2.cache_control = None
        mock_blob2.content_disposition = None
        mock_blob2.content_encoding = None
        mock_blob2.content_language = None
        mock_blob2.storage_class = "STANDARD"
        mock_blob2.generation = 1
        mock_blob2.metageneration = 1
        
        mock_bucket.list_blobs.return_value = [mock_blob1, mock_blob2]
        mock_storage_client.bucket.return_value = mock_bucket
        mock_get_client.return_value = mock_storage_client
        
        blobs = await client.list_blobs("test-bucket")
        
        assert len(blobs) == 2
        assert blobs[0].name == "file1.txt"
        assert blobs[1].name == "file2.txt"


@pytest.mark.asyncio
async def test_delete_blob(client):
    """Test deleting a blob."""
    with patch.object(client, '_get_client') as mock_get_client:
        mock_storage_client = Mock()
        mock_bucket = Mock()
        mock_blob = Mock()
        mock_blob.delete = Mock()
        
        mock_bucket.blob.return_value = mock_blob
        mock_storage_client.bucket.return_value = mock_bucket
        mock_get_client.return_value = mock_storage_client
        
        await client.delete_blob("test-bucket", "test.txt")
        
        mock_blob.delete.assert_called_once()


@pytest.mark.asyncio
async def test_copy_blob(client):
    """Test copying a blob."""
    with patch.object(client, '_get_client') as mock_get_client:
        mock_storage_client = Mock()
        mock_source_bucket = Mock()
        mock_dest_bucket = Mock()
        mock_source_blob = Mock()
        mock_new_blob = Mock()
        mock_new_blob.name = "copied.txt"
        mock_new_blob.size = 100
        mock_new_blob.content_type = "text/plain"
        mock_new_blob.etag = "etag123"
        mock_new_blob.md5_hash = "hash123"
        mock_new_blob.crc32c = "crc123"
        mock_new_blob.time_created = datetime.now()
        mock_new_blob.updated = datetime.now()
        mock_new_blob.time_deleted = None
        mock_new_blob.metadata = {}
        mock_new_blob.cache_control = None
        mock_new_blob.content_disposition = None
        mock_new_blob.content_encoding = None
        mock_new_blob.content_language = None
        mock_new_blob.storage_class = "STANDARD"
        mock_new_blob.generation = 1
        mock_new_blob.metageneration = 1
        mock_new_blob.patch = Mock()
        mock_new_blob.reload = Mock()
        
        mock_source_bucket.blob.return_value = mock_source_blob
        mock_source_bucket.copy_blob.return_value = mock_new_blob
        mock_storage_client.bucket.side_effect = [mock_source_bucket, mock_dest_bucket]
        mock_get_client.return_value = mock_storage_client
        
        blob = await client.copy_blob(
            source_bucket_name="source-bucket",
            source_blob_name="source.txt",
            destination_bucket_name="dest-bucket",
            destination_blob_name="copied.txt"
        )
        
        assert blob.name == "copied.txt"
        assert blob.bucket == "dest-bucket"


def test_is_valid_service_account_email():
    assert _is_valid_service_account_email(
        "githubworkflowdeployment@homegeek-staging.iam.gserviceaccount.com"
    )
    assert not _is_valid_service_account_email("default")
    assert not _is_valid_service_account_email("")
    assert not _is_valid_service_account_email(None)


def test_resolve_runtime_service_account_email_prefers_env(monkeypatch):
    monkeypatch.setenv(
        "GCP_SERVICE_ACCOUNT_EMAIL",
        "githubworkflowdeployment@homegeek-staging.iam.gserviceaccount.com",
    )
    creds = Mock()
    creds.service_account_email = "default"
    assert (
        _resolve_runtime_service_account_email(creds)
        == "githubworkflowdeployment@homegeek-staging.iam.gserviceaccount.com"
    )


def test_resolve_runtime_service_account_email_rejects_default_credentials(monkeypatch):
    monkeypatch.delenv("GCP_SERVICE_ACCOUNT_EMAIL", raising=False)
    monkeypatch.delenv("GCS_SIGNING_SERVICE_ACCOUNT", raising=False)
    creds = Mock()
    creds.service_account_email = "default"
    with patch("urllib.request.urlopen") as mock_urlopen:
        mock_urlopen.return_value.__enter__.return_value.read.return_value = (
            b"githubworkflowdeployment@homegeek-staging.iam.gserviceaccount.com"
        )
        assert (
            _resolve_runtime_service_account_email(creds)
            == "githubworkflowdeployment@homegeek-staging.iam.gserviceaccount.com"
        )


@pytest.mark.asyncio
async def test_generate_signed_url(client):
    """Test generating a signed URL."""
    mock_creds = Mock()
    mock_creds.signer = Mock()
    with patch("google.auth.default", return_value=(mock_creds, "test-project")), patch.object(
        client, "_get_client"
    ) as mock_get_client:
        mock_storage_client = Mock()
        mock_bucket = Mock()
        mock_blob = Mock()
        mock_blob.generate_signed_url.return_value = "https://storage.googleapis.com/test-bucket/test.txt?signature=..."
        
        mock_bucket.blob.return_value = mock_blob
        mock_storage_client.bucket.return_value = mock_bucket
        mock_get_client.return_value = mock_storage_client
        
        url = await client.generate_signed_url(
            bucket_name="test-bucket",
            blob_name="test.txt",
            signed_url_config=SignedUrlConfig(expiration=3600)
        )
        
        assert url.startswith("https://")
        mock_blob.generate_signed_url.assert_called_once()


@pytest.mark.asyncio
async def test_storage_error_handling(client):
    """Test error handling."""
    with patch.object(client, '_get_client') as mock_get_client:
        mock_storage_client = Mock()
        mock_storage_client.bucket.side_effect = Exception("Bucket not found")
        mock_get_client.return_value = mock_storage_client
        
        with pytest.raises(StorageError) as exc_info:
            await client.get_bucket("nonexistent-bucket")
        
        assert "Failed to get bucket" in str(exc_info.value)
        assert exc_info.value.details["bucket_name"] == "nonexistent-bucket"


@pytest.mark.asyncio
async def test_client_context_manager(client):
    """Test client context manager."""
    async with client:
        assert client._client is not None
    
    # After context exit, client should be reset
    assert client._client is None

