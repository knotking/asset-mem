import json
from unittest.mock import MagicMock, patch

import pytest

from services.report_service import (
    ComparisonResolution,
    MAX_REPORTS_PER_PROPERTY,
    _ReportDocRollback,
    _ReportRagContext,
    _checkpoint_preview_dict,
    _pick_latest_per_location,
    _rollback_report_doc,
    archive_report_revision,
    comparison_resolution_warnings,
    get_report_status,
    prepare_report_generation,
    prepare_report_preview,
    prepare_report_preview_html,
    publish_report_generation,
    resolve_comparison_checkpoints,
    resolve_comparison_from_checkpoint_ids,
    resolve_rental_comparison_checkpoints,
    set_report_rag_index,
    update_report_metadata,
    validate_checkpoints_for_report,
    _parse_iso_date,
    _normalize_location,
)
from schemas.reports import (
    GenerateReportRequest,
    ReportDateRangeInput,
    ReportPreviewHtmlRequest,
    ReportPreviewRequest,
    ReportRagIndexRequest,
    ReportStatusRequest,
    UpdateReportMetadataRequest,
)


def test_parse_iso_date_single_day():
    dt = _parse_iso_date("2026-06-01")
    assert dt.hour == 0


def test_parse_iso_date_end_of_day():
    dt = _parse_iso_date("2026-06-01", end_of_day=True)
    assert dt.hour == 23


def test_validate_checkpoints_requires_completed():
    with pytest.raises(ValueError, match="completed analysis"):
        validate_checkpoints_for_report(
            [{"id": "a", "analysisStatus": "pending"}]
        )


def test_validate_checkpoints_empty():
    with pytest.raises(ValueError, match="No checkpoints"):
        validate_checkpoints_for_report([])


def test_normalize_location_default():
    assert _normalize_location(None) == "unspecified"


@patch("services.report_service._reports_collection")
def test_rollback_report_doc_deletes_new_report(mock_reports_collection):
    db = MagicMock()
    request = GenerateReportRequest(
        userId="user-1",
        propertyId="prop-1",
        title="Test",
        mode="snapshot",
        purpose="custom",
        snapshotRange=ReportDateRangeInput(start="2026-06-01", end="2026-06-02"),
    )
    report_ref = MagicMock()
    mock_reports_collection.return_value.document.return_value = report_ref

    _rollback_report_doc(
        db,
        request,
        "report-new",
        _ReportDocRollback(is_new=True),
    )

    report_ref.delete.assert_called_once()
    report_ref.set.assert_not_called()


@patch("services.report_service.check_and_record_monthly_report_generations")
@patch("services.report_service.publish_report_generation")
@patch("services.report_service.create_or_reset_report_doc")
@patch("services.report_service.validate_checkpoints_for_report")
@patch("services.report_service.resolve_snapshot_checkpoints")
def test_prepare_report_generation_rolls_back_on_publish_failure(
    mock_resolve,
    _mock_validate,
    mock_create_doc,
    mock_publish,
    _mock_record,
):
    db = MagicMock()
    request = GenerateReportRequest(
        userId="user-1",
        propertyId="prop-1",
        title="Test",
        mode="snapshot",
        purpose="custom",
        snapshotRange=ReportDateRangeInput(start="2026-06-01", end="2026-06-02"),
    )
    mock_resolve.return_value = [{"id": "cp-1", "analysisStatus": "completed"}]
    mock_create_doc.return_value = (
        "report-1",
        1,
        _ReportDocRollback(is_new=True),
        _ReportRagContext(),
    )
    mock_publish.side_effect = RuntimeError("pubsub down")

    with patch("services.report_service._rollback_report_doc") as mock_rollback:
        with pytest.raises(RuntimeError, match="pubsub down"):
            prepare_report_generation(db, request)

    mock_rollback.assert_called_once_with(
        db,
        request,
        "report-1",
        _ReportDocRollback(is_new=True),
    )
    _mock_record.assert_not_called()


def test_pick_latest_per_location_prefers_newer_checkpoint():
    older = {
        "id": "old",
        "location": "Garage",
        "createdAt": "2026-06-01T10:00:00+00:00",
        "assetConfidence": 0.5,
    }
    newer = {
        "id": "new",
        "location": "Garage",
        "createdAt": "2026-06-08T10:00:00+00:00",
        "assetConfidence": 0.4,
    }
    picked = _pick_latest_per_location([older, newer])
    assert picked["garage"]["id"] == "new"


