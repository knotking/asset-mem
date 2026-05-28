"""Tests for property_agent.log_redaction."""

from agent_framework.observability.log_redaction import redact_gcs_uris, safe_text_preview
from property_agent.observability.log_redaction import redact_tool_args_for_log


def test_safe_text_preview_truncates():
    text = "analyse my garage door paint chipping " * 5
    preview = safe_text_preview(text, max_len=40)
    assert len(preview) <= 40
    assert preview.endswith("...")


def test_redact_tool_args_masks_sensitive_fields():
    args = {
        "user_query": "leak under kitchen sink",
        "property_address": "1982 Helena Way, Brentwood, CA 94513",
        "context_doc_uris": [
            "gs://bucket/a.pdf",
            "gs://bucket/b.pdf",
        ],
        "property_id": "prop-1",
        "checkpoint_ids": ["a", "b"],
    }
    redacted = redact_tool_args_for_log(args)
    assert redacted["property_id"] == "prop-1"
    assert redacted["context_doc_uris"] == "<2 uris>"
    assert redacted["property_address"] == "<redacted address>"
    assert "leak" in redacted["user_query"]
    assert "1982" not in str(redacted)
    assert "gs://" not in str(redacted)
    assert redacted["checkpoint_ids"] == "<2 ids>"


def test_redact_gcs_uris():
    text = "see gs://homegeek-staging.firebasestorage.app/documents/u/file.pdf"
    assert redact_gcs_uris(text) == "see <gcs-uri>"
