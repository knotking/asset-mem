from __future__ import annotations

from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock

from firebase_admin import firestore

from utils import (
    ANALYSIS_JOB_LEASE_SECONDS,
    resolve_user_preferences_from_payload,
    try_claim_checkpoint_analysis,
)


class _FakeTimestamp:
    def __init__(self, dt: datetime):
        if not dt.tzinfo:
            dt = dt.replace(tzinfo=timezone.utc)
        self._dt = dt
        self.seconds = int(dt.timestamp())

    def to_datetime(self) -> datetime:
        return self._dt


def test_try_claim_skips_completed():
    ref = MagicMock()
    ref.get.return_value.exists = True
    ref.get.return_value.to_dict.return_value = {"analysisStatus": "completed"}

    action, data = try_claim_checkpoint_analysis(ref, "c1", "job-1")

    assert action == "skip_completed"
    assert data["analysisStatus"] == "completed"
    ref.update.assert_not_called()


def test_try_claim_skips_in_flight():
    started = _FakeTimestamp(datetime.now(timezone.utc) - timedelta(seconds=60))
    ref = MagicMock()
    ref.get.return_value.exists = True
    ref.get.return_value.to_dict.return_value = {
        "analysisStatus": "processing",
        "analysisJobId": "job-existing",
        "analysisJobStartedAt": started,
    }

    action, _ = try_claim_checkpoint_analysis(ref, "c1", "job-2")

    assert action == "skip_in_flight"
    ref.update.assert_not_called()


def test_try_claim_reclaims_stale_processing():
    started = _FakeTimestamp(
        datetime.now(timezone.utc) - timedelta(seconds=ANALYSIS_JOB_LEASE_SECONDS + 30)
    )
    ref = MagicMock()
    ref.get.return_value.exists = True
    ref.get.return_value.to_dict.return_value = {
        "analysisStatus": "processing",
        "analysisJobId": "job-old",
        "analysisJobStartedAt": started,
    }

    action, _ = try_claim_checkpoint_analysis(ref, "c1", "job-new")

    assert action == "claimed"
    ref.update.assert_called_once()
    update_payload = ref.update.call_args[0][0]
    assert update_payload["analysisStatus"] == "processing"
    assert update_payload["analysisJobId"] == "job-new"
    assert update_payload["analysisJobStartedAt"] is firestore.SERVER_TIMESTAMP


def test_resolve_user_preferences_uses_payload():
    get_prefs = MagicMock()

    prefs = resolve_user_preferences_from_payload(
        {"checkpointComparison": {"enabled": False, "maxAgeDays": 45}},
        MagicMock(),
        "user-1",
        get_user_preferences=get_prefs,
    )

    assert prefs == {"checkpointComparison": {"enabled": False, "maxAgeDays": 45}}
    get_prefs.assert_not_called()


def test_resolve_user_preferences_falls_back_to_firestore():
    get_prefs = MagicMock(return_value={"checkpointComparison": {"enabled": True}})

    prefs = resolve_user_preferences_from_payload(
        {},
        MagicMock(),
        "user-1",
        get_user_preferences=get_prefs,
    )

    assert prefs["checkpointComparison"]["enabled"] is True
    get_prefs.assert_called_once()
