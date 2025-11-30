# GCP Storage - Cloud Storage CRUD Operations

A comprehensive Google Cloud Storage integration module for bucket and blob CRUD operations.

## Features

- **Bucket Management** - Create, list, get, and delete buckets
- **Blob Operations** - Upload, download, list, get, delete, and copy blobs
- **Signed URLs** - Generate signed URLs for secure blob access
- **Async Support** - Full async/await support for high-performance applications
- **Metadata Handling** - Comprehensive metadata support for buckets and blobs
- **Flexible Input** - Support for file paths, file-like objects, and bytes

## Installation

Install the required dependencies:

```bash
pip install -r requirements.txt
```

Or install individually:

```bash
pip install google-cloud-storage pydantic google-cloud-secret-manager
```

## Configuration

### Environment Variables

Set the following environment variables:

```bash
# Optional
export GCS_PROJECT_ID="your-gcp-project-id"
export GCS_BUCKET_NAME="default-bucket-name"
export GCS_LOCATION="us-central1"
export GCS_TIMEOUT="60"
```

**Note:** `GCS_PROJECT_ID` is optional as it can be inferred from Application Default Credentials (ADC).

### Using .env File

Create a `.env` file in your project root:

```env
GCS_PROJECT_ID=your-gcp-project-id
GCS_BUCKET_NAME=default-bucket-name
GCS_LOCATION=us-central1
```

Then load it in your code:

```python
from dotenv import load_dotenv
load_dotenv()

from storage import StorageConfig, StorageClient

config = StorageConfig.from_env()
```

### Using Google Cloud Secret Manager

For production deployments, store configuration in GCP Secret Manager:

```bash
# Create secret with JSON config
echo '{"project_id": "...", "bucket_name": "...", "location": "us-central1"}' | \
  gcloud secrets create gcs-storage-config --data-file=-
```

Then load in code:

```python
from storage import StorageConfig, StorageClient

config = StorageConfig.from_gcp_secret_manager(
    project_id="your-secrets-project-id",
    config_secret="gcs-storage-config",
)
```

## Usage

### Basic Setup

```python
import asyncio
from storage import StorageClient, StorageConfig

# Load configuration
config = StorageConfig.from_env()

# Create client
client = StorageClient(config)
```

### Bucket Operations

#### Create a Bucket

```python
async def create_bucket_example():
    async with StorageClient(StorageConfig.from_env()) as client:
        bucket = await client.create_bucket(
            bucket_name="my-unique-bucket-name",
            location="us-central1",
            storage_class="STANDARD",
            labels={"environment": "production"}
        )
        print(f"Created bucket: {bucket.name}")

asyncio.run(create_bucket_example())
```

#### List Buckets

```python
async def list_buckets_example():
    async with StorageClient(StorageConfig.from_env()) as client:
        buckets = await client.list_buckets()
        print(f"Found {len(buckets)} buckets")
        for bucket in buckets:
            print(f"  - {bucket.name} ({bucket.metadata.location})")

asyncio.run(list_buckets_example())
```

#### Get a Bucket

```python
async def get_bucket_example():
    async with StorageClient(StorageConfig.from_env()) as client:
        bucket = await client.get_bucket("my-bucket")
        print(f"Bucket: {bucket.name}")
        print(f"Location: {bucket.metadata.location}")
        print(f"Storage class: {bucket.metadata.storage_class}")

asyncio.run(get_bucket_example())
```

#### Delete a Bucket

```python
async def delete_bucket_example():
    async with StorageClient(StorageConfig.from_env()) as client:
        # Delete bucket (with all blobs)
        await client.delete_bucket("my-bucket", force=True)
        print("Bucket deleted")

asyncio.run(delete_bucket_example())
```

### Blob Operations

#### Upload a Blob

```python
async def upload_blob_example():
    async with StorageClient(StorageConfig.from_env()) as client:
        # Upload from file path
        blob = await client.upload_blob(
            bucket_name="my-bucket",
            blob_name="path/to/file.txt",
            file="local_file.txt",
            upload_config=UploadConfig(
                content_type="text/plain",
                metadata={"author": "John Doe"}
            )
        )
        print(f"Uploaded blob: {blob.path}")

asyncio.run(upload_blob_example())
```

#### Upload from Bytes

