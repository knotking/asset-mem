"""Unit tests for Apple billing helpers."""

from __future__ import annotations

import json
from unittest.mock import MagicMock, patch

import pytest
from fastapi import HTTPException

from services import apple_billing_service as apple_billing


PLANS_JSON = json.dumps(
    {
        "free": {"monthlyTokenLimit": 1_000_000},
        "plus": {
            "appleProductId": "com.assetmem.app.plus.monthly",
            "monthlyTokenLimit": 10_000_000,
            "monthlyDocumentLimit": 10,
            "monthlyCheckpointLimit": 30,
            "monthlyReportGenerationsLimit": 10,
        },
        "pro": {
            "appleProductId": "com.assetmem.app.pro.monthly",
            "monthlyTokenLimit": 25_000_000,
            "monthlyDocumentLimit": 30,
            "monthlyCheckpointLimit": 100,
            "monthlyReportGenerationsLimit": 30,
        },
    }
)


def test_firebase_uid_to_app_account_token_is_uuid():
    a = apple_billing.firebase_uid_to_app_account_token("abc123")
    b = apple_billing.firebase_uid_to_app_account_token("abc123")
    c = apple_billing.firebase_uid_to_app_account_token("other")
    assert a == b
    assert a != c
    assert len(a) == 36


def test_decode_jws_payload_roundtrip():
    import base64

    payload = {"productId": "com.assetmem.app.plus.monthly", "transactionId": "1"}
    encoded = (
        base64.urlsafe_b64encode(json.dumps(payload).encode("utf-8")).decode("ascii").rstrip("=")
    )
    signed = f"header.{encoded}.sig"
    decoded = apple_billing._decode_jws_payload(signed)
    assert decoded["productId"] == "com.assetmem.app.plus.monthly"


@patch("services.apple_billing_service.settings")
def test_transaction_entitlement_rejects_unknown_product(mock_settings):
    mock_settings.APPLE_BUNDLE_ID = "com.assetmem.app"
    mock_settings.STRIPE_B2C_PRICE_TOKEN_CAPS_JSON = PLANS_JSON
    with pytest.raises(HTTPException) as exc:
        apple_billing._transaction_entitlement_from_payload(
            {
                "bundleId": "com.assetmem.app",
                "productId": "com.unknown.product",
                "originalTransactionId": "100",
                "transactionId": "100",
            }
        )
    assert exc.value.status_code == 400


@patch("services.apple_billing_service.settings")
def test_sync_apple_subscription_writes_limits(mock_settings):
    mock_settings.STRIPE_B2C_PRICE_TOKEN_CAPS_JSON = PLANS_JSON
    db = MagicMock()
    ref = MagicMock()
    db.collection.return_value.document.return_value.collection.return_value.document.return_value = ref
    db.collection.return_value.document.return_value.set = MagicMock()

    apple_billing.sync_apple_subscription_to_firestore(
        db,
        "uid1",
        apple_product_id="com.assetmem.app.plus.monthly",
        apple_original_transaction_id="orig-1",
        subscription_status="active",
    )
    ref.set.assert_called_once()
    payload = ref.set.call_args[0][0]
    assert payload["billingProvider"] == "apple"
    assert payload["monthlyTokenLimit"] == 10_000_000
    assert payload["subscriptionStatus"] == "active"
