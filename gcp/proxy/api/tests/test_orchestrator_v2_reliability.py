"""Orchestrator V2 proxy reliability: patch ordering, retries, stream interruption."""

from __future__ import annotations

from utils.message_content_persist import (
    apply_message_patch_from_state_delta,
    finalize_assistant_message,
    merge_branch_into_content_json,
)
from utils.message_patch_state import (
    apply_patches_deterministically,
    build_assistant_message_patch,
    validate_assistant_message_patch,
)


def _accumulate_delta(
    accum: dict,
    delta: dict,
) -> dict:
    return apply_message_patch_from_state_delta(delta, accum)


def _build_v2_patch(
    *,
    revision: int,
    content_markdown: str,
    content_json: dict | None,
    analysis_run_id: str = "run-1",
) -> dict:
    accum = {
        "contentMarkdown": content_markdown,
        "contentJson": content_json,
        "analysisRunId": analysis_run_id,
    }
    patch = build_assistant_message_patch(
        content=content_markdown,
        agent_steps=[{"name": "run_checkpoint_pipeline", "status": "executing"}],
        primary_agent="checkpoint",
        revision=revision,
        updated_at="ts",
        accumulated_state_delta=accum,
    )
    patch["contentSchemaVersion"] = 2
    validate_assistant_message_patch(patch)
    return patch


def test_shuffled_content_json_patches_converge_deterministically() -> None:
    """Out-of-order branch patches merge; highest revision wins for full payload."""
    base_json = {"analysis": {"title": "Garage", "analysisStatus": {"diy": "running"}}}
    rev2_json = _accumulate_delta(
        {"contentJson": base_json},
        {
            "contentJson": {
                "analysis": {
                    "analysisStatus": {"diy": "completed"},
                    "diyResults": {"steps": ["A"]},
                }
            }
        },
    )["contentJson"]
    rev3_json = _accumulate_delta(
        {"contentJson": rev2_json},
        {
            "contentJson": {
                "analysis": {
                    "analysisStatus": {"service": "completed"},
                    "serviceResults": {"localPros": {}},
                }
            }
        },
    )["contentJson"]

    patches = [
        _build_v2_patch(
            revision=1,
            content_markdown="# Garage",
            content_json=base_json,
        ),
        _build_v2_patch(
            revision=3,
            content_markdown="# Garage done",
            content_json=rev3_json,
        ),
        _build_v2_patch(
            revision=2,
            content_markdown="# Garage partial",
            content_json=rev2_json,
        ),
    ]

    revision, state = apply_patches_deterministically(patches, initial_revision=0)
    assert revision == 3
    analysis = state["contentJson"]["analysis"]
    assert analysis["analysisStatus"]["diy"] == "completed"
    assert analysis["analysisStatus"]["service"] == "completed"
    assert analysis["diyResults"] == {"steps": ["A"]}


def test_duplicate_retry_same_analysis_run_id_does_not_rollback() -> None:
    """Duplicate lower-revision retry with same analysisRunId is ignored."""
    advanced = {
        "analysis": {
            "title": "T",
            "analysisStatus": {"diy": "completed"},
            "diyResults": {"x": 1},
        }
    }
    stale = {
        "analysis": {
            "title": "T",
            "analysisStatus": {"diy": "running"},
        }
    }
    run_id = "run-abc"
    patches = [
        _build_v2_patch(
            revision=5,
            content_markdown="# Done",
            content_json=advanced,
            analysis_run_id=run_id,
        ),
        _build_v2_patch(
            revision=4,
            content_markdown="# Stale retry",
            content_json=stale,
            analysis_run_id=run_id,
        ),
        _build_v2_patch(
            revision=5,
            content_markdown="# Done duplicate",
            content_json=stale,
            analysis_run_id=run_id,
        ),
    ]
    _, state = apply_patches_deterministically(patches, initial_revision=3)
    assert state["analysisRunId"] == run_id
    assert state["contentJson"]["analysis"]["analysisStatus"]["diy"] == "completed"
    assert state["contentJson"]["analysis"]["diyResults"] == {"x": 1}


def test_partial_stream_interruption_preserves_structured_patch() -> None:
    """Finalize with partial accumulated state_delta keeps contentJson + markdown."""
    accum = _accumulate_delta(
        {},
        {
            "contentMarkdown": "# Partial\n\nStill loading…",
            "contentJson": {
                "analysis": {
                    "title": "Partial",
                    "analysisStatus": {"diy": "running"},
                }
            },
            "analysisRunId": "run-partial",
        },
    )
    markdown, content_json = finalize_assistant_message(
        accum.get("contentMarkdown"),
        accum.get("contentJson"),
    )
    patch = build_assistant_message_patch(
        content=markdown,
        agent_steps=[
            {"name": "run_checkpoint_pipeline", "status": "executing"},
            {"name": "agent_stream", "status": "failed"},
        ],
        primary_agent="checkpoint",
        revision=2,
        updated_at="ts",
        accumulated_state_delta=accum,
    )
    patch["contentSchemaVersion"] = 2
    validate_assistant_message_patch(patch)
    assert content_json is not None
    assert content_json["analysis"]["analysisStatus"]["diy"] == "running"
    assert patch["agentSteps"][-1]["status"] == "failed"
    assert "```json" not in patch["contentMarkdown"]


def test_merge_branch_late_running_patch_overwrites_status() -> None:
    """Branch-level merge is last-write-wins; revision guards reject stale Firestore writes."""
    existing = {
        "analysis": {
            "analysisStatus": {"diy": "completed", "service": "completed"},
            "diyResults": {"steps": ["A"]},
        }
    }
    late_running = {
        "analysis": {
            "analysisStatus": {"diy": "running", "service": "pending"},
        }
    }
    merged = merge_branch_into_content_json(existing, late_running)
    assert merged["analysis"]["analysisStatus"]["diy"] == "running"
    assert merged["analysis"]["diyResults"] == {"steps": ["A"]}