@patch("services.report_service._collect_checkpoints_in_range")
def test_resolve_comparison_checkpoints_pairs_by_location(mock_collect):
    mock_collect.side_effect = [
        [
            {"id": "b1", "location": "Garage", "createdAt": "2026-01-01T00:00:00+00:00"},
            {"id": "b2", "location": "Kitchen", "createdAt": "2026-01-02T00:00:00+00:00"},
        ],
        [
            {"id": "c1", "location": "Garage", "createdAt": "2026-06-01T00:00:00+00:00"},
            {"id": "c3", "location": "Bedroom", "createdAt": "2026-06-02T00:00:00+00:00"},
        ],
    ]
    db = MagicMock()
    resolution = resolve_comparison_checkpoints(
        db,
        "user-1",
        "prop-1",
        baseline_range={"start": "2026-01-01", "end": "2026-01-31"},
        comparison_range={"start": "2026-06-01", "end": "2026-06-30"},
    )
    assert len(resolution.pairs) == 1
    assert resolution.pairs[0]["baselineCheckpointId"] == "b1"
    assert resolution.pairs[0]["comparisonCheckpointId"] == "c1"
    assert resolution.baseline_only_ids == ["b2"]
    assert resolution.comparison_only_ids == ["c3"]


@patch("services.report_service._load_checkpoints_by_ids")
def test_resolve_comparison_from_checkpoint_ids_skips_collection_scan(mock_load):
    mock_load.return_value = [
        {"id": "b1", "location": "Garage", "createdAt": "2026-01-01T00:00:00+00:00"},
        {"id": "b2", "location": "Kitchen", "createdAt": "2026-01-02T00:00:00+00:00"},
        {"id": "c1", "location": "Garage", "createdAt": "2026-06-01T00:00:00+00:00"},
        {"id": "c3", "location": "Bedroom", "createdAt": "2026-06-02T00:00:00+00:00"},
    ]
    db = MagicMock()
    resolution = resolve_comparison_from_checkpoint_ids(
        db,
        "user-1",
        "prop-1",
        checkpoint_ids=["b1", "b2", "c1", "c3"],
        baseline_range={"start": "2026-01-01", "end": "2026-01-31"},
        comparison_range={"start": "2026-06-01", "end": "2026-06-30"},
    )
    assert len(resolution.pairs) == 1
    assert resolution.pairs[0]["baselineCheckpointId"] == "b1"
    assert resolution.pairs[0]["comparisonCheckpointId"] == "c1"
    mock_load.assert_called_once()


@patch("services.report_service._collect_checkpoints_in_range")
def test_resolve_rental_comparison_pairs_earliest_and_latest(mock_collect):
    mock_collect.return_value = [
        {"id": "g1", "location": "Garage", "createdAt": "2026-06-05T10:00:00+00:00"},
        {"id": "g2", "location": "Garage", "createdAt": "2026-06-20T10:00:00+00:00"},
        {"id": "k1", "location": "Kitchen", "createdAt": "2026-06-08T10:00:00+00:00"},
    ]
    db = MagicMock()
    resolution = resolve_rental_comparison_checkpoints(
        db,
        "user-1",
        "prop-1",
        tenancy_range={"start": "2026-06-01", "end": "2026-06-30"},
    )
    assert len(resolution.pairs) == 1
    assert resolution.pairs[0]["baselineCheckpointId"] == "g1"
    assert resolution.pairs[0]["comparisonCheckpointId"] == "g2"
    assert resolution.baseline_only_ids == ["k1"]


def test_archive_report_revision_writes_subcollection():
    db = MagicMock()
    revision_doc = MagicMock()
    revisions_collection = MagicMock()
    revisions_collection.document.return_value = revision_doc
    report_doc = MagicMock()
    report_doc.collection.return_value = revisions_collection
    reports_collection = MagicMock()
    reports_collection.document.return_value = report_doc

    with patch("services.report_service._reports_collection", return_value=reports_collection):
        archive_report_revision(
            db,
            "user-1",
            "prop-1",
            "report-1",
            {
                "revision": 2,
                "status": "ready",
                "pdfStoragePath": "uploads/u/p/reports/r/v2.pdf",
                "title": "Old title",
            },
        )

    revision_doc.set.assert_called_once()
    payload = revision_doc.set.call_args[0][0]
    assert payload["revision"] == 2
    assert payload["pdfStoragePath"] == "uploads/u/p/reports/r/v2.pdf"


def test_update_report_metadata_title():
    db = MagicMock()
    snap = MagicMock()
    snap.exists = True
    snap.to_dict.return_value = {"status": "ready", "title": "Old"}
    ref = MagicMock()
    ref.get.return_value = snap
    reports_collection = MagicMock()
    reports_collection.document.return_value = ref

    with patch("services.report_service._reports_collection", return_value=reports_collection):
        result = update_report_metadata(
            db,
            UpdateReportMetadataRequest(
                userId="user-1",
                propertyId="prop-1",
                reportId="report-1",
                title="New title",
            ),
        )

    assert result["ok"] is True
    ref.update.assert_called_once()
    assert ref.update.call_args[0][0]["title"] == "New title"


