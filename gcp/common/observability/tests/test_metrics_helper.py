"""Tests for metrics_helper numeric coercion."""

from common.observability.metrics_helper import coerce_finite_float


def test_coerce_finite_float_accepts_numbers():
    assert coerce_finite_float(1500) == 1500.0
    assert coerce_finite_float(12.5) == 12.5
    assert coerce_finite_float("1200") == 1200.0


def test_coerce_finite_float_rejects_invalid():
    assert coerce_finite_float(None) is None
    assert coerce_finite_float(True) is None
    assert coerce_finite_float("N/A") is None
    assert coerce_finite_float(float("nan")) is None
    assert coerce_finite_float(float("inf")) is None
    assert coerce_finite_float({"min": 100}) is None
