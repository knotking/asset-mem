"""Unit tests for conversational intent classification."""

from __future__ import annotations

from types import SimpleNamespace

import pytest

from property_agent.conversational_intent import (
    CHECKPOINT_LAST_RESPONSE_KIND_KEY,
    GREETING_PHRASES,
    ACKNOWLEDGMENT_PHRASES,
    PHRASE_CATEGORIES,
    classify_turn,
    is_conversational_turn,
    is_substantive_signal,
    last_turn_delivered_checkpoint_analysis,
    normalize_user_query,
    should_skip_tools,
)

SUBSTANTIVE_PHRASES = [
    "recommend providers for garage door repair",
    "analyse my checkpoints",
    "find someone open on weekends",
    "what about DIY instead",
    "how much would it cost",
    "show me checkpoints with water damage",
    "is this covered by insurance",
    "compare kitchen checkpoints",
    "why is that excluded",
]


def _all_casual_phrases() -> list[str]:
    out: list[str] = []
    for key, values in PHRASE_CATEGORIES.items():
        if key == "off_topic":
            continue
        out.extend(values)
    return out


@pytest.mark.parametrize("phrase", GREETING_PHRASES[:12])
def test_greeting_phrases_not_substantive(phrase: str) -> None:
    assert classify_turn(phrase) == "greeting"
    assert should_skip_tools(phrase)


@pytest.mark.parametrize("phrase", ACKNOWLEDGMENT_PHRASES[:20])
def test_acknowledgment_phrases_not_substantive(phrase: str) -> None:
    assert classify_turn(phrase) == "acknowledgment"
    assert should_skip_tools(phrase)


@pytest.mark.parametrize("phrase", _all_casual_phrases())
def test_casual_fixture_phrases_are_conversational(phrase: str) -> None:
    assert is_conversational_turn(phrase), phrase


@pytest.mark.parametrize("phrase", SUBSTANTIVE_PHRASES)
def test_substantive_phrases(phrase: str) -> None:
    assert classify_turn(phrase) == "substantive"
    assert not should_skip_tools(phrase)
    assert is_substantive_signal(normalize_user_query(phrase))


def test_normalize_strips_punctuation() -> None:
    assert normalize_user_query("  Hello!  ") == "hello"


def test_last_turn_analysis_from_state() -> None:
    state = {CHECKPOINT_LAST_RESPONSE_KIND_KEY: "analysis"}
    assert last_turn_delivered_checkpoint_analysis(None, state=state)


def _mock_analysis_event(text: str) -> SimpleNamespace:
    part = SimpleNamespace(text=text)
    content = SimpleNamespace(parts=[part])
    return SimpleNamespace(
        invocation_id="prev-inv",
        author="doculink_agent",
        content=content,
    )


def test_last_turn_analysis_from_session_events() -> None:
    body = (
        "# Summary\n\n```json\n"
        '{"analysis": {"serviceResults": {"localPros": {}}}}\n'
        "```"
    )
    events = [_mock_analysis_event(body)]
    assert last_turn_delivered_checkpoint_analysis(
        events,
        current_invocation_id="current-inv",
    )


@pytest.mark.parametrize(
    "phrase",
    ["looks good", "thanks", "got it", "perfect", "I'm good for now"],
)
def test_acknowledgment_after_analysis_skips_tools(phrase: str) -> None:
    events = [
        _mock_analysis_event(
            '```json\n{"analysis": {"serviceResults": {}}}\n```'
        )
    ]
    assert should_skip_tools(
        phrase,
        session_events=events,
        current_invocation_id="inv-2",
    )


def test_new_question_after_analysis_stays_substantive() -> None:
    events = [
        _mock_analysis_event(
            '```json\n{"analysis": {"serviceResults": {}}}\n```'
        )
    ]
    query = "find providers open on weekends"
    assert classify_turn(
        query,
        session_events=events,
        current_invocation_id="inv-2",
    ) == "substantive"
    assert not should_skip_tools(
        query,
        session_events=events,
        current_invocation_id="inv-2",
    )


def test_what_about_diy_after_analysis() -> None:
    events = [
        _mock_analysis_event(
            '```json\n{"analysis": {"diyResults": {}}}\n```'
        )
    ]
    assert classify_turn(
        "what about DIY instead",
        session_events=events,
        current_invocation_id="inv-2",
    ) == "substantive"