```python
async def upload_bytes_example():
    async with StorageClient(StorageConfig.from_env()) as client:
        content = b"Hello, World!"
        blob = await client.upload_blob(
            bucket_name="my-bucket",
            blob_name="hello.txt",
            file=content,
            upload_config=UploadConfig(content_type="text/plain")
        )
        print(f"Uploaded blob: {blob.path}")

asyncio.run(upload_bytes_example())
```

#### Download a Blob

```python
async def download_blob_example():
    async with StorageClient(StorageConfig.from_env()) as client:
        # Download to bytes
        content = await client.download_blob(
            bucket_name="my-bucket",
            blob_name="file.txt"
        )
        print(f"Downloaded content: {content.decode('utf-8')}")
        
        # Download to file
        await client.download_blob(
            bucket_name="my-bucket",
            blob_name="file.txt",
            destination="local_file.txt"
        )

asyncio.run(download_blob_example())
```

#### List Blobs

```python
async def list_blobs_example():
    async with StorageClient(StorageConfig.from_env()) as client:
        # List all blobs
        blobs = await client.list_blobs("my-bucket")
        print(f"Found {len(blobs)} blobs")
        
        # List blobs with prefix (folder-like)
        blobs = await client.list_blobs(
            bucket_name="my-bucket",
            prefix="folder/",
            max_results=100
        )
        for blob in blobs:
            print(f"  - {blob.name} ({blob.metadata.size} bytes)")

asyncio.run(list_blobs_example())
```

#### Get a Blob

```python
async def get_blob_example():
    async with StorageClient(StorageConfig.from_env()) as client:
        blob = await client.get_blob("my-bucket", "file.txt")
        print(f"Blob: {blob.path}")
        print(f"Size: {blob.metadata.size} bytes")
        print(f"Content type: {blob.metadata.content_type}")
        print(f"Created: {blob.metadata.created}")

asyncio.run(get_blob_example())
```

#### Delete a Blob

```python
async def delete_blob_example():
    async with StorageClient(StorageConfig.from_env()) as client:
        await client.delete_blob("my-bucket", "file.txt")
        print("Blob deleted")

asyncio.run(delete_blob_example())
```

#### Copy a Blob

```python
async def copy_blob_example():
    async with StorageClient(StorageConfig.from_env()) as client:
        blob = await client.copy_blob(
            source_bucket_name="source-bucket",
            source_blob_name="file.txt",
            destination_bucket_name="dest-bucket",
            destination_blob_name="copied_file.txt"
        )
        print(f"Copied blob: {blob.path}")

asyncio.run(copy_blob_example())
```

### Signed URLs

#### Generate a Signed URL

```python
async def signed_url_example():
    async with StorageClient(StorageConfig.from_env()) as client:
        url = await client.generate_signed_url(
            bucket_name="my-bucket",
            blob_name="file.txt",
            signed_url_config=SignedUrlConfig(
                expiration=3600,  # 1 hour
                method="GET"
            )
        )
        print(f"Signed URL: {url}")

asyncio.run(signed_url_example())
```

## API Reference

### StorageConfig

Configuration container for GCP Storage.

| Attribute | Type | Description |
|-----------|------|-------------|
| `project_id` | str | GCP project ID (optional, can be inferred from ADC) |
| `bucket_name` | str | Default bucket name (optional) |
| `location` | str | Default bucket location (default: 'us-central1') |
| `timeout` | float | Request timeout in seconds (default: 60.0) |

### StorageClient Methods

#### Bucket Management
- `create_bucket(bucket_name, location?, storage_class?, labels?, versioning_enabled?) -> Bucket`
- `list_buckets(project?) -> List[Bucket]`
- `get_bucket(bucket_name) -> Bucket`
- `delete_bucket(bucket_name, force?) -> None`

#### Blob Operations
- `upload_blob(bucket_name, blob_name, file, upload_config?) -> Blob`
- `download_blob(bucket_name, blob_name, destination?, download_config?) -> bytes | None`
- `list_blobs(bucket_name, prefix?, delimiter?, max_results?) -> List[Blob]`
- `get_blob(bucket_name, blob_name) -> Blob`
- `delete_blob(bucket_name, blob_name) -> None`
- `copy_blob(source_bucket_name, source_blob_name, destination_bucket_name, destination_blob_name, copy_config?) -> Blob`
- `generate_signed_url(bucket_name, blob_name, signed_url_config?) -> str`

### Models

#### Bucket
```python
Bucket(
    name: str,                    # Bucket name
    metadata: Optional[BucketMetadata]  # Bucket metadata
)
```

