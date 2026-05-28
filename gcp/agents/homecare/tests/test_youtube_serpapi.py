"""Tests for SerpAPI-backed YouTube search."""

import pytest

from property_agent.agents.diy_agent import youtube as yt_mod


def test_normalize_serpapi_video_row_maps_fields() -> None:
    row = {
        "title": "How to paint a garage door",
        "link": "https://www.youtube.com/watch?v=abc123",
        "description": "Step by step garage door paint repair.",
        "length": "12:34",
    }
    out = yt_mod._normalize_serpapi_video_row(row)
    assert out == {
        "title": "How to paint a garage door",
        "url": "https://www.youtube.com/watch?v=abc123",
        "description": "Step by step garage door paint repair.",
        "duration": "12:34",
    }


def test_youtube_search_uses_serpapi_when_key_set(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("SERP_API_KEY", "test-serp-key")
    monkeypatch.delenv("YOUTUBE_API_KEY", raising=False)

    class FakeSearch:
        def __init__(self, params: dict):
            self.params = params

        def get_dict(self) -> dict:
            assert self.params["engine"] == "youtube"
            assert self.params["search_query"] == "garage door paint repair"
            assert self.params["api_key"] == "test-serp-key"
            return {
                "video_results": [
                    {
                        "title": "Garage door paint touch up",
                        "link": "https://www.youtube.com/watch?v=xyz789",
                        "description": "Residential garage door tutorial",
                        "length": "8:15",
                    }
                ]
            }

    import serpapi

    monkeypatch.setattr(serpapi, "GoogleSearch", FakeSearch)

    out = yt_mod.youtube_search("garage door paint repair", max_results=3)
    assert len(out) == 1
    assert out[0]["title"] == "Garage door paint touch up"
    assert out[0]["url"] == "https://www.youtube.com/watch?v=xyz789"
    assert out[0]["duration"] == "8:15"


def test_youtube_search_ranks_by_stem_when_serpapi_returns_many(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("SERP_API_KEY", "test-serp-key")
    monkeypatch.delenv("YOUTUBE_API_KEY", raising=False)

    class FakeSearch:
        def __init__(self, params: dict):
            self.params = params

        def get_dict(self) -> dict:
            return {
                "video_results": [
                    {
                        "title": "Car paint chip repair",
                        "link": "https://www.youtube.com/watch?v=car",
                        "description": "automotive",
                        "length": "5:00",
                    },
                    {
                        "title": "Garage door paint chip fix",
                        "link": "https://www.youtube.com/watch?v=garage",
                        "description": "residential garage door",
                        "length": "8:00",
                    },
                ]
            }

    import serpapi

    monkeypatch.setattr(serpapi, "GoogleSearch", FakeSearch)

    out = yt_mod.youtube_search(
        "how to repair paint chips on garage door",
        max_results=1,
        relevance_stem="Residential garage door paint chipping",
        rank_search_query="how to repair paint chips on garage door",
    )
    assert len(out) == 1
    assert out[0]["url"].endswith("garage")


def test_youtube_search_falls_back_to_data_api_when_serpapi_empty(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("SERP_API_KEY", "test-serp-key")
    monkeypatch.setenv("YOUTUBE_API_KEY", "test-youtube-key")
    monkeypatch.delenv("DIY_YOUTUBE_SEARCH_BACKEND", raising=False)

    class FakeSerpSearch:
        def __init__(self, params: dict):
            pass

        def get_dict(self) -> dict:
            return {"video_results": []}

    import serpapi

    monkeypatch.setattr(serpapi, "GoogleSearch", FakeSerpSearch)

    def fake_get(url: str, params: dict | None = None, timeout: float | None = None):
        assert "youtube/v3/search" in url

        class Resp:
            ok = True

            def json(self) -> dict:
                return {
                    "items": [
                        {
                            "id": {
                                "kind": "youtube#video",
                                "videoId": "dataApi1",
                            },
                            "snippet": {
                                "title": "Data API fallback",
                                "description": "Fallback video",
                                "channelTitle": "DIY",
                            },
                        }
                    ]
                }

        return Resp()

    monkeypatch.setattr(yt_mod.requests, "get", fake_get)

    out = yt_mod.youtube_search("garage door paint", max_results=3)
    assert len(out) == 1
    assert out[0]["title"] == "Data API fallback"


def test_youtube_search_uses_data_api_when_backend_forced(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("DIY_YOUTUBE_SEARCH_BACKEND", "data_api")
    monkeypatch.setenv("YOUTUBE_API_KEY", "test-youtube-key")
    monkeypatch.setenv("SERP_API_KEY", "test-serp-key")

    serp_called = {"count": 0}

    class FakeSerpSearch:
        def __init__(self, params: dict):
            serp_called["count"] += 1

        def get_dict(self) -> dict:
            return {
                "video_results": [
                    {
                        "title": "SerpAPI should not run first",
                        "link": "https://www.youtube.com/watch?v=serp",
                        "description": "",
                        "length": "1:00",
                    }
                ]
            }

    import serpapi

    monkeypatch.setattr(serpapi, "GoogleSearch", FakeSerpSearch)

    def fake_get(url: str, params: dict | None = None, timeout: float | None = None):
        assert "youtube/v3/search" in url
        assert params is not None
        assert params.get("key") == "test-youtube-key"

        class Resp:
            ok = True

            def json(self) -> dict:
                return {
                    "items": [
                        {
                            "id": {
                                "kind": "youtube#video",
                                "videoId": "dataPrimary",
                            },
                            "snippet": {
                                "title": "Data API primary",
                                "description": "Garage door tutorial",
                                "channelTitle": "DIY",
                            },
                        }
                    ]
                }

        return Resp()

    monkeypatch.setattr(yt_mod.requests, "get", fake_get)

    out = yt_mod.youtube_search("garage door paint repair", max_results=3)
    assert serp_called["count"] == 0
    assert len(out) == 1
    assert out[0]["title"] == "Data API primary"
