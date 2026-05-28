import json

from utils.message_patch_state import constrain_content_json_size


def test_content_json_size_guard_noop_under_budget() -> None:
    payload = {"analysis": {"title": "OK"}}
    constrained, truncated = constrain_content_json_size(payload, max_bytes=1024)
    assert truncated is False
    assert constrained == payload


def test_content_json_size_guard_trims_heavy_sections() -> None:
    payload = {
        "analysis": {
            "title": "Big",
            "checkpointDetails": [{"i": i, "text": "x" * 120} for i in range(20)],
            "serviceResults": {
                "localPros": {"serpAPIResults": [{"name": f"p{i}"} for i in range(40)]}
            },
        }
    }
    constrained, truncated = constrain_content_json_size(payload, max_bytes=900)
    assert truncated is True
    assert constrained is not None
    assert "checkpointDetails" not in constrained.get("analysis", {})


def test_content_json_size_guard_falls_back_to_summary() -> None:
    payload = {
        "analysis": {
            "title": "Huge",
            "checkpointDetails": [{"i": i, "text": "x" * 600} for i in range(40)],
            "diyResults": {
                "youtubeSearch": {"videos": [{"title": "v", "meta": "z" * 300} for _ in range(50)]}
            },
        }
    }
    constrained, truncated = constrain_content_json_size(payload, max_bytes=120)
    assert truncated is True
    assert constrained is not None
    assert len(json.dumps(constrained, separators=(",", ":")).encode("utf-8")) <= 120
