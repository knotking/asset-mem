#!/usr/bin/env python3
"""
RAG Corpus Migration Script

Migrates user documents to new Vertex AI RAG corpus by:
1. Querying Firestore for all user documents
2. Verifying files exist in migrated storage
3. Batch importing to new RAG corpus with proper import results

Based on: gcp/proxy/workers/function/main.py
"""

import os
import sys
import json
import mimetypes
import warnings
from datetime import datetime, timezone
from typing import List, Dict, Tuple
from collections import defaultdict

# Suppress Python version warnings and SSL warnings
warnings.filterwarnings("ignore", category=FutureWarning, module="google.api_core._python_version_support")
warnings.filterwarnings("ignore", message="urllib3 v2 only supports OpenSSL")

# Check Python version
if sys.version_info < (3, 8):
    print("❌ Error: Python 3.8 or higher required")
    print(f"   Current version: {sys.version}")
    sys.exit(1)

# Python 3.9 has importlib.metadata issues with some package versions
# Try to import with error handling
if sys.version_info < (3, 10):
    try:
        # Try to fix importlib.metadata issue for Python 3.9
        import importlib.metadata as importlib_metadata
    except Exception:
        pass

# Try importing Google Cloud libraries with error handling
try:
    from google.cloud import firestore
    from google.cloud import storage
    import vertexai
    from vertexai import rag
except ImportError as e:
    print(f"❌ Error importing required packages: {e}")
    print("\nPlease install required packages:")
    print("  pip3 install google-cloud-firestore google-cloud-storage google-cloud-aiplatform")
    sys.exit(1)

# Configuration from environment
PROJECT_ID = os.environ.get("GCP_PROJECT_ID", "homegeekdemo")
REGION = os.environ.get("GCP_REGION", "us-central1")
NEW_RAG_CORPUS = os.environ.get("NEW_RAG_CORPUS")
GCS_BUCKET = os.environ.get("GCS_BUCKET", "homegeek-user-data")
DRY_RUN = os.environ.get("DRY_RUN", "false").lower() == "true"
RESUME_MODE = os.environ.get("RESUME_MODE", "false").lower() == "true"
FORCE_MODE = os.environ.get("FORCE_MODE", "false").lower() == "true"

# Initialize Vertex AI
vertexai.init(project=PROJECT_ID, location=REGION)

def is_media_mime_type(mime_type: str) -> bool:
    """Returns True if the MIME type is media (image, audio, or video), else False."""
    if not mime_type:
        return False
    return any(mime_type.startswith(prefix) for prefix in ("image/", "audio/", "video/"))

def verify_gcs_file_exists(gcs_url: str, storage_client: storage.Client) -> bool:
    """Check if a GCS file exists."""
    try:
        # Parse gs://bucket/path format
        if not gcs_url.startswith("gs://"):
            return False

        path_parts = gcs_url[5:].split("/", 1)
        if len(path_parts) != 2:
            return False

        bucket_name, blob_path = path_parts
        bucket = storage_client.bucket(bucket_name)
        blob = bucket.blob(blob_path)

        return blob.exists()
    except Exception as e:
        print(f"   ⚠️  Error checking file {gcs_url}: {e}")
        return False

def check_user_already_migrated(user_id: str, storage_client: storage.Client) -> bool:
    """
    Check if a user's files have already been migrated by looking for import result files.

    Args:
        user_id: The user ID to check
        storage_client: GCS storage client

    Returns:
        True if import result files exist for this user, False otherwise
    """
    try:
        bucket = storage_client.bucket(GCS_BUCKET)
        prefix = f"uploads/{user_id}/import-results/"

        # List blobs with the migration prefix
        blobs = list(bucket.list_blobs(prefix=prefix, max_results=10))

        # Check for migration result files
        migration_files = [
            blob.name for blob in blobs
            if "-migration" in blob.name and blob.name.endswith(".ndjson")
        ]

        return len(migration_files) > 0

    except Exception as e:
        print(f"   ⚠️  Error checking migration status for user {user_id}: {e}")
        return False

def fetch_user_documents() -> Dict[str, List[str]]:
    """
    Fetch all user documents from Firestore.

    Returns:
        Dict mapping user_id to list of GCS URLs
    """
    print("\n📊 Fetching user documents from Firestore...")

    db = firestore.Client(project=PROJECT_ID)
    storage_client = storage.Client(project=PROJECT_ID)

    user_docs = defaultdict(list)
    total_docs = 0
    missing_files = []

    # Query all user documents
    # Structure: users/{userId}/docs/{docId}
    # Use list_documents() to get ALL user references (including empty user docs with subcollections)
    users_ref = db.collection("users")
    user_doc_refs = users_ref.list_documents()

    for user_doc_ref in user_doc_refs:
        user_id = user_doc_ref.id
        docs_ref = user_doc_ref.collection("docs")

        for doc in docs_ref.stream():
            # doc is already a DocumentSnapshot with data
            doc_data = doc.to_dict()
            total_docs += 1

            # Try different possible field names for GCS URL (gsURI is the primary field)
            gcs_url = None
            for field in ["gsURI", "gcsUrl", "storageUrl", "url", "path", "filePath"]:
                if field in doc_data:
                    gcs_url = doc_data[field]
                    break

            if not gcs_url:
                print(f"   ⚠️  No GCS URL found for user {user_id}, doc {doc.id}")
                continue

            # Verify file exists in storage
            if verify_gcs_file_exists(gcs_url, storage_client):
                user_docs[user_id].append(gcs_url)
            else:
                missing_files.append(gcs_url)
                print(f"   ⚠️  File not found in storage: {gcs_url}")

    print(f"\n✓ Found {total_docs} documents in Firestore")
    print(f"✓ {sum(len(urls) for urls in user_docs.values())} files verified in storage")
    print(f"✓ {len(user_docs)} users with documents")

    if missing_files:
        print(f"⚠️  {len(missing_files)} files missing from storage (will be skipped)")

    return dict(user_docs)

