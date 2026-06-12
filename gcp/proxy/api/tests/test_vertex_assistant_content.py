"""Tests for checkpoint assistant content normalization in vertex_service."""

from services.vertex_service import (
    _checkpoint_progress_display_text,
    _has_structured_message_patch,
    _normalize_assistant_content_for_persist,
    _resolve_assistant_message_fields_for_persist,
    _should_replace_assistant_content,
    _strip_user_query_echoes,
    extract_text_from_event,
)


def test_strip_user_query_echoes():
    body = "analyse my checkpoints\n\n# Checkpoint analysis\n\n```json\n{}\n```"
    assert _strip_user_query_echoes(body, "analyse my checkpoints") == (
        "# Checkpoint analysis\n\n```json\n{}\n```"
    )


def test_should_replace_for_synthesis_author():
    event = {"author": "checkpoint_analysis_synthesis_agent"}
    assert _should_replace_assistant_content(event, "short text") is True


def test_should_replace_for_synthesis_prose_payload():
    text = "# Title\n\nstructured payload"
    assert _should_replace_assistant_content(
        {"author": "checkpoint_analysis_synthesis_agent"}, text
    ) is True


def test_should_replace_when_state_delta_carries_content_markdown_snapshot() -> None:
    assert _should_replace_assistant_content(
        {
            "author": "property_agent",
            "actions": {
                "state_delta": {
                    "contentMarkdown": "# Garage Door\n\nSummary.",
                }
            },
        },
        "",
    )


def _accumulate_stream_display_text(accumulated: str, event: dict) -> str:
    """Mirror stream_query assistant_content_accumulated update logic."""
    event_text = extract_text_from_event(event)
    display_text = _checkpoint_progress_display_text(event, event_text)
    if not display_text:
        return accumulated
    if _should_replace_assistant_content(event, event_text):
        return display_text
    return accumulated + display_text


def test_checkpoint_stream_does_not_duplicate_synthesis_markdown() -> None:
    summary = "# Garage Door\n\nSummary text."
    brief = "I've completed the analysis above."
    synthesis_patch = {"contentMarkdown": summary, "contentJson": {"analysis": {}}}

    accumulated = ""
    for event in (
        {
            "author": "checkpoint_analysis_progress",
            "content": {"parts": [{"text": summary}]},
            "actions": {"state_delta": synthesis_patch},
        },
        {
            "author": "property_agent",
            "content": {
                "parts": [{"function_response": {"name": "analyze_checkpoints"}}]
            },
            "actions": {"state_delta": synthesis_patch},
        },
        {
            "author": "property_agent",
            "content": {"parts": [{"text": brief}]},
        },
    ):
        accumulated = _accumulate_stream_display_text(accumulated, event)

    assert accumulated == summary + brief
    assert accumulated.count("# Garage Door") == 1

    legacy, markdown, _ = _resolve_assistant_message_fields_for_persist(
        assistant_content_accumulated=accumulated,
        user_query="estimate costs",
        message_content_patch=synthesis_patch,
        prose_only_persist=True,
        finalize=True,
        agent_steps_by_name=None,
        optional_agent_keys=None,
    )
    assert markdown == accumulated
    assert legacy == accumulated


def test_retrieval_only_kitchen_stream_keeps_summary_and_executor_prose() -> None:
    """Retrieval-only analyze_checkpoints (branches=[]) + kitchen follow-up prose."""
    summary = (
        "# Checkpoint analysis\n\n"
        "## Checkpoint Summary\n"
        "- **Checkpoints Analyzed**: 2\n"
        "- **Locations**: Kitchen, Garage"
    )
    executor = (
        "\n\nI checked your recorded checkpoints, and there are currently "
        "**no issues or checkpoints registered for the kitchen**."
    )
    retrieval_patch = {
        "contentMarkdown": summary,
        "contentJson": {
            "analysis": {
                "checkpointSummary": {
                    "checkpointsAnalyzed": 2,
                    "locations": ["Kitchen", "Garage"],
                }
            }
        },
        "analysisRunId": "run-kitchen-retrieval",
    }

    accumulated = ""
    for event in (
        {
            "author": "checkpoint_analysis_progress",
            "content": {"parts": [{"text": summary}]},
            "actions": {"state_delta": retrieval_patch},
        },
        {
            "author": "property_agent",
            "content": {
                "parts": [{"function_response": {"name": "analyze_checkpoints"}}]
            },
            "actions": {"state_delta": retrieval_patch},
        },
        {
            "author": "property_agent",
            "content": {"parts": [{"text": executor}]},
        },
    ):
        accumulated = _accumulate_stream_display_text(accumulated, event)

    assert accumulated == summary + executor
    assert accumulated.count("# Checkpoint analysis") == 1
    assert "no issues or checkpoints registered for the kitchen" in accumulated

    legacy, markdown, content_json = _resolve_assistant_message_fields_for_persist(
        assistant_content_accumulated=accumulated,
        user_query="any issues in kitchen?",
        message_content_patch=retrieval_patch,
        prose_only_persist=True,
        finalize=True,
        agent_steps_by_name=None,
        optional_agent_keys=None,
    )
    assert markdown == accumulated
    assert legacy == accumulated
    assert content_json == retrieval_patch["contentJson"]


