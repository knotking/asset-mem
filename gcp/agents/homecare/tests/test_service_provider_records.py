"""Unit tests for service provider normalization."""

from property_agent.service_provider_records import (
    is_vertex_grounding_redirect_url,
    maps_item_to_provider_record,
    normalize_provider_entry,
    normalize_provider_list,
    normalize_service_results,
)


def test_rejects_vertex_grounding_url() -> None:
    url = (
        "https://vertexaisearch.cloud.google.com/grounding-api-redirect/"
        "AUZIYQGQCrcvp2MPg7CIbuQDnN6yiWAM72nSHAEMkzSyHHnj3e9hP5rEFBe1_cNOWWPOnHrSYegqtfVV5RzbgMass_i5-"
    )
    assert is_vertex_grounding_redirect_url(url)
    assert normalize_provider_entry({"name": url, "link": url}) is None
    assert normalize_provider_list([url]) == []


def test_maps_item_to_provider_record() -> None:
    rec = maps_item_to_provider_record(
        {
            "title": "Joe's Plumbing",
            "address": "1 Main St, Brentwood, CA",
            "rating": 4.5,
            "reviews": 12,
            "phone": "(925) 555-1212",
            "_distance_miles": 2.3,
            "website": "https://joesplumbing.example",
        }
    )
    assert rec is not None
    assert rec["name"] == "Joe's Plumbing"
    assert rec["contact_info"] == "(925) 555-1212"
    assert rec["distance_miles"] == "2.3"


def test_drops_search_guidance_blob() -> None:
    assert normalize_provider_list(["x" * 150]) == []


def test_normalize_service_results_filters_grounding_in_google() -> None:
    grounding = (
        "https://vertexaisearch.cloud.google.com/grounding-api-redirect/abc"
    )
    out = normalize_service_results(
        {
            "localPros": {
                "serpAPIResults": [
                    {
                        "name": "Real Pro",
                        "contact_info": "(925) 555-0000",
                    }
                ],
                "googleSearchResults": [{"title": grounding, "url": grounding}],
            }
        }
    )
    assert len(out["localPros"]["serpAPIResults"]) == 1
    assert out["localPros"]["googleSearchResults"] == []


def test_freeform_listing_line() -> None:
    line = (
        "Acme Garage Doors - 4.5 Rating (12 reviews) - 2.3 mi - "
        "Phone: (925) 555-1212"
    )
    items = normalize_provider_list([line])
    assert len(items) == 1
    assert items[0]["name"] == "Acme Garage Doors"
    assert items[0]["contact_info"] == "(925) 555-1212"
