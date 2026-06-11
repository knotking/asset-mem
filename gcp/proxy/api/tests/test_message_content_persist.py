"""Tests for agent message content persist helpers."""

from utils.message_content_persist import (
    apply_message_patch_from_state_delta,
    finalize_assistant_message,
    merge_branch_into_content_json,
)


def test_merge_branch_preserves_analysis_status() -> None:
    existing = {"analysis": {"analysisStatus": {"diy": "running"}}}
    patch = {"analysis": {"analysisStatus": {"diy": "completed"}, "diyResults": {"x": 1}}}
    merged = merge_branch_into_content_json(existing, patch)
    assert merged["analysis"]["analysisStatus"]["diy"] == "completed"
    assert merged["analysis"]["diyResults"] == {"x": 1}


def test_apply_message_patch_from_state_delta() -> None:
    patch = apply_message_patch_from_state_delta(
        {
            "contentMarkdown": "# A",
            "contentJson": {"analysis": {"title": "A"}},
            "analysisRunId": "run-1",
        },
        {},
    )
    assert patch["contentMarkdown"] == "# A"
    assert patch["contentJson"]["analysis"]["title"] == "A"
    assert patch["analysisRunId"] == "run-1"


def test_finalize_strips_json_fence_from_markdown() -> None:
    md, js = finalize_assistant_message(
        "# Hi\n\n```json\n{}\n```",
        {"analysis": {"title": "Hi"}},
    )
    assert "```json" not in md
    assert js is not None
