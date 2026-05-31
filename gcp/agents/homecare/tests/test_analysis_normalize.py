"""Tests for checkpoint analysis JSON normalization."""

import json

from property_agent.checkpoint.analysis.analysis_normalize import (
    apply_analysis_title_from_markdown,
    filter_relevant_youtube_videos,
    normalize_assembled_analysis,
)
from property_agent.checkpoint.analysis.markdown_render import build_fallback_analysis


def test_normalize_coerces_serpapi_error_string_to_empty_array() -> None:
    analysis = {
        "serviceResults": {
            "localPros": {
                "serpAPIResults": (
                    "SerpAPI search is currently unavailable. "
                    "Below are professional garage door service providers."
                ),
                "googleSearchResults": [
                    {
                        "name": "Wilfredo's Garage Door Service",
                        "contact": "(925) 318-7025",
                        "services": "Garage door repair",
                        "notes": "Free estimates",
                    }
                ],
            }
        }
    }
    normalize_assembled_analysis(analysis)
    local = analysis["serviceResults"]["localPros"]
    assert local["serpAPIResults"][0]["name"] == "Wilfredo's Garage Door Service"
    assert local["googleSearchResults"][0]["name"] == "Wilfredo's Garage Door Service"
    assert local["googleSearchResults"][0]["contact_info"] == "(925) 318-7025"
    assert "Free estimates" in local["googleSearchResults"][0]["additional_information"]


def test_normalize_merges_google_pros_into_serp_display() -> None:
    analysis = {
        "serviceResults": {
            "localPros": {
                "serpAPIResults": [
                    {"name": "Brentwood Ace Hardware", "rating": 4.7},
                    {"name": "Up Right Garage Door Repair", "rating": 4.9},
                ],
                "googleSearchResults": [
                    {"name": "Precision Garage Door", "contact": "(925) 555-0100"},
                ],
            }
        }
    }
    normalize_assembled_analysis(analysis)
    names = [r["name"] for r in analysis["serviceResults"]["localPros"]["serpAPIResults"]]
    assert names[0] == "Precision Garage Door"
    assert "Up Right Garage Door Repair" in names


def test_filter_youtube_ranks_by_stem_token_overlap() -> None:
    videos = [
        {
            "title": "Fix Car Paint Chips At Home",
            "url": "https://www.youtube.com/watch?v=car",
            "description": "automotive touch up for vehicles",
        },
        {
            "title": "Garage door paint repair tutorial",
            "url": "https://www.youtube.com/watch?v=garage",
            "description": "fix chipping paint on residential garage door",
        },
        {"title": "Missing URL", "description": "skipped"},
    ]
    stem = "Residential garage door paint chipping and scratches"
    out = filter_relevant_youtube_videos(videos, stem)
    assert len(out) == 2
    assert out[0]["url"].endswith("garage")
    assert out[1]["url"].endswith("car")


def test_filter_youtube_keeps_prefetch_rows_with_url_only() -> None:
    videos = [
        {
            "title": "HOW TO paint ceilings FAST",
            "url": "https://www.youtube.com/watch?v=abc",
            "description": "ceiling painting tips",
        },
        {
            "title": "Garage door paint repair tutorial",
            "url": "https://www.youtube.com/watch?v=def",
            "description": "fix chipping paint on garage door",
        },
        {"title": "Missing URL", "description": "skipped"},
    ]
    out = filter_relevant_youtube_videos(videos, "")
    assert len(out) == 2
    assert out[0]["url"].startswith("https://www.youtube.com/")


def test_sync_diy_cost_from_cost_branch() -> None:
    analysis = {
        "diyResults": {
            "diyCostEstimates": {
                "repair_type": "old",
                "DIY": {"cost_range": "$60-250"},
            }
        },
        "costEstimationResults": {
            "costEstimates": {
                "repair_type": "garage door paint repair",
                "DIY": {"cost_range": "$50-300", "includes": ["Materials"]},
            }
        },
    }
    normalize_assembled_analysis(analysis)
    diy_cost = analysis["diyResults"]["diyCostEstimates"]
    assert diy_cost["DIY"]["cost_range"] == "$50-300"
    assert diy_cost["repair_type"] == "garage door paint repair"


def test_property_address_on_checkpoint_summary() -> None:
    analysis = {"checkpointSummary": {"checkpointsAnalyzed": 1}}
    normalize_assembled_analysis(
        analysis, property_address="1982 Helena Way, Brentwood, CA 94513"
    )
    assert (
        analysis["checkpointSummary"]["propertyAddress"]
        == "1982 Helena Way, Brentwood, CA 94513"
    )


def test_apply_title_from_synthesis_markdown() -> None:
    analysis = {"title": "Checkpoint analysis"}
    md = "# Property Maintenance Analysis: 1982 Helena Way\n\n## Summary\n"
    apply_analysis_title_from_markdown(analysis, md)
    assert analysis["title"] == "Property Maintenance Analysis: 1982 Helena Way"


def test_build_fallback_analysis_normalizes_service_branch() -> None:
    service_json = json.dumps(
        {
            "serviceResults": {
                "localPros": {
                    "serpAPIResults": "SerpAPI Maps error: quota",
                    "googleSearchResults": [
                        {"provider": "Bay Door Co", "contact": "555-0100", "notes": "Local"}
                    ],
                }
            }
        }
    )
    analysis = build_fallback_analysis(
        parallel_blob={"checkpoint_parallel_service_result": service_json},
        markdown_source="",
        checkpoint_results="Issues: garage door paint chipping",
        property_address="1982 Helena Way, Brentwood, CA",
        retrieval_search_query="garage door paint chipping repair",
    )
    local = analysis["serviceResults"]["localPros"]
    assert local["serpAPIResults"][0]["name"] == "Bay Door Co"
    assert local["googleSearchResults"][0]["name"] == "Bay Door Co"


def test_build_fallback_analysis_bare_skipped_omits_service_results() -> None:
    analysis = build_fallback_analysis(
        parallel_blob={
            "checkpoint_parallel_service_result": "SKIPPED",
            "checkpoint_parallel_diy_result": '{"steps": []}',
        },
        markdown_source="",
        checkpoint_results="Issues: garage door paint chipping",
        property_address="1982 Helena Way, Brentwood, CA",
        retrieval_search_query="garage door paint chipping repair",
    )
    assert "serviceResults" not in analysis


def test_build_fallback_analysis_service_skipped_persists_failure() -> None:
    analysis = build_fallback_analysis(
        parallel_blob={
            "checkpoint_parallel_service_result": (
                "SKIPPED:SerpAPI Maps error: Your account has run out of searches"
            ),
        },
        markdown_source="",
        checkpoint_results="Issues: garage door paint chipping",
        property_address="1982 Helena Way, Brentwood, CA",
        retrieval_search_query="garage door paint chipping repair",
    )
    service = analysis["serviceResults"]
    assert service["searchStatus"] == "failed"
    assert "temporarily unavailable" in service["searchError"].lower()
    assert service["localPros"]["serpAPIResults"] == []
