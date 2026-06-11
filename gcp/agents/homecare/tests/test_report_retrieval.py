from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from property_agent.reports.retrieval import (
    REPORT_RETRIEVAL_CACHE_FP_KEY,
    REPORT_RETRIEVAL_CACHE_TEXT_KEY,
    _load_reports_sync,
    report_retrieval,
    report_retrieval_cache_hit,
    report_retrieval_fingerprint,
)


def test_load_reports_sync_returns_chat_markdown() -> None:
    doc = MagicMock()
    doc.exists = True
    doc.to_dict.return_value = {
        "title": "Move-out report",
        "revision": 2,
        "status": "ready",
        "chatMarkdown": "## Kitchen\nMinor scuff on cabinet.",
    }

    reports_collection = MagicMock()
    reports_collection.document.return_value.get.return_value = doc
    properties_collection = MagicMock()
    properties_collection.document.return_value.collection.return_value = reports_collection
    users_collection = MagicMock()
    users_collection.document.return_value.collection.return_value = properties_collection
    db = MagicMock()
    db.collection.return_value = users_collection

    with patch("property_agent.reports.retrieval.firestore", create=True):
        with patch(
            "google.cloud.firestore.Client",
            return_value=db,
        ):
            text = _load_reports_sync(
                user_id="user-1",
                property_id="prop-1",
                report_ids=["report-1"],
            )

    assert "Move-out report" in text
    assert "Kitchen" in text
    assert "Minor scuff" in text
    assert "do not add roofing" in text


@pytest.mark.asyncio
async def test_report_retrieval_uses_session_cache_on_repeat() -> None:
    tool_context = MagicMock()
    tool_context.state = {
        "property_id": "prop-1",
        "report_ids": ["report-1"],
        REPORT_RETRIEVAL_CACHE_FP_KEY: report_retrieval_fingerprint(["report-1"]),
        REPORT_RETRIEVAL_CACHE_TEXT_KEY: "### Cached report\n\nKitchen ok.\n",
    }

    with patch(
        "property_agent.reports.retrieval.resolve_user_id_from_context",
        return_value="user-1",
    ):
        with patch("property_agent.reports.retrieval.asyncio.to_thread") as to_thread:
            result = await report_retrieval("Follow-up about kitchen?", tool_context)

    assert "Cached report" in result
    to_thread.assert_not_called()


def test_report_retrieval_cache_hit_requires_matching_fingerprint() -> None:
    state = {
        "report_ids": ["report-1"],
        REPORT_RETRIEVAL_CACHE_FP_KEY: report_retrieval_fingerprint(["report-1"]),
        REPORT_RETRIEVAL_CACHE_TEXT_KEY: "cached body",
    }
    assert report_retrieval_cache_hit(state) is True
    assert report_retrieval_cache_hit({**state, "report_ids": ["report-2"]}) is False


@pytest.mark.asyncio
async def test_report_retrieval_uses_invocation_session_user_id() -> None:
    from types import SimpleNamespace

    tool_context = SimpleNamespace(
        state={
            "property_id": "prop-1",
            "report_ids": ["report-1"],
        },
        _invocation_context=SimpleNamespace(
            session=SimpleNamespace(user_id="user-1"),
        ),
    )

    with patch(
        "property_agent.reports.retrieval.asyncio.to_thread",
        return_value="### Report\n\nKitchen ok.\n",
    ) as to_thread:
        result = await report_retrieval("reports please", tool_context)

    assert "Kitchen ok." in result
    to_thread.assert_called_once()


@pytest.mark.asyncio
async def test_report_retrieval_blocks_repeat_in_same_invocation() -> None:
    from types import SimpleNamespace

    from property_agent.reports.retrieval import (
        _INVOCATION_REPORT_RESULTS,
        store_invocation_report_result,
    )

    _INVOCATION_REPORT_RESULTS.clear()
    store_invocation_report_result("inv-loop", "### Cached report\n\nKitchen ok.\n")

    tool_context = SimpleNamespace(
        state={
            "property_id": "prop-1",
            "report_ids": ["report-1"],
        },
        _invocation_context=SimpleNamespace(
            invocation_id="inv-loop",
            session=SimpleNamespace(user_id="user-1"),
        ),
    )

    with patch(
        "property_agent.reports.retrieval.resolve_user_id_from_context",
        return_value="user-1",
    ):
        with patch("property_agent.reports.retrieval.asyncio.to_thread") as to_thread:
            result = await report_retrieval("summarize please", tool_context)

    assert "Kitchen ok." in result
    to_thread.assert_not_called()
    _INVOCATION_REPORT_RESULTS.clear()


@pytest.mark.asyncio
async def test_report_retrieval_requires_report_ids() -> None:
    tool_context = MagicMock()
    tool_context.state = {"property_id": "prop-1", "report_ids": []}

    with patch(
        "property_agent.reports.retrieval.resolve_user_id_from_context",
        return_value="user-1",
    ):
        result = await report_retrieval("What did the kitchen show?", tool_context)

    assert "report_ids are required" in result


def test_load_reports_sync_uses_archived_revision() -> None:
    current_doc = MagicMock()
    current_doc.exists = True
    current_doc.to_dict.return_value = {
        "title": "Move-out report",
        "revision": 3,
        "status": "ready",
        "chatMarkdown": "Current revision text",
    }
    archived_doc = MagicMock()
    archived_doc.exists = True
    archived_doc.to_dict.return_value = {
        "title": "Move-out report",
        "revision": 1,
        "status": "ready",
        "chatMarkdown": "Archived revision text",
    }

    report_doc_ref = MagicMock()
    report_doc_ref.get.return_value = current_doc
    revisions_collection = MagicMock()
    revisions_collection.document.return_value.get.return_value = archived_doc
    report_doc_ref.collection.return_value = revisions_collection

    reports_collection = MagicMock()
    reports_collection.document.return_value = report_doc_ref
    properties_collection = MagicMock()
    properties_collection.document.return_value.collection.return_value = reports_collection
    users_collection = MagicMock()
    users_collection.document.return_value.collection.return_value = properties_collection
    db = MagicMock()
    db.collection.return_value = users_collection

    with patch("google.cloud.firestore.Client", return_value=db):
        text = _load_reports_sync(
            user_id="user-1",
            property_id="prop-1",
            report_ids=["report-1"],
            report_revisions={"report-1": 1},
        )

    assert "Archived revision text" in text
    assert "(v1" in text


def test_primary_agent_report_routes_report() -> None:
    from property_agent.routing.executor_only_routing import minimal_substantive_resolved_turn

    state = {
        "primary_agent": "report",
        "report_ids": ["report-1"],
    }
    resolved = minimal_substantive_resolved_turn(
        state,
        user_query="What did the move-out report say about the kitchen?",
    )
    assert resolved.route == "report"
    assert resolved.retrieval_only is True
    assert resolved.run_optional_agents == []
