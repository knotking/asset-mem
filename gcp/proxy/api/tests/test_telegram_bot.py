"""Tests for Telegram bot message formatting (V2 prose, no dual-format split)."""

from unittest.mock import patch

from services.telegram_bot import safe_markdown_format


@patch("services.telegram_bot.telegramify_markdown.markdownify", side_effect=lambda s: s)
def test_safe_markdown_strips_json_fence(mock_markdownify) -> None:
    fenced = (
        "# Garage overview\n\n"
        '```json\n{"analysis": {"title": "Garage"}}\n```\n'
    )
    out = safe_markdown_format(fenced)
    assert "Garage overview" in out
    assert "```json" not in out
    assert '"analysis"' not in out
    mock_markdownify.assert_called_once()


@patch("services.telegram_bot.telegramify_markdown.markdownify", side_effect=lambda s: s)
def test_safe_markdown_plain_prose_unchanged(mock_markdownify) -> None:
    prose = "# Hello\n\nThis is plain markdown."
    assert safe_markdown_format(prose) == prose
    mock_markdownify.assert_called_once()
