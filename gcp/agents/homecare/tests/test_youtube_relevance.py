"""Tests for stem-token YouTube relevance ranking."""

from property_agent.agents.diy_agent.youtube_relevance import (
    YouTubeRankRow,
    format_youtube_relevance_log,
    rank_youtube_videos_by_stem,
)


def test_format_youtube_relevance_log_marks_selected_rows() -> None:
    rows = [
        YouTubeRankRow(0, 9.0, "Garage door paint repair", {}),
        YouTubeRankRow(1, 6.0, "Car paint chips", {}),
    ]
    line = format_youtube_relevance_log(
        rows,
        max_results=1,
        anchor_tokens={"garage", "door", "paint"},
    )
    assert "anchor=[door,garage,paint]" in line or "anchor=[garage,door,paint]" in line
    assert "*9:'Garage door paint repair'" in line
    assert "6:'Car paint chips'" in line
    assert not line.startswith("*6")


def test_rank_demotes_low_overlap_without_hardcoded_keywords() -> None:
    videos = [
        {
            "title": "STEP BY STEP: Fix A Large Paint Chip In Your Cars Paint",
            "url": "https://www.youtube.com/watch?v=car1",
            "description": "automotive diy",
        },
        {
            "title": "How To Fix Chipped Paint Spots On Old Wooden Doors",
            "url": "https://www.youtube.com/watch?v=door1",
            "description": "door paint chips",
        },
        {
            "title": "How to repair paint chips and scratches on garage door",
            "url": "https://www.youtube.com/watch?v=garage1",
            "description": "residential garage door paint repair",
        },
    ]
    stem = "Residential garage door paint chipping and scratches"
    out = rank_youtube_videos_by_stem(
        videos,
        stem,
        search_query="how to repair paint chips and scratches on garage door",
        max_results=3,
    )
    assert out[0]["url"].endswith("garage1")
    assert out[0]["title"].lower().count("garage") >= 1


def test_rank_preserves_order_when_all_scores_zero() -> None:
    videos = [
        {
            "title": "Alpha",
            "url": "https://www.youtube.com/watch?v=a",
            "description": "x",
        },
        {
            "title": "Beta",
            "url": "https://www.youtube.com/watch?v=b",
            "description": "y",
        },
    ]
    out = rank_youtube_videos_by_stem(videos, "completely unrelated xyz", max_results=2)
    assert [v["title"] for v in out] == ["Alpha", "Beta"]
