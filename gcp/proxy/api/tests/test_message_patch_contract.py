from agent_framework.contracts.message_patch_types import MessagePatchInputV1
from utils.message_content_persist import apply_message_patch_from_state_delta
from utils.message_patch_state import build_assistant_message_patch, validate_assistant_message_patch


def test_build_assistant_message_patch_uses_message_patch_input_v1() -> None:
    accum = apply_message_patch_from_state_delta(
        {
            "contentMarkdown": "# Hi",
            "contentJson": {"analysis": {"title": "Hi"}},
            "analysisRunId": "run-1",
        },
        {},
    )
    patch = build_assistant_message_patch(
        content="# Hi",
        agent_steps=[{"name": "run_checkpoint_pipeline", "status": "executing"}],
        primary_agent="checkpoint",
        revision=1,
        updated_at="ts",
        accumulated_state_delta=accum,
    )
    validate_assistant_message_patch(patch)
    assert patch["contentMarkdown"] == "# Hi"
    assert patch["contentJson"]["analysis"]["title"] == "Hi"
    assert patch["analysisRunId"] == "run-1"
    assert patch["contentSchemaVersion"] == 2


def test_explicit_message_patch_input_v1() -> None:
    inp = MessagePatchInputV1(
        content_markdown="md",
        content_json={"analysis": {"title": "t"}},
        revision=3,
        client_routing_hint="docs",
        agent_steps=[],
        analysis_run_id="rid",
    )
    patch = build_assistant_message_patch(
        content="md",
        agent_steps=[],
        primary_agent="docs",
        revision=3,
        updated_at="ts",
        message_patch=inp,
    )
    assert patch["primaryAgent"] == "docs"
    assert patch["analysisRunId"] == "rid"
