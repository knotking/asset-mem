"""Interpret Vertex RAG import responses and map outcomes to Firestore ragIndexed."""

from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger(__name__)


def _counts_from_branch(branch_result: Any) -> dict[str, int]:
    if branch_result is None:
        return {"imported": 0, "failed": 0, "skipped": 0}
    if isinstance(branch_result, dict):
        data = branch_result
    elif hasattr(branch_result, "to_dict"):
        data = branch_result.to_dict()
    else:
        return {"imported": 0, "failed": 0, "skipped": 0}

    return {
        "imported": int(data.get("imported_rag_files_count") or 0),
        "failed": int(data.get("failed_rag_files_count") or 0),
        "skipped": int(data.get("skipped_rag_files_count") or 0),
    }


def evaluate_rag_import_result(
    import_result: Any,
    expected_file_count: int,
) -> tuple[bool, str]:
    """
    Decide whether RAG import succeeded for all expected GCS inputs.

    Skipped files (already in corpus) count as success. Fails when any file
    failed or when imported+skipped does not account for all inputs.
    """
    if not isinstance(import_result, dict):
        return False, "Invalid RAG import result payload"

    totals = {"imported": 0, "failed": 0, "skipped": 0}
    for key in ("document_import_result", "media_import_result"):
        branch = import_result.get(key)
        if not branch:
            continue
        counts = _counts_from_branch(branch)
        for field in totals:
            totals[field] += counts[field]

    if totals["failed"] > 0:
        return False, f"RAG import failed for {totals['failed']} file(s)"

    accounted = totals["imported"] + totals["skipped"]
    if expected_file_count > 0 and accounted < expected_file_count:
        return (
            False,
            f"RAG import incomplete: accounted={accounted} expected={expected_file_count}",
        )

    if expected_file_count > 0 and accounted == 0:
        return False, "RAG import produced no imported or skipped files"

    return (
        True,
        f"imported={totals['imported']} skipped={totals['skipped']}",
    )


def update_docs_rag_indexed(
    db: Any,
    user_id: str,
    context_doc_ids: list[str],
    gcs_urls: list[str],
    *,
    indexed: bool,
) -> None:
    """Set ragIndexed on known doc ids, or resolve by gsURI when ids are absent."""
    user_ref = db.collection("users").document(user_id)
    payload = {"ragIndexed": indexed}

    updated_ids: list[str] = []
    for doc_id in context_doc_ids:
        if not doc_id:
            continue
        try:
            user_ref.collection("docs").document(doc_id).update(payload)
            updated_ids.append(doc_id)
        except Exception as e:
            logger.warning(
                "ragIndexed update failed doc_id=%s indexed=%s: %s",
                doc_id,
                indexed,
                e,
            )

    if updated_ids:
        logger.info(
            "ragIndexed=%s for doc_ids=%s user_id=%s",
            indexed,
            updated_ids,
            user_id,
        )
        return

    if indexed:
        for url in gcs_urls:
            if not url:
                continue
            try:
                matches = (
                    user_ref.collection("docs")
                    .where("gsURI", "==", url)
                    .limit(1)
                    .stream()
                )
                for snap in matches:
                    snap.reference.update(payload)
                    logger.info("ragIndexed=true by gsURI doc_id=%s", snap.id)
            except Exception as e:
                logger.warning("ragIndexed gsURI lookup failed url=%s: %s", url, e)
