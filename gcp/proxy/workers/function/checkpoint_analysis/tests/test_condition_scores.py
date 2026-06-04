from __future__ import annotations

from condition_scores import normalize_condition_scores


def test_normalize_preserves_explicit_overall():
    scores, status = normalize_condition_scores({"overall": 88, "roof": 90})
    assert scores["overall"] == 88.0
    assert status == "ok"


def test_normalize_derives_overall_from_components():
    scores, status = normalize_condition_scores({"walls": 80, "floor": 60})
    assert scores["overall"] == 70.0
    assert status == "derived"


def test_normalize_derives_overall_from_issues_when_no_scores():
    scores, status = normalize_condition_scores(
        {},
        issues=[{"description": "leak", "severity": "critical"}],
    )
    assert scores["overall"] == 40.0
    assert status == "derived"


def test_normalize_no_issues_sets_unavailable():
    scores, status = normalize_condition_scores({})
    assert scores["overall"] is None
    assert status == "unavailable"