def import_user_files(user_id: str, gcs_urls: List[str]) -> Tuple[bool, str]:
    """
    Import files for a single user to RAG corpus.

    Based on: gcp/proxy/workers/function/main.py:import_to_rag_corpus()
    """
    if DRY_RUN:
        print(f"   [DRY RUN] Would import {len(gcs_urls)} files")
        return True, f"Dry run: {len(gcs_urls)} files"

    try:
        # Configure LLM parser (same as main.py)
        llm_parser_config = rag.LlmParserConfig(
            model_name="gemini-3.0-pro-002",
        )

        # Separate documents and media
        documents_list = []
        media_list = []

        for gcs_url in gcs_urls:
            mime_type, _ = mimetypes.guess_type(gcs_url)
            if is_media_mime_type(mime_type):
                media_list.append(gcs_url)
            else:
                documents_list.append(gcs_url)

        # Timestamp for import results
        timestamp = datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')
        sink_path = f"gs://{GCS_BUCKET}/uploads/{user_id}/import-results/{timestamp}-migration"

        results = []

        # Import documents
        if documents_list:
            print(f"   📄 Importing {len(documents_list)} documents...")
            doc_result = rag.import_files(
                corpus_name=NEW_RAG_CORPUS,
                paths=documents_list,
                llm_parser=llm_parser_config,
                import_result_sink=f"{sink_path}-documents.ndjson"
            )
            results.append(f"docs: {len(documents_list)}")

        # Import media
        if media_list:
            print(f"   🎬 Importing {len(media_list)} media files...")
            # Note: main.py uses custom parsing prompt for media
            # For migration, we'll use standard parsing
            media_result = rag.import_files(
                corpus_name=NEW_RAG_CORPUS,
                paths=media_list,
                llm_parser=llm_parser_config,
                import_result_sink=f"{sink_path}-media.ndjson"
            )
            results.append(f"media: {len(media_list)}")

        return True, ", ".join(results)

    except Exception as e:
        return False, str(e)

def main():
    """Main migration workflow."""

    # Validate configuration
    if not NEW_RAG_CORPUS:
        print("❌ Error: NEW_RAG_CORPUS environment variable not set")
        print("   Please set: export NEW_RAG_CORPUS='projects/.../ragCorpora/...'")
        sys.exit(1)

    print("\n" + "="*60)
    print("🔄 Vertex AI RAG Corpus Migration")
    print("="*60)
    print(f"\n   Project: {PROJECT_ID}")
    print(f"   Region: {REGION}")
    print(f"   Target Corpus: {NEW_RAG_CORPUS}")
    print(f"   GCS Bucket: gs://{GCS_BUCKET}")

    if DRY_RUN:
        print("\n   🔍 DRY RUN MODE - No actual imports will be performed")
    if RESUME_MODE and not FORCE_MODE:
        print("\n   ♻️  RESUME MODE - Will skip users with existing migration")
    if FORCE_MODE:
        print("\n   ⚠️  FORCE MODE - Will reimport all users (creates duplicates!)")

    print("\n" + "="*60)

    # Step 1: Fetch user documents from Firestore
    user_docs = fetch_user_documents()

    if not user_docs:
        print("\n⚠️  No documents found to migrate")
        sys.exit(0)

    # Step 2: Import files per user
    print("\n\n📦 Starting batch import...")
    print("="*60)

    # Check for already-migrated users if in resume mode
    storage_client = storage.Client(project=PROJECT_ID)
    skipped_users = []

    if RESUME_MODE and not FORCE_MODE:
        print("\n🔍 Checking for already-migrated users...")
        for user_id in list(user_docs.keys()):
            if check_user_already_migrated(user_id, storage_client):
                skipped_users.append(user_id)
                del user_docs[user_id]

        if skipped_users:
            print(f"✓ Skipping {len(skipped_users)} already-migrated users")
        print("")

    total_users = len(user_docs)
    success_count = 0
    error_count = 0
    total_files = 0

    for idx, (user_id, gcs_urls) in enumerate(user_docs.items(), 1):
        print(f"\n[{idx}/{total_users}] Processing user: {user_id}")
        print(f"   Files: {len(gcs_urls)}")

        total_files += len(gcs_urls)
        success, result = import_user_files(user_id, gcs_urls)

        if success:
            print(f"   ✓ Success: {result}")
            success_count += 1
        else:
            print(f"   ❌ Error: {result}")
            error_count += 1

    # Summary
    print("\n\n" + "="*60)
    print("📊 Migration Summary")
    print("="*60)
    print(f"\n   Total users processed: {total_users}")
    if skipped_users:
        print(f"   Users skipped (already migrated): {len(skipped_users)}")
    print(f"   Successful imports: {success_count}")
    print(f"   Failed imports: {error_count}")
    print(f"   Total files: {total_files}")

    if DRY_RUN:
        print("\n💡 This was a dry run. Run without DRY_RUN=true to perform actual import.")
    else:
        print("\n✅ Migration complete!")
        print("\n📝 Next steps:")
        print("   1. Verify imports in Vertex AI Console → RAG")
        print("   2. Update environment variables in agent configs:")
        print(f"      USER_UPLOAD_RAG_CORPUS={NEW_RAG_CORPUS}")
        print("   3. Redeploy agents with new corpus ID")
        print("   4. Test user document queries")

    print("\n" + "="*60)

    if error_count > 0:
        sys.exit(1)

if __name__ == "__main__":
    main()
