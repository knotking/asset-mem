"""Tests for monthly creation limit resolution and enforcement."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from common.plan_limits import (
    MonthlyCreationLimits,
    PlanLimitExceeded,
    check_monthly_checkpoint_creations_allowed,
    check_monthly_document_creations_allowed,
    check_monthly_report_generations_allowed,
    get_plan_limits_status,
    resolve_monthly_checkpoint_limit,
    resolve_monthly_document_limit,
    resolve_monthly_report_generations_limit,
)


def _free_defaults() -> MonthlyCreationLimits:
    return MonthlyCreationLimits(document_limit=2, checkpoint_limit=5, report_limit=2)


def _usage_collection(db: MagicMock, usage_data: dict | None) -> None:
    snap = MagicMock()
    snap.exists = usage_data is not None
    snap.to_dict.return_value = usage_data or {}
    ref = MagicMock()
    ref.get.return_value = snap
    db.collection.return_value.document.return_value = ref


@patch("common.plan_limits._preferences")
@patch("common.plan_limits._billing_summary")
@patch("common.plan_limits._free_tier_defaults", return_value=_free_defaults())
def test_resolve_monthly_document_limit_prefers_billing(
    _mock_free, mock_billing, mock_prefs
):
    mock_billing.return_value = {"monthlyDocumentLimit": 10}
    mock_prefs.return_value = {"monthlyDocumentLimit": 99}
    db = MagicMock()
    assert resolve_monthly_document_limit(db, "user-1") == 10


@patch("common.plan_limits._preferences")
@patch("common.plan_limits._billing_summary", return_value=None)
@patch("common.plan_limits._free_tier_defaults", return_value=_free_defaults())
def test_resolve_monthly_document_limit_falls_back_to_free(
    _mock_free, _mock_billing, mock_prefs
):
    mock_prefs.return_value = {}
    db = MagicMock()
    assert resolve_monthly_document_limit(db, "user-1") == 2


@patch("common.plan_limits._preferences")
@patch("common.plan_limits._billing_summary")
@patch("common.plan_limits._free_tier_defaults", return_value=_free_defaults())
def test_resolve_monthly_report_limit_legacy_key(
    _mock_free, mock_billing, mock_prefs
):
    mock_billing.return_value = {"monthlyReportGenerations": 12}
    mock_prefs.return_value = {}
    db = MagicMock()
    assert resolve_monthly_report_generations_limit(db, "user-1") == 12


@patch("common.plan_limits.current_quota_period_key", return_value="2026-06")
@patch("common.plan_limits.resolve_monthly_checkpoint_limit", return_value=5)
def test_check_monthly_checkpoint_creations_raises_at_cap(
    _mock_resolve, _mock_period
):
    db = MagicMock()
    _usage_collection(
        db,
        {"quotaPeriodKey": "2026-06", "periodCheckpointCreations": 5},
    )
    with pytest.raises(PlanLimitExceeded) as exc_info:
        check_monthly_checkpoint_creations_allowed(db, "user-1", 1)
    assert exc_info.value.error_code == "CHECKPOINT_QUOTA_EXCEEDED"
    assert exc_info.value.used == 5
    assert exc_info.value.limit == 5


@patch("common.plan_limits.current_quota_period_key", return_value="2026-06")
@patch("common.plan_limits.resolve_monthly_document_limit", return_value=2)
def test_check_monthly_document_creations_allows_under_cap(
    _mock_resolve, _mock_period
):
    db = MagicMock()
    _usage_collection(
        db,
        {"quotaPeriodKey": "2026-06", "periodDocumentCreations": 1},
    )
    check_monthly_document_creations_allowed(db, "user-1", 1)


@patch("common.plan_limits.current_quota_period_key", return_value="2026-06")
@patch("common.plan_limits.resolve_monthly_report_generations_limit", return_value=0)
def test_check_monthly_report_generations_unlimited_when_limit_zero(
    _mock_resolve, _mock_period
):
    db = MagicMock()
    _usage_collection(
        db,
        {"quotaPeriodKey": "2026-06", "periodReportGenerations": 99},
    )
    check_monthly_report_generations_allowed(db, "user-1", 1)


@patch("common.plan_limits.current_quota_period_key", return_value="2026-06")
@patch("common.plan_limits.resolve_monthly_document_limit", return_value=2)
@patch("common.plan_limits.resolve_monthly_checkpoint_limit", return_value=5)
@patch("common.plan_limits.resolve_monthly_report_generations_limit", return_value=2)
def test_get_plan_limits_status(
    _mock_report, _mock_cp, _mock_doc, _mock_period
):
    db = MagicMock()
    _usage_collection(
        db,
        {
            "quotaPeriodKey": "2026-06",
            "periodDocumentCreations": 1,
            "periodCheckpointCreations": 2,
            "periodReportGenerations": 0,
        },
    )
    status = get_plan_limits_status(db, "user-1")
    assert status["period"] == "2026-06"
    assert status["documents"] == {
        "used": 1,
        "limit": 2,
        "unlimited": False,
    }
    assert status["checkpoints"]["used"] == 2
    assert status["reports"]["limit"] == 2
