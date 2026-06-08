"""Tests for deletion_service helpers."""

from unittest.mock import MagicMock, call, patch

import pytest
from google.api_core import exceptions as api_exceptions

from services import deletion_service


def test_property_job_id_stable():
    assert deletion_service._property_job_id("abc") == "property_abc"


def test_verify_data_erasure_admin_secret():
    with patch.dict("os.environ", {"DATA_ERASURE_ADMIN_SECRET": "secret"}, clear=False):
        assert deletion_service.verify_data_erasure_admin_secret("secret") is True
        assert deletion_service.verify_data_erasure_admin_secret("wrong") is False


@patch("services.deletion_service.delete_reasoning_engine_session")
def test_delete_agent_sessions_treats_missing_as_success(mock_delete):
    mock_delete.side_effect = Exception("404 not found")
    result = deletion_service.delete_agent_sessions("u1", ["s1"])
    assert result["deleted"] == 1


@patch("services.deletion_service.delete_rag_files_by_gcs_uris", return_value=(2, []))
def test_delete_rag_files(mock_rag):
    result = deletion_service.delete_rag_files(["gs://b/documents/u/f.pdf"])
    assert result["deleted"] == 2
    mock_rag.assert_called_once()


def test_firebase_storage_bucket_defaults_to_project():
    with patch.dict(
        "os.environ",
        {"GCP_PROJECT_ID": "homegeek-staging", "FIREBASE_STORAGE_BUCKET": ""},
        clear=False,
    ):
        assert (
            deletion_service._firebase_storage_bucket_name()
            == "homegeek-staging.firebasestorage.app"
        )


@patch("services.deletion_service._delete_doc_with_retry")
@patch("services.deletion_service._delete_gcs_prefix", return_value=(1, []))
@patch("services.deletion_service._firebase_storage_bucket_name", return_value="homegeek-staging.firebasestorage.app")
def test_delete_document_asset(mock_bucket, mock_gcs, mock_del_doc):
    db = MagicMock()
    doc_ref = MagicMock()
    doc_ref.get.return_value.exists = True
    db.collection.return_value.document.return_value.collection.return_value.document.return_value = doc_ref
    result = deletion_service.delete_document_asset(db, "u1", "d1", "documents/u1/f.pdf")
    assert result["deleted"] is True
    mock_del_doc.assert_called_once()


def test_get_deletion_job_missing():
    with patch("services.deletion_service.firestore.Client") as mock_client:
        mock_client.return_value.collection.return_value.document.return_value.collection.return_value.document.return_value.get.return_value.exists = False
        assert deletion_service.get_deletion_job("u1", "job1") is None


def test_is_transient_firestore_error():
    assert deletion_service._is_transient_firestore_error(api_exceptions.Unknown("None Stream removed"))
    assert deletion_service._is_transient_firestore_error(api_exceptions.ServiceUnavailable("unavailable"))
    assert not deletion_service._is_transient_firestore_error(ValueError("bad value"))


@patch("services.deletion_service.time.sleep")
def test_commit_with_retry_recovers_from_transient(mock_sleep):
    attempts = {"count": 0}

    def flaky():
        attempts["count"] += 1
        if attempts["count"] < 3:
            raise api_exceptions.Unknown("None Stream removed")

    deletion_service._commit_with_retry(flaky)
    assert attempts["count"] == 3
    assert mock_sleep.call_count == 2


@patch("services.deletion_service.time.sleep")
def test_commit_with_retry_raises_non_transient(mock_sleep):
    def raises_value_error():
        raise ValueError("nope")

    with pytest.raises(ValueError):
        deletion_service._commit_with_retry(raises_value_error)
    mock_sleep.assert_not_called()


@patch("services.deletion_service._commit_batch_with_retry")
def test_delete_collection_docs_paginates(mock_commit):
    db = MagicMock()
    batch = MagicMock()
    db.batch.return_value = batch

    doc1 = MagicMock()
    doc2 = MagicMock()
    col_ref = MagicMock()
    col_ref.limit.return_value.stream.side_effect = [[doc1, doc2], []]

    deleted = deletion_service._delete_collection_docs(db, col_ref)

    assert deleted == 2
    batch.delete.assert_has_calls([call(doc1.reference), call(doc2.reference)])
    mock_commit.assert_called_once_with(db, batch)


@patch("services.deletion_service.delete_shared_chats_for_property", return_value={"warnings": []})
@patch("services.deletion_service.delete_rag_files", return_value={"warnings": []})
@patch("services.deletion_service.delete_agent_sessions", return_value={"warnings": []})
@patch("services.deletion_service._delete_property_firestore")
@patch("services.deletion_service._delete_property_storage", return_value=[])
@patch("services.deletion_service._collect_property_assets")
@patch("services.deletion_service._update_job")
@patch("services.deletion_service.firestore.Client")
def test_property_job_runs_storage_before_firestore(
    mock_client,
    mock_update_job,
    mock_collect,
    mock_delete_storage,
    mock_delete_firestore,
    *_mocks,
):
    db = MagicMock()
    mock_client.return_value = db
    prop_ref = db.collection.return_value.document.return_value.collection.return_value.document.return_value
    prop_ref.get.return_value.exists = False
    mock_collect.return_value = {
        "gs_uris": [],
        "storage_paths": ["documents/u/f.pdf"],
        "agent_session_ids": [],
    }

    deletion_service._run_property_deletion_job("u1", "p1", "property_p1")

    phase_calls = [c.kwargs.get("phase") for c in mock_update_job.call_args_list if "phase" in c.kwargs]
    storage_idx = phase_calls.index("storage")
    firestore_idx = phase_calls.index("firestore")
    assert storage_idx < firestore_idx
    mock_delete_storage.assert_called_once_with("u1", "p1", ["documents/u/f.pdf"])
    mock_delete_firestore.assert_called_once_with(db, "u1", "p1")


@patch("services.deletion_service._write_audit_event", return_value="evt1")
@patch("services.deletion_service._mark_resource_delete_failed")
@patch("services.deletion_service._mark_resource_deleting")
def test_run_audited_resource_deletion_marks_failed(mock_mark, mock_failed, _mock_audit):
    db = MagicMock()
    ref = MagicMock()

    def boom():
        raise RuntimeError("delete blew up")

    result = deletion_service.run_audited_resource_deletion(
        db,
        user_id="u1",
        actor_uid="u1",
        resource_type="document",
        resource_ids=["d1"],
        resource_ref=ref,
        operation=boom,
    )
    assert result["ok"] is False
    mock_mark.assert_called_once()
    mock_failed.assert_called_once_with(ref, "delete blew up")
