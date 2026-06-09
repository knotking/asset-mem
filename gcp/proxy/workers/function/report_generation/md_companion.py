"""Upload chatMarkdown companion .md for optional Docs RAG indexing."""

from __future__ import annotations

from google.cloud import storage


def upload_report_markdown_companion(
    *,
    bucket_name: str,
    user_id: str,
    property_id: str,
    report_id: str,
    revision: int,
    chat_markdown: str,
) -> tuple[str, str]:
    """Returns (storage_path, gs_uri)."""
    storage_path = (
        f"uploads/{user_id}/properties/{property_id}/reports/"
        f"{report_id}/v{revision}.md"
    )
    client = storage.Client()
    bucket = client.bucket(bucket_name)
    blob = bucket.blob(storage_path)
    blob.upload_from_string(
        (chat_markdown or "").strip() or "# Property Report\n",
        content_type="text/markdown",
    )
    gs_uri = f"gs://{bucket_name}/{storage_path}"
    return storage_path, gs_uri
