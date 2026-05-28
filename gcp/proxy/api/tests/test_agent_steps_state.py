from utils.agent_steps_state import complete_pending_specialists, merge_step_update


def test_merge_step_update_sets_started_and_completed_timestamps() -> None:
    steps: dict[str, dict] = {}
    merge_step_update(
        steps,
        {"name": "coverage_agent", "status": "executing"},
        now_ms=1000,
    )
    assert steps["coverage_agent"]["startedAt"] == 1000
    assert "completedAt" not in steps["coverage_agent"]

    merge_step_update(
        steps,
        {"name": "coverage_agent", "status": "completed"},
        now_ms=2000,
    )
    assert steps["coverage_agent"]["startedAt"] == 1000
    assert steps["coverage_agent"]["completedAt"] == 2000


def test_merge_step_update_preserves_preview_and_display_name_lock() -> None:
    steps = {
        "service_agent": {
            "name": "service_agent",
            "status": "executing",
            "preview": "Found 3 pros",
            "displayName": "Finding pros near you…",
            "startedAt": 10,
        }
    }
    merge_step_update(
        steps,
        {"name": "service_agent", "status": "completed", "preview": ""},
        now_ms=20,
    )
    assert steps["service_agent"]["preview"] == "Found 3 pros"
    assert steps["service_agent"]["displayName"] == "Finding pros near you…"


def test_complete_pending_specialists_only_completes_executing() -> None:
    steps = {
        "diy_agent": {"name": "diy_agent", "status": "executing"},
        "cost_agent": {"name": "cost_agent", "status": "completed"},
    }
    complete_pending_specialists(
        steps,
        {"diy_agent", "cost_agent", "service_agent"},
        display_name_for=lambda name: f"label:{name}",
        now_ms=30,
    )
    assert steps["diy_agent"]["status"] == "completed"
    assert steps["diy_agent"]["displayName"] == "label:diy_agent"
    assert steps["diy_agent"]["completedAt"] == 30
    assert steps["cost_agent"]["status"] == "completed"
    assert "service_agent" not in steps

