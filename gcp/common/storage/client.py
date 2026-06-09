"""
GCP Storage Client for Cloud Storage CRUD operations.

Provides async methods for:
- Bucket management (create, list, get, delete)
- Blob operations (upload, download, list, get, delete, copy)
- Signed URL generation
"""

import asyncio
import logging
import os
from typing import Optional, Dict, Any, Union, BinaryIO, List
from pathlib import Path
from io import BytesIO

from .config import StorageConfig
from .models import (
    Bucket,
    Blob,
    BucketMetadata,
    BlobMetadata,
    UploadConfig,
    DownloadConfig,
    CopyConfig,
    SignedUrlConfig,
)

logger = logging.getLogger(__name__)


def _is_valid_service_account_email(email: Optional[str]) -> bool:
    """Reject metadata placeholder / unset values (e.g. compute_engine default)."""
    if not email:
        return False
    normalized = email.strip()
    return normalized != "default" and "@" in normalized


def _resolve_gcs_signing_service_account() -> Optional[str]:
    for key in (
        "GCS_SIGNING_SERVICE_ACCOUNT",
        "GCP_SERVICE_ACCOUNT_EMAIL",
    ):
        value = (os.environ.get(key) or "").strip()
        if _is_valid_service_account_email(value):
            return value
    return None


def _metadata_service_account_email() -> Optional[str]:
    """Attached service account on GCE / Cloud Run / Cloud Functions."""
    import urllib.error
    import urllib.request

    request = urllib.request.Request(
        "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/email",
        headers={"Metadata-Flavor": "Google"},
    )
    try:
        with urllib.request.urlopen(request, timeout=2) as response:
            email = response.read().decode("utf-8").strip()
    except (OSError, urllib.error.URLError, TimeoutError):
        return None
    return email if _is_valid_service_account_email(email) else None


def _resolve_runtime_service_account_email(credentials: Any) -> Optional[str]:
    from_env = _resolve_gcs_signing_service_account()
    if from_env:
        return from_env

    from_credentials = getattr(credentials, "service_account_email", None)
    if _is_valid_service_account_email(from_credentials):
        return from_credentials.strip()

    return _metadata_service_account_email()


def _blob_signed_url_kwargs(config: SignedUrlConfig) -> Dict[str, Any]:
    """
    Build kwargs for ``Blob.generate_signed_url``.

    User ADC (``gcloud auth application-default login``) has no private key;
    use IAM signBlob via ``service_account_email`` + ``access_token`` instead.
    """
    import google.auth
    from google.auth.transport import requests as auth_requests

    credentials, _ = google.auth.default()
    kwargs: Dict[str, Any] = {
        "expiration": config.expiration,
        "method": config.method,
        "content_type": config.content_type,
        "response_type": config.response_type,
        "response_disposition": config.response_disposition,
        "version": config.version,
    }

    if getattr(credentials, "signer", None) is not None:
        return kwargs

    service_account_email = _resolve_runtime_service_account_email(credentials)
    if not service_account_email:
        raise StorageError(
            "Signed URLs require a service account with signBlob. "
            "Set GCS_SIGNING_SERVICE_ACCOUNT or GCP_SERVICE_ACCOUNT_EMAIL, "
            "or use ADC impersonation for the runtime service account."
        )

    auth_request = auth_requests.Request()
    if not credentials.valid:
        credentials.refresh(auth_request)

    kwargs["service_account_email"] = service_account_email
    kwargs["access_token"] = credentials.token
    return kwargs


class StorageError(Exception):
    """Base exception for Storage client errors."""
    def __init__(
        self, 
        message: str, 
        status_code: Optional[int] = None, 
        details: Optional[Dict[str, Any]] = None
    ):
        super().__init__(message)
        self.status_code = status_code
        self.details = details or {}


