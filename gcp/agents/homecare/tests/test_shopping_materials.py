"""Tests for material-based shopping queries."""

import json
from unittest.mock import MagicMock

import pytest

from property_agent.agents.shopping_agent import agent as shopping_mod


def test_product_recommendations_from_materials_merges_dedupes(monkeypatch):
    calls: list[str] = []

    def fake_fetch(query, **kwargs):
        calls.append(query)
        if "primer" in query.lower():
            rows = [{"title": "Rust-Oleum Metal Primer", "source": "Home Depot", "product_link": "http://a"}]
        else:
            rows = [
                {"title": "Rust-Oleum Metal Primer", "source": "Lowes", "product_link": "http://b"},
                {"title": "Exterior Acrylic Paint", "source": "Sherwin", "product_link": "http://c"},
            ]
        return rows, False

    monkeypatch.setenv("SERP_API_KEY", "test-key")
    monkeypatch.setattr(shopping_mod, "_fetch_shopping_results", fake_fetch)

    raw = shopping_mod.product_recommendations_from_materials(
        ["exterior metal primer", "exterior acrylic paint"],
        "DIY",
    )
    data = json.loads(raw)
    products = data["recommendedProducts"]["DIY"]["products"]
    names = [p["item_name"] for p in products]
    assert len(calls) == 2
    assert "DIY repair products tools" not in " ".join(calls)
    assert names.count("Rust-Oleum Metal Primer") == 1
    assert "Exterior Acrylic Paint" in names


def test_product_recommendations_round_robin_one_per_material_before_extras(
    monkeypatch,
):
    """First pass picks one product per material even when primer returns many rows."""
    monkeypatch.setenv("SERP_API_KEY", "test-key")

    def fake_fetch(query, **kwargs):
        q = query.lower()
        if "primer" in q:
            rows = [
                {"title": f"Primer {n}", "source": "Store", "product_link": f"http://p{n}"}
                for n in range(1, 5)
            ]
        elif "paint" in q:
            rows = [
                {
                    "title": "Exterior Touch-Up Paint",
                    "source": "Store",
                    "product_link": "http://paint",
                },
                {
                    "title": "Second Paint Can",
                    "source": "Store",
                    "product_link": "http://paint2",
                },
            ]
        elif "sandpaper" in q:
            rows = [
                {
                    "title": "Fine Grit Sandpaper Pack",
                    "source": "Store",
                    "product_link": "http://sand",
                }
            ]
        else:
            rows = []
        return rows, False

    monkeypatch.setattr(shopping_mod, "_fetch_shopping_results", fake_fetch)

    raw = shopping_mod.product_recommendations_from_materials(
        ["garage door primer", "exterior touch-up paint", "fine grit sandpaper"],
        "DIY",
        max_products=5,
    )
    names = [
        p["item_name"]
        for p in json.loads(raw)["recommendedProducts"]["DIY"]["products"]
    ]
    assert names[0] == "Primer 1"
    assert names[1] == "Exterior Touch-Up Paint"
    assert names[2] == "Fine Grit Sandpaper Pack"
    assert "Fine Grit Sandpaper Pack" in names
    assert any("paint" in n.lower() and "primer" not in n.lower() for n in names)


def test_merge_material_products_round_robin_unit() -> None:
    pools = [
        [{"item_name": "A1"}, {"item_name": "A2"}],
        [{"item_name": "B1"}],
        [{"item_name": "C1"}, {"item_name": "C2"}],
    ]
    merged = shopping_mod._merge_material_products_round_robin(pools, max_products=4)
    assert [p["item_name"] for p in merged] == ["A1", "B1", "C1", "A2"]


def test_product_recommendations_from_materials_default_max_is_ten(monkeypatch):
    monkeypatch.setenv("SERP_API_KEY", "test-key")
    assert shopping_mod.DEFAULT_MATERIAL_MAX_PRODUCTS == 10

    def fake_fetch(query, **kwargs):
        return (
            [
                {
                    "title": f"{query} A",
                    "source": "Store",
                    "product_link": f"http://a-{query.replace(' ', '-')}",
                },
                {
                    "title": f"{query} B",
                    "source": "Store",
                    "product_link": f"http://b-{query.replace(' ', '-')}",
                },
            ],
            False,
        )

    monkeypatch.setattr(shopping_mod, "_fetch_shopping_results", fake_fetch)

    raw = shopping_mod.product_recommendations_from_materials(
        ["garage door primer", "touch-up paint", "sandpaper", "painter tape", "paint brush"],
        "DIY",
    )
    products = json.loads(raw)["recommendedProducts"]["DIY"]["products"]
    assert len(products) == 10


def test_product_recommendations_uses_material_queries_param(monkeypatch):
    monkeypatch.setenv("SERP_API_KEY", "test-key")
    mock_materials = MagicMock(return_value='{"recommendedProducts": {"DIY": {"products": []}}}')
    monkeypatch.setattr(shopping_mod, "product_recommendations_from_materials", mock_materials)

    shopping_mod.product_recommendations(
        "ignored",
        material_queries=["exterior paint"],
    )
    mock_materials.assert_called_once()
    assert mock_materials.call_args[0][0] == ["exterior paint"]