@patch("services.report_service.report_docs_chat_rag_enabled", return_value=True)
@patch("services.report_service._publish_report_rag_import")
@patch("services.report_service.check_and_record_monthly_document_creations")
@patch("services.report_service._upsert_report_rag_companion_doc")
def test_set_report_rag_index_enable(mock_upsert, mock_record, mock_publish, _mock_flag):
    db = MagicMock()
    snap = MagicMock()
    snap.exists = True
    snap.to_dict.return_value = {
        "status": "ready",
        "title": "Move-out",
        "mdGsUri": "gs://b/u/p/reports/r/v1.md",
        "mdStoragePath": "uploads/u/p/reports/r/v1.md",
        "includeInDocsChat": False,
    }
    ref = MagicMock()
    ref.get.return_value = snap
    reports_collection = MagicMock()
    reports_collection.document.return_value = ref
    mock_publish.return_value = "msg-1"

    with patch("services.report_service._reports_collection", return_value=reports_collection):
        result = set_report_rag_index(
            db,
            ReportRagIndexRequest(
                userId="user-1",
                propertyId="prop-1",
                reportId="report-1",
                includeInDocsChat=True,
            ),
        )

    assert result["ok"] is True
    assert result["includeInDocsChat"] is True
    mock_record.assert_called_once()
    mock_upsert.assert_called_once()
    mock_publish.assert_called_once()
    ref.update.assert_called_once()


def test_set_report_rag_index_enable_rejected_when_flag_off():
    db = MagicMock()
    snap = MagicMock()
    snap.exists = True
    snap.to_dict.return_value = {
        "status": "ready",
        "mdGsUri": "gs://b/u/p/reports/r/v1.md",
        "includeInDocsChat": False,
    }
    ref = MagicMock()
    ref.get.return_value = snap
    reports_collection = MagicMock()
    reports_collection.document.return_value = ref

    with (
        patch("services.report_service._reports_collection", return_value=reports_collection),
        patch("services.report_service.report_docs_chat_rag_enabled", return_value=False),
    ):
        with pytest.raises(ValueError, match="not enabled"):
            set_report_rag_index(
                db,
                ReportRagIndexRequest(
                    userId="user-1",
                    propertyId="prop-1",
                    reportId="report-1",
                    includeInDocsChat=True,
                ),
            )


@patch("services.report_service._delete_report_rag_companion_doc")
@patch("services.report_service._delete_report_rag_uris", return_value=[])
def test_set_report_rag_index_disable(mock_delete_rag, mock_delete_doc):
    db = MagicMock()
    snap = MagicMock()
    snap.exists = True
    snap.to_dict.return_value = {
        "status": "ready",
        "includeInDocsChat": True,
        "ragGsUri": "gs://b/u/p/reports/r/v1.md",
        "ragCompanionDocId": "doc-1",
    }
    ref = MagicMock()
    ref.get.return_value = snap
    reports_collection = MagicMock()
    reports_collection.document.return_value = ref

    with patch("services.report_service._reports_collection", return_value=reports_collection):
        result = set_report_rag_index(
            db,
            ReportRagIndexRequest(
                userId="user-1",
                propertyId="prop-1",
                reportId="report-1",
                includeInDocsChat=False,
            ),
        )

    assert result["includeInDocsChat"] is False
    mock_delete_rag.assert_called_once_with(["gs://b/u/p/reports/r/v1.md"])
    mock_delete_doc.assert_called_once_with(db, "user-1", "doc-1")


@patch("services.report_service.report_docs_chat_rag_enabled", return_value=True)
@patch("services.report_service.pubsub_v1.PublisherClient")
def test_publish_report_generation_forwards_rag_context(mock_publisher_cls, _mock_flag):
    publisher = MagicMock()
    publisher.topic_path.return_value = "projects/p/topics/t"
    publisher.publish.return_value.result.return_value = "mid"
    mock_publisher_cls.return_value = publisher

    with patch("services.report_service.PROJECT_ID", "p"):
        publish_report_generation(
            request=GenerateReportRequest(
                userId="user-1",
                propertyId="prop-1",
                title="Test",
                mode="snapshot",
                purpose="custom",
                snapshotRange=ReportDateRangeInput(start="2026-06-01", end="2026-06-02"),
            ),
            report_id="report-1",
            revision=2,
            checkpoint_ids=["cp-1"],
            rag_context=_ReportRagContext(
                include_in_docs_chat=True,
                rag_companion_doc_id="doc-1",
            ),
        )

    published = publisher.publish.call_args.kwargs.get("data") or publisher.publish.call_args[0][1]
    payload = json.loads(published.decode("utf-8"))
    assert payload["includeInDocsChat"] is True
    assert payload["ragCompanionDocId"] == "doc-1"