class StorageClient:
    """
    Client for GCP Cloud Storage operations.
    
    Supports bucket and blob CRUD operations with async/await support.
    
    Example:
        config = StorageConfig.from_env()
        client = StorageClient(config)
        
        # Create a bucket
        bucket = await client.create_bucket("my-bucket")
        
        # Upload a file
        blob = await client.upload_blob(
            bucket_name="my-bucket",
            blob_name="file.txt",
            file_path="local_file.txt"
        )
        
        # Download a file
        content = await client.download_blob(
            bucket_name="my-bucket",
            blob_name="file.txt"
        )
    """
    
    def __init__(self, config: StorageConfig):
        """
        Initialize Storage client.
        
        Args:
            config: StorageConfig instance
        """
        self.config = config
        self._client = None
    
    def _get_client(self):
        """Get or create the Storage client."""
        if self._client is None:
            from google.cloud import storage
            
            if self.config.project_id:
                self._client = storage.Client(project=self.config.project_id)
            else:
                # Use default credentials (ADC)
                self._client = storage.Client()
        
        return self._client
    
    async def close(self):
        """Close the client connection."""
        # The storage.Client doesn't require explicit closing
        # but we reset the reference
        self._client = None
    
    async def __aenter__(self):
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.close()
    
    # Bucket operations
    
    async def create_bucket(
        self,
        bucket_name: str,
        location: Optional[str] = None,
        storage_class: Optional[str] = None,
        labels: Optional[Dict[str, str]] = None,
        versioning_enabled: Optional[bool] = None,
    ) -> Bucket:
        """
        Create a new bucket.
        
        Args:
            bucket_name: Name of the bucket (must be globally unique)
            location: Bucket location (default: from config)
            storage_class: Storage class (STANDARD, NEARLINE, COLDLINE, ARCHIVE)
            labels: Optional labels dictionary
            versioning_enabled: Whether to enable versioning
            
        Returns:
            Bucket: Created bucket
            
        Example:
            bucket = await client.create_bucket(
                bucket_name="my-bucket",
                location="us-central1"
            )
        """
        client = self._get_client()
        
        try:
            bucket = client.bucket(bucket_name)
            bucket.location = location or self.config.location
            
            if storage_class:
                bucket.storage_class = storage_class
            
            if labels:
                bucket.labels = labels
            
            if versioning_enabled is not None:
                bucket.versioning_enabled = versioning_enabled
            
            await asyncio.get_event_loop().run_in_executor(
                None,
                bucket.create
            )
            
            logger.info(f"Created bucket: {bucket_name}")
            
            return Bucket(
                name=bucket_name,
                metadata=BucketMetadata(
                    name=bucket_name,
                    location=bucket.location,
                    storage_class=bucket.storage_class,
                    created=bucket.time_created,
                    updated=bucket.updated,
                    labels=bucket.labels,
                    versioning_enabled=bucket.versioning_enabled,
                )
            )
            
        except Exception as e:
            logger.error(f"Failed to create bucket: {e}")
            raise StorageError(
                message=f"Failed to create bucket: {e}",
                details={"bucket_name": bucket_name}
            )
    
    async def list_buckets(self, project: Optional[str] = None) -> List[Bucket]:
        """
        List all buckets.
        
        Args:
            project: Project ID (default: from config or client)
            
        Returns:
            List[Bucket]: List of buckets
            
        Example:
            buckets = await client.list_buckets()
            for bucket in buckets:
                print(bucket.name)
        """
        client = self._get_client()
        
        try:
            buckets = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: list(client.list_buckets(project=project))
            )
            
            result = []
            for bucket in buckets:
                result.append(Bucket(
                    name=bucket.name,
                    metadata=BucketMetadata(
                        name=bucket.name,
                        location=bucket.location,
                        storage_class=bucket.storage_class,
                        created=bucket.time_created,
                        updated=bucket.updated,
                        labels=bucket.labels,
                        versioning_enabled=bucket.versioning_enabled,
                    )
                ))
            
            return result
            
        except Exception as e:
            logger.error(f"Failed to list buckets: {e}")
            raise StorageError(
                message=f"Failed to list buckets: {e}"
            )
    
    async def get_bucket(self, bucket_name: str) -> Bucket:
        """
        Get a bucket by name.
        
        Args:
            bucket_name: Name of the bucket
            
        Returns:
            Bucket: Bucket information
            
        Example:
            bucket = await client.get_bucket("my-bucket")
        """
        client = self._get_client()
        
        try:
            bucket = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: client.bucket(bucket_name)
            )
            
            # Reload to get metadata
            await asyncio.get_event_loop().run_in_executor(
                None,
                bucket.reload
            )
            
            return Bucket(
                name=bucket.name,
                metadata=BucketMetadata(
                    name=bucket.name,
                    location=bucket.location,
                    storage_class=bucket.storage_class,
                    created=bucket.time_created,
                    updated=bucket.updated,
                    labels=bucket.labels,
                    versioning_enabled=bucket.versioning_enabled,
                )
            )
            
        except Exception as e:
            logger.error(f"Failed to get bucket: {e}")
            raise StorageError(
                message=f"Failed to get bucket: {e}",
                details={"bucket_name": bucket_name}
            )
    
    async def delete_bucket(self, bucket_name: str, force: bool = False) -> None:
        """
        Delete a bucket.
        
        Args:
            bucket_name: Name of the bucket to delete
            force: If True, delete all blobs first (default: False)
            
        Example:
            await client.delete_bucket("my-bucket", force=True)
        """
        client = self._get_client()
        
        try:
            bucket = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: client.bucket(bucket_name)
            )
            
            if force:
                # Delete all blobs first
                blobs = await asyncio.get_event_loop().run_in_executor(
                    None,
                    lambda: list(bucket.list_blobs())
                )
                for blob in blobs:
                    await asyncio.get_event_loop().run_in_executor(
                        None,
                        blob.delete
                    )
            
            await asyncio.get_event_loop().run_in_executor(
                None,
                bucket.delete
            )
            
            logger.info(f"Deleted bucket: {bucket_name}")
            
        except Exception as e:
            logger.error(f"Failed to delete bucket: {e}")
            raise StorageError(
                message=f"Failed to delete bucket: {e}",
                details={"bucket_name": bucket_name}
            )
    
    # Blob operations
    
    async def upload_blob(
        self,
        bucket_name: str,
        blob_name: str,
        file: Union[str, Path, BinaryIO, bytes],
        upload_config: Optional[UploadConfig] = None,
    ) -> Blob:
        """
        Upload a blob to a bucket.
        
        Args:
            bucket_name: Name of the bucket
            blob_name: Name of the blob (path within bucket)
            file: File path (str/Path), file-like object, or bytes
            upload_config: Optional upload configuration
            
        Returns:
            Blob: Uploaded blob
            
        Example:
            blob = await client.upload_blob(
                bucket_name="my-bucket",
                blob_name="path/to/file.txt",
                file="local_file.txt"
            )
        """
        client = self._get_client()
        
        try:
            bucket = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: client.bucket(bucket_name)
            )
            
            blob = bucket.blob(blob_name)
            
            # Apply upload config
            if upload_config:
                if upload_config.content_type:
                    blob.content_type = upload_config.content_type
                if upload_config.metadata:
                    blob.metadata = upload_config.metadata
                if upload_config.cache_control:
                    blob.cache_control = upload_config.cache_control
                if upload_config.content_disposition:
                    blob.content_disposition = upload_config.content_disposition
                if upload_config.content_encoding:
                    blob.content_encoding = upload_config.content_encoding
                if upload_config.content_language:
                    blob.content_language = upload_config.content_language
            
            # Handle different file types
            if isinstance(file, (str, Path)):
                file_path = Path(file)
                if not file_path.exists():
                    raise FileNotFoundError(f"File not found: {file_path}")
                
                await asyncio.get_event_loop().run_in_executor(
                    None,
                    lambda: blob.upload_from_filename(str(file_path))
                )
            elif isinstance(file, bytes):
                await asyncio.get_event_loop().run_in_executor(
                    None,
                    lambda: blob.upload_from_string(file, content_type=upload_config.content_type if upload_config else None)
                )
            else:
                # File-like object
                await asyncio.get_event_loop().run_in_executor(
                    None,
                    lambda: blob.upload_from_file(file, rewind=True)
                )
            
            # Reload to get metadata
            await asyncio.get_event_loop().run_in_executor(
                None,
                blob.reload
            )
            
            logger.info(f"Uploaded blob: {bucket_name}/{blob_name}")
            
            return Blob(
                name=blob_name,
                bucket=bucket_name,
                metadata=BlobMetadata(
                    name=blob_name,
                    bucket=bucket_name,
                    size=blob.size,
                    content_type=blob.content_type,
                    etag=blob.etag,
                    md5_hash=blob.md5_hash,
                    crc32c=blob.crc32c,
                    created=blob.time_created,
                    updated=blob.updated,
                    time_deleted=blob.time_deleted,
                    metadata=blob.metadata,
                    cache_control=blob.cache_control,
                    content_disposition=blob.content_disposition,
                    content_encoding=blob.content_encoding,
                    content_language=blob.content_language,
                    storage_class=blob.storage_class,
                    generation=blob.generation,
                    metageneration=blob.metageneration,
                )
            )
            
        except Exception as e:
            logger.error(f"Failed to upload blob: {e}")
            raise StorageError(
                message=f"Failed to upload blob: {e}",
                details={
                    "bucket_name": bucket_name,
                    "blob_name": blob_name
                }
            )
    
    async def download_blob(
        self,
        bucket_name: str,
        blob_name: str,
        destination: Optional[Union[str, Path, BinaryIO]] = None,
        download_config: Optional[DownloadConfig] = None,
    ) -> Union[bytes, None]:
        """
        Download a blob from a bucket.
        
        Args:
            bucket_name: Name of the bucket
            blob_name: Name of the blob
            destination: Optional destination (file path or file-like object).
                        If None, returns bytes.
            download_config: Optional download configuration
            
        Returns:
            bytes if destination is None, None otherwise
            
        Example:
            # Download to bytes
            content = await client.download_blob("my-bucket", "file.txt")
            
            # Download to file
            await client.download_blob("my-bucket", "file.txt", "local_file.txt")
        """
        client = self._get_client()
        
        try:
            bucket = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: client.bucket(bucket_name)
            )
            
            blob = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: bucket.blob(blob_name)
            )
            
            if destination is None:
                # Return bytes
                content = await asyncio.get_event_loop().run_in_executor(
                    None,
                    blob.download_as_bytes
                )
                logger.info(f"Downloaded blob: {bucket_name}/{blob_name}")
                return content
            elif isinstance(destination, (str, Path)):
                # Download to file
                await asyncio.get_event_loop().run_in_executor(
                    None,
                    lambda: blob.download_to_filename(str(destination))
                )
                logger.info(f"Downloaded blob to file: {bucket_name}/{blob_name} -> {destination}")
                return None
            else:
                # Download to file-like object
                await asyncio.get_event_loop().run_in_executor(
                    None,
                    lambda: blob.download_to_file(destination)
                )
                logger.info(f"Downloaded blob to file object: {bucket_name}/{blob_name}")
                return None
                
        except Exception as e:
            logger.error(f"Failed to download blob: {e}")
            raise StorageError(
                message=f"Failed to download blob: {e}",
                details={
                    "bucket_name": bucket_name,
                    "blob_name": blob_name
                }
            )
    
    async def list_blobs(
        self,
        bucket_name: str,
        prefix: Optional[str] = None,
        delimiter: Optional[str] = None,
        max_results: Optional[int] = None,
    ) -> List[Blob]:
        """
        List blobs in a bucket.
        
        Args:
            bucket_name: Name of the bucket
            prefix: Optional prefix to filter blobs
            delimiter: Optional delimiter for folder-like listing
            max_results: Optional maximum number of results
            
        Returns:
            List[Blob]: List of blobs
            
        Example:
            blobs = await client.list_blobs("my-bucket", prefix="folder/")
            for blob in blobs:
                print(blob.name)
        """
        client = self._get_client()
        
        try:
            bucket = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: client.bucket(bucket_name)
            )
            
            kwargs = {}
            if prefix:
                kwargs["prefix"] = prefix
            if delimiter:
                kwargs["delimiter"] = delimiter
            if max_results:
                kwargs["max_results"] = max_results
            
            blobs = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: list(bucket.list_blobs(**kwargs))
            )
            
            result = []
            for blob in blobs:
                result.append(Blob(
                    name=blob.name,
                    bucket=bucket_name,
                    metadata=BlobMetadata(
                        name=blob.name,
                        bucket=bucket_name,
                        size=blob.size,
                        content_type=blob.content_type,
                        etag=blob.etag,
                        md5_hash=blob.md5_hash,
                        crc32c=blob.crc32c,
                        created=blob.time_created,
                        updated=blob.updated,
                        time_deleted=blob.time_deleted,
                        metadata=blob.metadata,
                        cache_control=blob.cache_control,
                        content_disposition=blob.content_disposition,
                        content_encoding=blob.content_encoding,
                        content_language=blob.content_language,
                        storage_class=blob.storage_class,
                        generation=blob.generation,
                        metageneration=blob.metageneration,
                    )
                ))
            
            return result
            
        except Exception as e:
            logger.error(f"Failed to list blobs: {e}")
            raise StorageError(
                message=f"Failed to list blobs: {e}",
                details={"bucket_name": bucket_name}
            )
    
    async def get_blob(self, bucket_name: str, blob_name: str) -> Blob:
        """
        Get a blob by name.
        
        Args:
            bucket_name: Name of the bucket
            blob_name: Name of the blob
            
        Returns:
            Blob: Blob information
            
        Example:
            blob = await client.get_blob("my-bucket", "file.txt")
        """
        client = self._get_client()
        
        try:
            bucket = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: client.bucket(bucket_name)
            )
            
            blob = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: bucket.blob(blob_name)
            )
            
            # Reload to get metadata
            await asyncio.get_event_loop().run_in_executor(
                None,
                blob.reload
            )
            
            return Blob(
                name=blob_name,
                bucket=bucket_name,
                metadata=BlobMetadata(
                    name=blob.name,
                    bucket=bucket_name,
                    size=blob.size,
                    content_type=blob.content_type,
                    etag=blob.etag,
                    md5_hash=blob.md5_hash,
                    crc32c=blob.crc32c,
                    created=blob.time_created,
                    updated=blob.updated,
                    time_deleted=blob.time_deleted,
                    metadata=blob.metadata,
                    cache_control=blob.cache_control,
                    content_disposition=blob.content_disposition,
                    content_encoding=blob.content_encoding,
                    content_language=blob.content_language,
                    storage_class=blob.storage_class,
                    generation=blob.generation,
                    metageneration=blob.metageneration,
                )
            )
            
        except Exception as e:
            logger.error(f"Failed to get blob: {e}")
            raise StorageError(
                message=f"Failed to get blob: {e}",
                details={
                    "bucket_name": bucket_name,
                    "blob_name": blob_name
                }
            )
    
    async def delete_blob(self, bucket_name: str, blob_name: str) -> None:
        """
        Delete a blob.
        
        Args:
            bucket_name: Name of the bucket
            blob_name: Name of the blob to delete
            
        Example:
            await client.delete_blob("my-bucket", "file.txt")
        """
        client = self._get_client()
        
        try:
            bucket = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: client.bucket(bucket_name)
            )
            
            blob = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: bucket.blob(blob_name)
            )
            
            await asyncio.get_event_loop().run_in_executor(
                None,
                blob.delete
            )
            
            logger.info(f"Deleted blob: {bucket_name}/{blob_name}")
            
        except Exception as e:
            logger.error(f"Failed to delete blob: {e}")
            raise StorageError(
                message=f"Failed to delete blob: {e}",
                details={
                    "bucket_name": bucket_name,
                    "blob_name": blob_name
                }
            )
    
    async def copy_blob(
        self,
        source_bucket_name: str,
        source_blob_name: str,
        destination_bucket_name: str,
        destination_blob_name: str,
        copy_config: Optional[CopyConfig] = None,
    ) -> Blob:
        """
        Copy a blob from one location to another.
        
        Args:
            source_bucket_name: Source bucket name
            source_blob_name: Source blob name
            destination_bucket_name: Destination bucket name
            destination_blob_name: Destination blob name
            copy_config: Optional copy configuration
            
        Returns:
            Blob: Copied blob
            
        Example:
            blob = await client.copy_blob(
                source_bucket_name="source-bucket",
                source_blob_name="file.txt",
                destination_bucket_name="dest-bucket",
                destination_blob_name="copied_file.txt"
            )
        """
        client = self._get_client()
        
        try:
            source_bucket = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: client.bucket(source_bucket_name)
            )
            
            source_blob = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: source_bucket.blob(source_blob_name)
            )
            
            destination_bucket = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: client.bucket(destination_bucket_name)
            )
            
            new_blob = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: source_bucket.copy_blob(source_blob, destination_bucket, destination_blob_name)
            )
            
            # Apply copy config if provided
            if copy_config:
                if copy_config.content_type:
                    new_blob.content_type = copy_config.content_type
                if copy_config.metadata:
                    new_blob.metadata = copy_config.metadata
                if copy_config.cache_control:
                    new_blob.cache_control = copy_config.cache_control
                if copy_config.content_disposition:
                    new_blob.content_disposition = copy_config.content_disposition
                if copy_config.content_encoding:
                    new_blob.content_encoding = copy_config.content_encoding
                if copy_config.content_language:
                    new_blob.content_language = copy_config.content_language
                
                await asyncio.get_event_loop().run_in_executor(
                    None,
                    new_blob.patch
                )
            
            # Reload to get metadata
            await asyncio.get_event_loop().run_in_executor(
                None,
                new_blob.reload
            )
            
            logger.info(f"Copied blob: {source_bucket_name}/{source_blob_name} -> {destination_bucket_name}/{destination_blob_name}")
            
            return Blob(
                name=destination_blob_name,
                bucket=destination_bucket_name,
                metadata=BlobMetadata(
                    name=new_blob.name,
                    bucket=destination_bucket_name,
                    size=new_blob.size,
                    content_type=new_blob.content_type,
                    etag=new_blob.etag,
                    md5_hash=new_blob.md5_hash,
                    crc32c=new_blob.crc32c,
                    created=new_blob.time_created,
                    updated=new_blob.updated,
                    time_deleted=new_blob.time_deleted,
                    metadata=new_blob.metadata,
                    cache_control=new_blob.cache_control,
                    content_disposition=new_blob.content_disposition,
                    content_encoding=new_blob.content_encoding,
                    content_language=new_blob.content_language,
                    storage_class=new_blob.storage_class,
                    generation=new_blob.generation,
                    metageneration=new_blob.metageneration,
                )
            )
            
        except Exception as e:
            logger.error(f"Failed to copy blob: {e}")
            raise StorageError(
                message=f"Failed to copy blob: {e}",
                details={
                    "source_bucket_name": source_bucket_name,
                    "source_blob_name": source_blob_name,
                    "destination_bucket_name": destination_bucket_name,
                    "destination_blob_name": destination_blob_name,
                }
            )
    
    async def generate_signed_url(
        self,
        bucket_name: str,
        blob_name: str,
        signed_url_config: Optional[SignedUrlConfig] = None,
    ) -> str:
        """
        Generate a signed URL for a blob.
        
        Args:
            bucket_name: Name of the bucket
            blob_name: Name of the blob
            signed_url_config: Optional signed URL configuration
            
        Returns:
            str: Signed URL
            
        Example:
            url = await client.generate_signed_url(
                bucket_name="my-bucket",
                blob_name="file.txt",
                signed_url_config=SignedUrlConfig(expiration=3600)
            )
        """
        client = self._get_client()
        
        try:
            bucket = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: client.bucket(bucket_name)
            )
            
            blob = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: bucket.blob(blob_name)
            )
            
            config = signed_url_config or SignedUrlConfig()
            sign_kwargs = _blob_signed_url_kwargs(config)

            url = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: blob.generate_signed_url(**sign_kwargs),
            )
            
            logger.info(f"Generated signed URL for: {bucket_name}/{blob_name}")
            return url
            
        except Exception as e:
            logger.error(f"Failed to generate signed URL: {e}")
            raise StorageError(
                message=f"Failed to generate signed URL: {e}",
                details={
                    "bucket_name": bucket_name,
                    "blob_name": blob_name
                }
            )

