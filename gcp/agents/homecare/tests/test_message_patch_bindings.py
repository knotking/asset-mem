from property_agent.bindings.message_patch import (
    build_state_delta_message_patch,
    message_patch_input_from_state_delta_accumulator,
)


def test_build_state_delta_message_patch_keys() -> None:
    delta = build_state_delta_message_patch(
        content_markdown="# Title",
        content_json={"analysis": {"title": "Title"}},
        analysis_run_id="run-1",
    )
    assert delta["contentMarkdown"] == "# Title"
    assert delta["contentJson"]["analysis"]["title"] == "Title"
    assert delta["analysisRunId"] == "run-1"


def test_message_patch_input_from_accumulator() -> None:
    inp = message_patch_input_from_state_delta_accumulator(
        {
            "contentMarkdown": "md",
            "contentJson": {"analysis": {"title": "t"}},
            "analysisRunId": "rid",
        },
        revision=2,
        agent_steps=[{"name": "diy", "status": "completed"}],
        client_routing_hint="checkpoint",
    )
    assert inp.revision == 2
    assert inp.analysis_run_id == "rid"
    assert inp.client_routing_hint == "checkpoint"
