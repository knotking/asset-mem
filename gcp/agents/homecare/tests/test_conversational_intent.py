"""Unit tests for conversational intent classification."""

from __future__ import annotations

from types import SimpleNamespace

import pytest

from property_agent.conversational_intent import (
    apply_query_gated_optional_agents,
    CHECKPOINT_LAST_RESPONSE_KIND_KEY,
    GREETING_PHRASES,
    ACKNOWLEDGMENT_PHRASES,
    LAST_OFFERED_OPTIONS_KEY,
    PHRASE_CATEGORIES,
    build_conversational_reply,
    classify_turn,
    expand_indexical_user_query,
    hydrate_turn_state_from_context,
    is_conversational_turn,
    is_substantive_signal,
    last_turn_delivered_checkpoint_analysis,
    normalize_user_query,
    parse_turn_payload_from_text,
    record_last_offered_options,
    requests_checkpoint_optional_analysis,
    resolve_requested_optional_branches,
    requests_property_information,
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


@pytest.mark.parametrize(
    "raw_query",
    [
        "Hello. Good morning",
        "I don't know. What do you suggest",
        "I don\u2019t know. What do you suggest",
    ],
)
def test_adk_web_style_queries_classify_conversational(raw_query: str) -> None:
    assert classify_turn(raw_query) in ("greeting", "capabilities")
    assert should_skip_tools(raw_query)


def test_parse_turn_payload_curly_quotes() -> None:
    text = (
        '{ "user_query": \u201cHello. Good morning\u201d, '
        '"property_address": "1982 Helena Way, Brentwood, CA 94513" }'
    )
    payload = parse_turn_payload_from_text(text)
    assert payload is not None
    assert payload["user_query"] == "Hello. Good morning"
    assert "1982 Helena Way" in payload["property_address"]


def test_hydrate_overwrites_stale_state_with_current_invocation() -> None:
    hello = SimpleNamespace(
        invocation_id="inv-1",
        author="user",
        content=SimpleNamespace(
            parts=[
                SimpleNamespace(
                    text='{ "user_query": "Hello. Good morning", "property_address": "A" }'
                )
            ]
        ),
    )
    kitchen = SimpleNamespace(
        invocation_id="inv-2",
        author="user",
        content=SimpleNamespace(
            parts=[
                SimpleNamespace(
                    text=(
                        '{ "user_query": "Can you show me the latest inspection notes '
                        'for the kitchen?", "property_address": "A" }'
                    )
                )
            ]
        ),
    )
    ctx = SimpleNamespace(
        state={"user_query": "Hello. Good morning", "property_address": "A"},
        _invocation_context=SimpleNamespace(
            invocation_id="inv-2",
            session=SimpleNamespace(events=[hello, kitchen]),
        ),
    )
    uq = hydrate_turn_state_from_context(ctx)
    assert "kitchen" in uq
    assert ctx.state["user_query"] == uq


def test_hydrate_turn_state_from_session_event() -> None:
    part = SimpleNamespace(
        text=(
            '{ "user_query": "hello", '
            '"property_address": "1982 Helena Way, Brentwood, CA 94513" }'
        )
    )
    content = SimpleNamespace(parts=[part])
    event = SimpleNamespace(
        invocation_id="inv-1",
        author="user",
        content=content,
    )
    ctx = SimpleNamespace(
        state={},
        _invocation_context=SimpleNamespace(
            invocation_id="inv-1",
            session=SimpleNamespace(events=[event]),
        ),
    )
    assert hydrate_turn_state_from_context(ctx) == "hello"
    assert ctx.state["property_address"] == "1982 Helena Way, Brentwood, CA 94513"


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


def test_capability_inquiry_user_example() -> None:
    query = "i don't know. you can tell me how you can help me?"
    assert classify_turn(query) == "capabilities"
    assert should_skip_tools(query)
    body = build_conversational_reply(
        "capabilities", property_address="1982 Helena Way"
    )
    assert "Maintenance checkpoints" in body
    assert "DIY" in body
    assert "Cost" in body
    assert "Repairs and Maintenance" not in body
    assert "Pest Control" not in body


def test_vague_suggest_with_attachments_is_capabilities() -> None:
    query = "I don't know. What do you suggest"
    assert classify_turn(query) == "capabilities"
    assert should_skip_tools(query)
    state = {
        "checkpoint_ids": ["HMaFGfwgL58ef5bGYS8o", "CZMA72oMvQPHRsq7phyb"],
        "context_doc_uris": ["gs://bucket/doc.pdf"],
        "checkpoint_optional_agents": ["coverage", "diy", "service", "cost"],
    }
    body = build_conversational_reply(
        "capabilities",
        property_address="1982 Helena Way, Brentwood, CA 94513",
        state=state,
    )
    assert "checkpoints selected" in body
    assert "documents attached" in body
    assert "Is this issue covered" in body


def test_help_me_with_stays_substantive() -> None:
    assert classify_turn("help me with my garage door") == "substantive"


def test_property_document_followup_after_analysis_is_substantive() -> None:
    events = [
        _mock_analysis_event(
            '```json\n{"analysis": {"checkpointSummary": {}}}\n```'
        )
    ]
    query = "I mean tell me about property document"
    assert requests_property_information(normalize_user_query(query))
    assert (
        classify_turn(
            query,
            session_events=events,
            current_invocation_id="inv-9",
        )
        == "substantive"
    )
    assert not should_skip_tools(
        query,
        session_events=events,
        current_invocation_id="inv-9",
    )


def test_show_inspection_notes_retrieval_only_not_optional_analysis() -> None:
    query = "Can you show me the latest inspection notes for the kitchen?"
    assert classify_turn(query) == "substantive"
    assert not requests_checkpoint_optional_analysis(query)


def test_analyse_checkpoints_requests_optional_analysis() -> None:
    assert requests_checkpoint_optional_analysis("analyse my checkpoints")
    assert requests_checkpoint_optional_analysis("recommend providers for garage door")


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


@pytest.mark.parametrize(
    "phrase",
    ["first one", "second one", "the third one", "2nd one"],
)
def test_indexical_followups_are_substantive(phrase: str) -> None:
    assert classify_turn(phrase) == "substantive"
    assert not should_skip_tools(phrase)


def test_short_ambiguous_after_analysis_is_substantive_not_ack() -> None:
    events = [
        _mock_analysis_event(
            '```json\n{"analysis": {"serviceResults": {}}}\n```'
        )
    ]
    assert classify_turn(
        "second one",
        session_events=events,
        current_invocation_id="inv-2",
    ) == "substantive"
    assert not should_skip_tools(
        "second one",
        session_events=events,
        current_invocation_id="inv-2",
    )


def test_expand_indexical_second_one_after_capability_list() -> None:
    state: dict = {}
    record_last_offered_options(state)
    assert LAST_OFFERED_OPTIONS_KEY in state
    expanded = expand_indexical_user_query("the second one", state)
    assert "uploaded property documents" in expanded.lower()
    assert expand_indexical_user_query("hello", state) == "hello"


def test_hello_with_task_stays_substantive() -> None:
    query = "hello show me the latest inspection notes for the kitchen"
    assert classify_turn(query) == "substantive"
    assert not should_skip_tools(query)


def test_i_mean_coverage_requests_coverage_branch() -> None:
    assert resolve_requested_optional_branches("I mean coverage") == ["coverage"]
    assert requests_checkpoint_optional_analysis("I mean coverage")


def test_third_one_in_list_requests_coverage_branch() -> None:
    state: dict = {}
    record_last_offered_options(state)
    query = "how about third one in your list?"
    assert resolve_requested_optional_branches(query, state) == ["coverage"]
    assert requests_checkpoint_optional_analysis(query, state=state)
    assert "warranty and insurance coverage" in expand_indexical_user_query(
        query, state
    ).lower()


def test_apply_query_gated_sets_coverage_only() -> None:
    state = {
        "checkpoint_optional_agents": ["coverage", "diy", "service", "cost"],
    }
    apply_query_gated_optional_agents(state, "I mean coverage")
    assert state["checkpoint_optional_agents"] == ["coverage"]