#### Blob
```python
Blob(
    name: str,                    # Blob name (path)
    bucket: str,                  # Bucket name
    metadata: Optional[BlobMetadata]  # Blob metadata
)
```

#### UploadConfig
```python
UploadConfig(
    content_type: Optional[str],           # MIME type
    metadata: Optional[Dict[str, str]],    # Custom metadata
    cache_control: Optional[str],         # Cache control header
    content_disposition: Optional[str],    # Content disposition
    content_encoding: Optional[str],      # Content encoding
    content_language: Optional[str],       # Content language
    predefined_acl: Optional[str]         # Predefined ACL
)
```

#### SignedUrlConfig
```python
SignedUrlConfig(
    expiration: int = 3600,       # Expiration in seconds
    method: str = "GET",          # HTTP method
    content_type: Optional[str],  # Content type for PUT
    response_type: Optional[str], # Response content type
    response_disposition: Optional[str],  # Response disposition
    version: Optional[str] = "v4" # Signature version (v2 or v4)
)
```

## Storage Classes

- `STANDARD` - Standard storage (default)
- `NEARLINE` - Nearline storage (lower cost, suitable for data accessed less than once a month)
- `COLDLINE` - Coldline storage (lower cost, suitable for data accessed less than once a quarter)
- `ARCHIVE` - Archive storage (lowest cost, suitable for data accessed less than once a year)

## Authentication

The client uses Google Cloud Application Default Credentials (ADC). Set up authentication:

```bash
# Service Account (Recommended for Production)
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account-key.json"

# User Credentials (Development)
gcloud auth application-default login
```

### Required IAM Roles

The service account needs these roles:
- `roles/storage.admin` - For full bucket and blob management
- `roles/storage.objectAdmin` - For blob operations only
- `roles/storage.objectViewer` - For read-only access

## Error Handling

```python
from storage import StorageClient, StorageConfig
from storage.client import StorageError

async def safe_operation():
    try:
        async with StorageClient(StorageConfig.from_env()) as client:
            bucket = await client.create_bucket(bucket_name="my-bucket")
            print(f"Created bucket: {bucket.name}")
    except StorageError as e:
        print(f"Storage error: {e}")
        print(f"Status code: {e.status_code}")
        print(f"Details: {e.details}")
    except Exception as e:
        print(f"Unexpected error: {e}")

asyncio.run(safe_operation())
```

## Testing

Run tests with pytest:

```bash
# Install test dependencies
pip install pytest pytest-asyncio

# Run all tests
pytest

# Run with verbose output
pytest -v

# Run specific test file
pytest tests/test_client.py

# Run integration tests (requires real credentials)
pytest -m integration
```

## Troubleshooting

### Common Issues

**Error: "Bucket name must be globally unique"**
- Bucket names must be globally unique across all GCP projects
- Use a unique prefix or suffix (e.g., `my-project-bucket-12345`)

**Error: "Permission denied"**
- Verify service account has required IAM roles
- Check that `GOOGLE_APPLICATION_CREDENTIALS` is set correctly

**Error: "File not found"**
- Verify the file path is correct
- Check file permissions

**Error: "Bucket not found"**
- Verify the bucket name is correct
- Check that the bucket exists in the specified project

**Signed URL generation fails**
- Ensure the service account has `iam.serviceAccountTokenCreator` role
- Or use a service account key file for signing

## Best Practices

### 1. Bucket Naming

```python
# Use unique, descriptive names
bucket_name = f"{project_id}-{environment}-{purpose}"
# Example: "my-project-prod-user-uploads"
```

### 2. Blob Organization

```python
# Use folder-like prefixes for organization
blob_name = f"users/{user_id}/documents/{document_id}.pdf"
```

### 3. Error Handling

```python
try:
    blob = await client.upload_blob(...)
except StorageError as e:
    logger.error(f"Upload failed: {e}")
    # Handle error appropriately
```

### 4. Resource Cleanup

```python
# Use async context manager for automatic cleanup
async with StorageClient(config) as client:
    # Operations here
    pass
# Client is automatically closed
```

### 5. Large File Uploads

For large files (>5MB), consider using resumable uploads or chunked uploads:

```python
# The client handles large files automatically
# For very large files, consider using the underlying blob.upload_from_file
# with resumable=True option
```

## License

Internal use only.

## References

- [Google Cloud Storage Python Client Library](https://cloud.google.com/python/docs/reference/storage/latest)
- [Cloud Storage Documentation](https://cloud.google.com/storage/docs)

