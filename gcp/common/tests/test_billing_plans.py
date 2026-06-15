import base64
import os

from common.billing_plans import (
    BUILTIN_FREE_TIER_PLAN,
    FREE_PLAN_KEY,
    free_tier_plan,
    is_checkout_tier,
    is_stripe_checkout_price_id,
    parse_stripe_b2c_price_plans_json,
    plan_for_price,
    plan_for_tier,
    plans_json_from_env,
    report_generations_limit_from_mapping,
    stripe_price_id_for_tier,
)

TIER_JSON = """{
  "free": {
    "monthlyTokenLimit": 1000000,
    "monthlyDocumentLimit": 2,
    "monthlyCheckpointLimit": 5
  },
  "plus": {
    "stripePriceId": "price_plus_stripe",
    "monthlyTokenLimit": 10000000,
    "monthlyDocumentLimit": 10,
    "monthlyCheckpointLimit": 30
  },
  "pro": {
    "stripePriceId": "price_pro_stripe",
    "monthlyTokenLimit": 25000000,
    "monthlyDocumentLimit": 30,
    "monthlyCheckpointLimit": 100
  }
}"""


def test_free_plan_key():
    free = free_tier_plan(TIER_JSON)
    assert free is not None
    assert free.monthly_token_limit == 1_000_000
    assert free.monthly_document_limit == 2
    assert free.monthly_checkpoint_limit == 5
    assert free.stripe_price_id is None


def test_checkout_by_tier():
    plus = plan_for_tier(TIER_JSON, "plus")
    assert plus is not None
    assert plus.monthly_token_limit == 10_000_000
    assert stripe_price_id_for_tier(TIER_JSON, "plus") == "price_plus_stripe"
    assert is_checkout_tier("plus", TIER_JSON) is True
    assert is_checkout_tier("free", TIER_JSON) is False
    assert plan_for_tier(TIER_JSON, FREE_PLAN_KEY) is None


def test_plan_for_price_by_stripe_id():
    pro = plan_for_price(TIER_JSON, "price_pro_stripe")
    assert pro is not None
    assert pro.monthly_token_limit == 25_000_000


def test_plans_json_from_env_plain_json(monkeypatch):
    monkeypatch.setenv("STRIPE_B2C_PRICE_TOKEN_CAPS_JSON", TIER_JSON)
    assert plans_json_from_env() == TIER_JSON


def test_plans_json_from_env_base64(monkeypatch):
    encoded = base64.b64encode(TIER_JSON.encode("utf-8")).decode("ascii")
    monkeypatch.setenv("STRIPE_B2C_PRICE_TOKEN_CAPS_JSON", encoded)
    assert plans_json_from_env() == TIER_JSON
    assert free_tier_plan(plans_json_from_env()) is not None


def test_legacy_price_key():
    raw = '{"price_legacy": 8000000}'
    plans = parse_stripe_b2c_price_plans_json(raw)
    assert plans["price_legacy"].monthly_token_limit == 8_000_000
    assert plans["price_legacy"].stripe_price_id == "price_legacy"
    assert is_stripe_checkout_price_id("price_legacy", raw) is True


def test_report_generations_limit_key():
    raw = """{
      "free": {
        "monthlyTokenLimit": 1000000,
        "monthlyDocumentLimit": 2,
        "monthlyCheckpointLimit": 5,
        "monthlyReportGenerationsLimit": 3
      }
    }"""
    free = free_tier_plan(raw)
    assert free is not None
    assert free.monthly_report_generations == 3


def test_report_generations_legacy_key_fallback():
    raw = """{
      "free": {
        "monthlyTokenLimit": 1000000,
        "monthlyReportGenerations": 7
      }
    }"""
    free = free_tier_plan(raw)
    assert free is not None
    assert free.monthly_report_generations == 7


def test_report_generations_limit_prefers_new_key():
    raw = """{
      "free": {
        "monthlyReportGenerationsLimit": 4,
        "monthlyReportGenerations": 99
      }
    }"""
    free = free_tier_plan(raw)
    assert free is not None
    assert free.monthly_report_generations == 4


def test_free_tier_plan_builtin_when_env_empty():
    free = free_tier_plan("")
    assert free == BUILTIN_FREE_TIER_PLAN


def test_free_tier_plan_builtin_when_free_key_missing():
    raw = """{
      "plus": {
        "stripePriceId": "price_plus_stripe",
        "monthlyTokenLimit": 10000000,
        "monthlyDocumentLimit": 10,
        "monthlyCheckpointLimit": 30
      }
    }"""
    free = free_tier_plan(raw)
    assert free.monthly_document_limit == BUILTIN_FREE_TIER_PLAN.monthly_document_limit
    assert free.monthly_checkpoint_limit == BUILTIN_FREE_TIER_PLAN.monthly_checkpoint_limit
    assert free.monthly_report_generations == BUILTIN_FREE_TIER_PLAN.monthly_report_generations


def test_report_generations_limit_from_mapping():
    assert report_generations_limit_from_mapping({"monthlyReportGenerationsLimit": 5}) == 5
    assert report_generations_limit_from_mapping({"monthlyReportGenerations": 6}) == 6
    assert (
        report_generations_limit_from_mapping(
            {"monthlyReportGenerationsLimit": 2, "monthlyReportGenerations": 9}
        )
        == 2
    )
    assert report_generations_limit_from_mapping({}) is None