@patch("services.report_service.report_docs_chat_rag_enabled", return_value=False)
@patch("services.report_service.pubsub_v1.PublisherClient")
def test_publish_report_generation_skips_rag_context_when_flag_off(
    mock_publisher_cls, _mock_flag
):
    publisher = MagicMock()
    publisher.topic_path.return_value = "projects/p/topics/t"
    publisher.publish.return_value.result.return_value = "mid"
    mock_publisher_cls.return_value = publisher

    with patch("services.report_service.PROJECT_ID", "p"):
        publish_report_generation(
            request=GenerateReportRequest(
                userId="user-1",
                propertyId="prop-1",
                title="Test",
                mode="snapshot",
                purpose="custom",
                snapshotRange=ReportDateRangeInput(start="2026-06-01", end="2026-06-02"),
            ),
            report_id="report-1",
            revision=2,
            checkpoint_ids=["cp-1"],
            rag_context=_ReportRagContext(
                include_in_docs_chat=True,
                rag_companion_doc_id="doc-1",
            ),
        )

    published = publisher.publish.call_args.kwargs.get("data") or publisher.publish.call_args[0][1]
    payload = json.loads(published.decode("utf-8"))
    assert "includeInDocsChat" not in payload


@patch("services.report_service._count_property_reports")
def test_prepare_report_generation_rejects_property_report_cap(mock_count):
    mock_count.return_value = MAX_REPORTS_PER_PROPERTY
    db = MagicMock()
    request = GenerateReportRequest(
        userId="user-1",
        propertyId="prop-1",
        title="Test",
        mode="snapshot",
        purpose="custom",
        snapshotRange=ReportDateRangeInput(start="2026-06-01", end="2026-06-02"),
    )
    with pytest.raises(ValueError, match=str(MAX_REPORTS_PER_PROPERTY)):
        prepare_report_generation(db, request)


@patch("services.report_service.resolve_snapshot_checkpoints")
def test_prepare_report_preview_snapshot(mock_resolve):
    db = MagicMock()
    mock_resolve.return_value = [
        {
            "id": "cp-1",
            "name": "Kitchen",
            "location": "Kitchen",
            "analysisStatus": "completed",
            "capturedAt": "2026-06-01T12:00:00Z",
        }
    ]
    request = ReportPreviewRequest(
        userId="user-1",
        propertyId="prop-1",
        mode="snapshot",
        snapshotRange=ReportDateRangeInput(start="2026-06-01", end="2026-06-02"),
    )
    result = prepare_report_preview(db, request)
    assert result["mode"] == "snapshot"
    assert len(result["checkpoints"]) == 1
    assert result["checkpoints"][0]["checkpointId"] == "cp-1"


@patch("services.report_service._reports_collection")
def test_get_report_status_ready(mock_reports_collection):
    db = MagicMock()
    report_ref = MagicMock()
    mock_reports_collection.return_value.document.return_value = report_ref
    report_ref.get.return_value.exists = True
    report_ref.get.return_value.to_dict.return_value = {
        "status": "ready",
        "revision": 2,
        "failureReason": None,
    }
    result = get_report_status(
        db,
        ReportStatusRequest(userId="user-1", propertyId="prop-1", reportId="report-1"),
    )
    assert result["status"] == "ready"
    assert result["revision"] == 2


def test_prepare_report_preview_html_requires_snapshot_range():
    db = MagicMock()
    request = ReportPreviewHtmlRequest(
        userId="user-1",
        propertyId="prop-1",
        title="Preview report",
        mode="snapshot",
        purpose="custom",
    )
    with pytest.raises(ValueError, match="snapshotRange"):
        prepare_report_preview_html(db, request)


def test_checkpoint_preview_dict_shape():
    row = _checkpoint_preview_dict(
        {
            "id": "cp-1",
            "name": "Garage",
            "location": "Garage",
            "analysisStatus": "pending",
        }
    )
    assert row["checkpointId"] == "cp-1"
    assert row["analysisStatus"] == "pending"


def test_comparison_resolution_warnings_low_pair_rate():
    resolution = ComparisonResolution(
        pairs=[{"location": "Garage", "baselineCheckpointId": "b1", "comparisonCheckpointId": "c1"}],
        baseline_only_ids=["b2", "b3"],
        comparison_only_ids=["c2"],
    )
    warnings = comparison_resolution_warnings(resolution)
    assert any("25%" in w for w in warnings)
