from utils.message_patch_state import (
    apply_patches_deterministically,
    build_assistant_message_patch,
    constrain_content_json_size,
    is_stale_revision,
    next_revision,
    normalize_revision,
    should_apply_patch,
    validate_assistant_message_patch,
)


def test_normalize_revision_accepts_int_and_numeric_string() -> None:
    assert normalize_revision(3) == 3
    assert normalize_revision("7") == 7
    assert normalize_revision("-1", default=2) == 2
    assert normalize_revision(None, default=5) == 5


def test_next_revision_is_monotonic() -> None:
    assert next_revision(0) == 1
    assert next_revision(5) == 6


def test_is_stale_revision_true_for_equal_or_lower() -> None:
    assert is_stale_revision(incoming_revision=3, stored_revision=3) is True
    assert is_stale_revision(incoming_revision=2, stored_revision=3) is True
    assert is_stale_revision(incoming_revision=4, stored_revision=3) is False


def test_should_apply_patch_only_for_newer_revision() -> None:
    assert should_apply_patch(incoming_revision=4, stored_revision=3) is True
    assert should_apply_patch(incoming_revision=3, stored_revision=3) is False
    assert should_apply_patch(incoming_revision=2, stored_revision=3) is False


def test_build_assistant_message_patch_contains_revision() -> None:
    patch = build_assistant_message_patch(
        content="hello",
        agent_steps=[{"name": "a", "status": "executing"}],
        primary_agent="checkpoint",
        revision=9,
        updated_at="ts",
    )
    assert patch["role"] == "assistant"
    assert patch["content"] == "hello"
    assert patch["revision"] == 9
    assert patch["updatedAt"] == "ts"


def test_validate_assistant_message_patch_accepts_v2_payload() -> None:
    patch = build_assistant_message_patch(
        content="hello",
        agent_steps=[{"name": "a", "status": "executing"}],
        primary_agent="checkpoint",
        revision=1,
        updated_at="ts",
    )
    patch["contentMarkdown"] = "hello"
    patch["contentJson"] = {"analysis": {"title": "t"}}
    patch["contentSchemaVersion"] = 2
    validate_assistant_message_patch(patch)


def test_validate_assistant_message_patch_rejects_invalid_schema_version() -> None:
    patch = build_assistant_message_patch(
        content="hello",
        agent_steps=[],
        primary_agent="checkpoint",
        revision=1,
        updated_at="ts",
    )
    patch["contentMarkdown"] = "hello"
    patch["contentJson"] = {"analysis": {"title": "t"}}
    patch["contentSchemaVersion"] = 1
    try:
        validate_assistant_message_patch(patch)
    except ValueError as exc:
        assert "contentSchemaVersion" in str(exc)
        return
    raise AssertionError("expected ValueError")


def test_apply_patches_deterministically_ignores_stale_and_duplicates() -> None:
    p1 = {"revision": 1, "content": "one"}
    p2 = {"revision": 3, "content": "three"}
    p3 = {"revision": 2, "content": "two"}
    p4 = {"revision": 3, "content": "three-dup"}
    rev, state = apply_patches_deterministically([p1, p2, p3, p4], initial_revision=0)
    assert rev == 3
    assert state["content"] == "three"


def test_constrain_content_json_size_noop_when_under_budget() -> None:
    payload = {"analysis": {"title": "ok"}}
    constrained, truncated = constrain_content_json_size(payload, max_bytes=1024)
    assert truncated is False
    assert constrained == payload


def test_constrain_content_json_size_drops_heavy_sections_in_order() -> None:
    payload = {
        "analysis": {
            "title": "Big",
            "checkpointDetails": [{"i": i, "text": "x" * 120} for i in range(20)],
            "serviceResults": {
                "localPros": {"serpAPIResults": [{"name": f"p{i}"} for i in range(40)]}
            },
        }
    }
    constrained, truncated = constrain_content_json_size(payload, max_bytes=900)
    assert truncated is True
    assert constrained is not None
    analysis = constrained.get("analysis", {})
    assert "checkpointDetails" not in analysis


def test_constrain_content_json_size_fallback_summary_when_still_too_large() -> None:
    payload = {
        "analysis": {
            "title": "Huge",
            "checkpointDetails": [{"i": i, "text": "x" * 500} for i in range(30)],
            "serviceResults": {
                "localPros": {"serpAPIResults": [{"name": "p", "desc": "y" * 200} for _ in range(50)]}
            },
            "diyResults": {
                "youtubeSearch": {"videos": [{"title": "v", "meta": "z" * 200} for _ in range(50)]}
            },
        }
    }
    constrained, truncated = constrain_content_json_size(payload, max_bytes=120)
    assert truncated is True
    assert constrained is not None
    import json
    assert len(json.dumps(constrained, separators=(",", ":")).encode("utf-8")) <= 120

