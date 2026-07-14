"""Helpers for smoke scripts that upload checkpoint media via google-cloud-storage."""

from __future__ import annotations

import uuid
from urllib.parse import quote

from google.cloud.storage import Blob


def ensure_firebase_download_url(blob: Blob, bucket_name: str, storage_path: str) -> str:
    """
    Attach a Firebase Storage download token to a GCS object (if missing) and
    return a firebasestorage.googleapis.com media URL the web/mapp UI can load.
    """
    blob.reload()
    meta = dict(blob.metadata or {})
    token = meta.get("firebaseStorageDownloadTokens")
    if not token:
        token = str(uuid.uuid4())
        meta["firebaseStorageDownloadTokens"] = token
        blob.metadata = meta
        blob.patch()
    encoded = quote(storage_path, safe="")
    return (
        f"https://firebasestorage.googleapis.com/v0/b/{bucket_name}/o/"
        f"{encoded}?alt=media&token={token}"
    )
