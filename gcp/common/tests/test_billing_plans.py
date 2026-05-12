from common.billing_plans import (
    FREE_PLAN_KEY,
    free_tier_plan,
    is_checkout_tier,
    is_stripe_checkout_price_id,
    parse_stripe_b2c_price_plans_json,
    plan_for_price,
    plan_for_tier,
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


def test_legacy_price_key():
    raw = '{"price_legacy": 8000000}'
    plans = parse_stripe_b2c_price_plans_json(raw)
    assert plans["price_legacy"].monthly_token_limit == 8_000_000
    assert plans["price_legacy"].stripe_price_id == "price_legacy"
    assert is_stripe_checkout_price_id("price_legacy", raw) is True
