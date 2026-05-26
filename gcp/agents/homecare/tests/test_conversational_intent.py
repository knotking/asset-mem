"""Unit tests for conversational turn helpers used on the production path."""

from __future__ import annotations

from types import SimpleNamespace

from property_agent.conversational_intent import (
    CHECKPOINT_LAST_RESPONSE_KIND_KEY,
    LAST_OFFERED_OPTIONS_KEY,
    build_conversational_reply,
    hydrate_turn_state_from_context,
    is_greeting_like,
    last_turn_delivered_checkpoint_analysis,
    normalize_user_query,
    parse_turn_payload_from_text,
    record_last_offered_options,
    requests_checkpoint_optional_analysis,
    resolve_requested_optional_branches,
)


def test_normalize_strips_punctuation() -> None:
    assert normalize_user_query("  Hello!  ") == "hello"


def test_is_greeting_like() -> None:
    assert is_greeting_like("hello")
    assert not is_greeting_like("show me kitchen checkpoints")


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
        author="property_agent",
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


def test_build_capabilities_reply() -> None:
    body = build_conversational_reply(
        "capabilities", property_address="1982 Helena Way"
    )
    assert "Maintenance checkpoints" in body
    assert "DIY" in body
    assert "Cost" in body
    assert "Repairs and Maintenance" not in body


def test_build_capabilities_with_attachments_hint() -> None:
    state = {
        "checkpoint_ids": ["cp1"],
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


def test_show_inspection_notes_retrieval_only_not_optional_analysis() -> None:
    query = "Can you show me the latest inspection notes for the kitchen?"
    assert not requests_checkpoint_optional_analysis(query)


def test_analyse_checkpoints_requests_optional_analysis() -> None:
    assert requests_checkpoint_optional_analysis("analyse my checkpoints")
    assert requests_checkpoint_optional_analysis("recommend providers for garage door")


def test_i_mean_coverage_requests_coverage_branch() -> None:
    assert resolve_requested_optional_branches("I mean coverage") == ["coverage"]
    assert requests_checkpoint_optional_analysis("I mean coverage")


def test_how_about_cost_requests_cost_branch() -> None:
    assert resolve_requested_optional_branches("how about cost?") == ["cost"]


def test_third_one_in_list_requests_coverage_branch() -> None:
    state: dict = {}
    record_last_offered_options(state)
    query = "how about third one in your list?"
    assert LAST_OFFERED_OPTIONS_KEY in state
    assert resolve_requested_optional_branches(query, state) == ["coverage"]
    assert requests_checkpoint_optional_analysis(query, state=state)