def test_normalize_strips_query_and_dedupes():
    merged = "analyse my checkpoints\n\n# Summary\n\nstructured payload"
    out = _normalize_assistant_content_for_persist(merged, "analyse my checkpoints")
    assert "# Summary" in out
    assert not out.startswith("analyse my checkpoints")


def test_normalize_prose_only_persist_strips_json_fence() -> None:
    merged = (
        "# Garage overview\n\n"
        '```json\n{"analysis": {"title": "Garage"}}\n```\n'
    )
    out = _normalize_assistant_content_for_persist(
        merged,
        "analyse my checkpoints",
        prose_only_persist=True,
    )
    assert "Garage overview" in out
    assert "```json" not in out
    assert '"analysis"' not in out


def test_has_structured_message_patch_detects_content_json() -> None:
    assert _has_structured_message_patch(
        {"contentJson": {"analysis": {"title": "T"}}}
    )
    assert not _has_structured_message_patch({})


def test_resolve_assistant_message_fields_prefers_state_delta_patch() -> None:
    legacy, markdown, content_json = _resolve_assistant_message_fields_for_persist(
        assistant_content_accumulated="ignored dual body",
        user_query="q",
        message_content_patch={
            "contentMarkdown": "# From agent",
            "contentJson": {"analysis": {"title": "Agent"}},
        },
        prose_only_persist=True,
        finalize=False,
        agent_steps_by_name=None,
        optional_agent_keys=None,
    )
    assert markdown == "# From agent"
    assert legacy == "# From agent"
    assert content_json == {"analysis": {"title": "Agent"}}


def test_resolve_assistant_message_fields_keeps_executor_prose_after_checkpoint_summary() -> None:
    summary = "# Checkpoint analysis\n\n## Checkpoint Summary\n- **Checkpoints Analyzed**: 2"
    executor = (
        "\n\nI checked your recorded checkpoints, and there are currently "
        "**no issues or checkpoints registered for the kitchen**."
    )
    accumulated = summary + executor
    legacy, markdown, content_json = _resolve_assistant_message_fields_for_persist(
        assistant_content_accumulated=accumulated,
        user_query="any issues in kitchen?",
        message_content_patch={
            "contentMarkdown": summary,
            "contentJson": {"analysis": {"checkpointSummary": {"checkpointsAnalyzed": 2}}},
        },
        prose_only_persist=True,
        finalize=True,
        agent_steps_by_name=None,
        optional_agent_keys=None,
    )
    assert "no issues or checkpoints registered for the kitchen" in markdown
    assert markdown == accumulated
    assert legacy == accumulated
    assert content_json == {"analysis": {"checkpointSummary": {"checkpointsAnalyzed": 2}}}


def test_resolve_assistant_message_fields_no_fence_fallback_without_state_delta() -> None:
    dual = (
        "# Summary\n\n"
        '```json\n{"analysis": {"title": "Split"}}\n```\n'
    )
    legacy, markdown, content_json = _resolve_assistant_message_fields_for_persist(
        assistant_content_accumulated=dual,
        user_query="q",
        message_content_patch={},
        prose_only_persist=True,
        finalize=False,
        agent_steps_by_name=None,
        optional_agent_keys=None,
    )
    assert "Summary" in markdown
    assert "```json" not in markdown
    assert content_json is None
    assert "```json" not in legacy
