from agent_framework.contracts.message_patch_v1 import (
    firestore_fields_from_message_patch_input,
    merge_state_delta_message_keys,
    message_patch_input_from_accumulator,
    state_delta_from_message_patch_input,
)
from agent_framework.contracts.v1 import MessagePatchInputV1


def test_merge_state_delta_message_keys() -> None:
    merged = merge_state_delta_message_keys(
        {
            "contentMarkdown": "# A",
            "analysisRunId": "run-1",
        },
        {},
    )
    assert merged["contentMarkdown"] == "# A"
    assert merged["analysisRunId"] == "run-1"


def test_message_patch_input_round_trip() -> None:
    inp = MessagePatchInputV1(
        content_markdown="# Hi",
        content_json={"analysis": {"title": "Hi"}},
        revision=3,
        client_routing_hint="checkpoint",
        agent_steps=[{"name": "diy", "status": "completed"}],
        analysis_run_id="run-9",
    )
    delta = state_delta_from_message_patch_input(inp)
    accum = merge_state_delta_message_keys(delta, None)
    if isinstance(delta.get("contentJson"), dict):
        accum["contentJson"] = dict(delta["contentJson"])
    rebuilt = message_patch_input_from_accumulator(
        accum,
        revision=inp.revision,
        agent_steps=inp.agent_steps,
        client_routing_hint=inp.client_routing_hint,
    )
    assert rebuilt == inp


def test_firestore_fields_from_message_patch_input() -> None:
    inp = MessagePatchInputV1(
        content_markdown="md",
        content_json={"analysis": {"title": "t"}},
        revision=1,
        client_routing_hint="docs",
        agent_steps=[],
        analysis_run_id="rid",
    )
    fields = firestore_fields_from_message_patch_input(
        inp, content="md", updated_at="ts"
    )
    assert fields["contentSchemaVersion"] == 2
    assert fields["primaryAgent"] == "docs"
    assert fields["analysisRunId"] == "rid"
