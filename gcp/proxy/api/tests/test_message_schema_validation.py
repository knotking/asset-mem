from utils.message_patch_state import (
    build_assistant_message_patch,
    validate_assistant_message_patch,
)


def test_schema_validation_accepts_v2_message_fields() -> None:
    patch = build_assistant_message_patch(
        content="hello",
        agent_steps=[{"name": "run_checkpoint_pipeline", "status": "executing"}],
        primary_agent="checkpoint",
        revision=1,
        updated_at="ts",
    )
    patch["contentMarkdown"] = "hello"
    patch["contentJson"] = {"analysis": {"title": "Garage"}}
    patch["contentSchemaVersion"] = 2
    validate_assistant_message_patch(patch)


def test_schema_validation_rejects_non_v2_schema_version() -> None:
    patch = build_assistant_message_patch(
        content="hello",
        agent_steps=[],
        primary_agent="checkpoint",
        revision=2,
        updated_at="ts",
    )
    patch["contentMarkdown"] = "hello"
    patch["contentJson"] = {"analysis": {"title": "Garage"}}
    patch["contentSchemaVersion"] = 1
    try:
        validate_assistant_message_patch(patch)
    except ValueError as exc:
        assert "contentSchemaVersion" in str(exc)
        return
    raise AssertionError("expected ValueError")
