"""Tests for checkpoint synthesis LLM prompt."""

from property_agent.checkpoint.analysis.synthesis_runner import _synthesis_user_content


def test_synthesis_prompt_requires_issue_specific_title_not_executive_summary():
    prompt = _synthesis_user_content(
        {"title": "Garage door"},
        checkpoint_results="Checkpoint Name: Garage",
        user_query="What should I fix?",
    )
    assert "Executive Summary" in prompt
    assert 'Do NOT use generic titles like "Executive Summary"' in prompt
    assert "issue-specific" in prompt.lower() or "specific issue title" in prompt
