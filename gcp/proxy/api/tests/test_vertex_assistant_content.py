"""Tests for checkpoint assistant content normalization in vertex_service."""

from services.vertex_service import (
    _is_checkpoint_dual_format_content,
    _keep_last_checkpoint_dual_format,
    _normalize_assistant_content_for_persist,
    _should_replace_assistant_content,
    _strip_user_query_echoes,
)


def test_strip_user_query_echoes():
    body = "analyse my checkpoints\n\n# Checkpoint analysis\n\n```json\n{}\n```"
    assert _strip_user_query_echoes(body, "analyse my checkpoints") == (
        "# Checkpoint analysis\n\n```json\n{}\n```"
    )


def test_should_replace_for_synthesis_author():
    event = {"author": "checkpoint_analysis_synthesis_agent"}
    assert _should_replace_assistant_content(event, "short text") is True


def test_should_replace_for_dual_format_payload():
    text = "# Title\n\n```json\n{\"analysis\": {\"title\": \"T\"}}\n```\n"
    assert _is_checkpoint_dual_format_content(text)
    assert _should_replace_assistant_content({"author": "other"}, text) is True


def test_keep_last_checkpoint_dual_format_drops_earlier_copy():
    first = (
        "analyse my checkpoints\n\n# Checkpoint analysis\n\n"
        '```json\n{"analysis": {"title": "First"}}\n```\n\n'
    )
    second = (
        "# Analysis of Garage\n\nanalyse my checkpoints\n\n"
        "## Summary\n\n"
        '```json\n{"analysis": {"title": "Second"}}\n```\n'
    )
    merged = first + second
    kept = _keep_last_checkpoint_dual_format(merged)
    assert "First" not in kept
    assert "Second" in kept
    assert "analyse my checkpoints" not in kept.split("```json")[0]


def test_normalize_strips_query_and_dedupes():
    merged = (
        "analyse my checkpoints\n\n# First\n\n"
        '```json\n{"analysis": {"title": "First"}}\n```\n\n'
        "# Second\n\n"
        '```json\n{"analysis": {"title": "Second"}}\n```\n'
    )
    out = _normalize_assistant_content_for_persist(merged, "analyse my checkpoints")
    assert "First" not in out
    assert "Second" in out
    assert not out.startswith("analyse my checkpoints")
