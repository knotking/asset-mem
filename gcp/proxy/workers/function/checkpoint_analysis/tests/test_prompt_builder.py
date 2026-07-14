from __future__ import annotations

from prompt_builder import build_analysis_prompt, get_asset_category


def test_get_asset_category_front_lawn():
    assert get_asset_category("Front Lawn") == "landscape_irrigation"


def test_get_asset_category_sprinkler_heads():
    assert get_asset_category("Sprinkler Heads") == "landscape_irrigation"


def test_get_asset_category_kitchen_stays_property():
    assert get_asset_category("Kitchen") == "property"


def test_get_asset_category_landscape_from_features():
    assert (
        get_asset_category(
            "Outdoor Area",
            asset_features=["sprinkler heads", "turf", "mulch"],
        )
        == "landscape_irrigation"
    )


def test_get_asset_category_none_is_generic():
    assert get_asset_category(None) == "generic"


def test_build_analysis_prompt_landscape_includes_scores():
    prompt = build_analysis_prompt(
        media_type="image",
        location="Front Lawn",
        asset_category="landscape_irrigation",
    )
    assert "plant_health" in prompt
    assert "irrigation_coverage" in prompt
    assert "drainage" in prompt
