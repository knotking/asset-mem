"""Delete RAG corpus files matching GCS source URIs."""

from __future__ import annotations

import logging
import os
import time
from typing import Any
from urllib.parse import unquote

logger = logging.getLogger(__name__)

_RAG_CORPUS_ENV_KEYS = ("RAG_CORPUS", "USER_UPLOAD_RAG_CORPUS")


def _rag_corpus_name() -> str | None:
    for key in _RAG_CORPUS_ENV_KEYS:
        value = (os.environ.get(key) or "").strip()
        if value:
            return value
    return None


def _parse_location_from_corpus(corpus_path: str) -> str:
    try:
        parts = corpus_path.split("/")
        return parts[parts.index("locations") + 1]
    except (ValueError, IndexError):
        return "us-central1"


def _normalize_gcs_uri(uri: str) -> str:
    return unquote((uri or "").strip())


def _file_matches_gcs_uri(file_obj: Any, target_uris: set[str]) -> bool:
    """Match rag file display/source URI against requested gs:// paths."""
    candidates: list[str] = []
    for attr in ("gcs_source", "gcsSource", "source_uri", "sourceUri"):
        val = getattr(file_obj, attr, None)
        if val:
            candidates.append(_normalize_gcs_uri(str(val)))
    name = getattr(file_obj, "name", None) or getattr(file_obj, "display_name", None)
    if name:
        candidates.append(_normalize_gcs_uri(str(name)))
    return any(c in target_uris for c in candidates if c)


def delete_rag_files_by_gcs_uris(
    gcs_uris: list[str],
    *,
    max_retries: int = 3,
) -> tuple[int, list[str]]:
    """
    Delete RAG files whose source matches any of the given gs:// URIs.

    Returns (deleted_count, warnings).
    """
    corpus = _rag_corpus_name()
    if not corpus or not gcs_uris:
        return 0, []

    targets = {_normalize_gcs_uri(u) for u in gcs_uris if u}
    if not targets:
        return 0, []

    warnings: list[str] = []
    deleted = 0

    try:
        import vertexai
        from vertexai import rag
    except ImportError as exc:
        warnings.append(f"vertexai not available: {exc}")
        return 0, warnings

    project = (os.environ.get("GCP_PROJECT_ID") or os.environ.get("GOOGLE_CLOUD_PROJECT") or "").strip()
    location = _parse_location_from_corpus(corpus)
    if project:
        vertexai.init(project=project, location=location)

    try:
        files = list(rag.list_files(corpus_name=corpus))
    except Exception as exc:
        warnings.append(f"rag.list_files failed: {exc}")
        return 0, warnings

    for rag_file in files:
        if not _file_matches_gcs_uri(rag_file, targets):
            continue
        file_name = getattr(rag_file, "name", None)
        if not file_name:
            continue
        for attempt in range(max_retries):
            try:
                rag.delete_file(name=file_name)
                deleted += 1
                break
            except Exception as exc:
                err = str(exc)
                if "429" in err or "ResourceExhausted" in err or "RATE_LIMIT" in err:
                    time.sleep(2 ** attempt)
                    continue
                warnings.append(f"rag.delete_file failed {file_name}: {exc}")
                break

    return deleted, warnings
