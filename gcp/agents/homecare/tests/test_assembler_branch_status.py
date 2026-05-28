"""Branch analysisStatus terminal states (running → completed)."""

from property_agent.checkpoint.analysis.assembler import (
    analysis_status_for_branches,
    merge_branch_result,
)


def test_branch_running_resolves_to_terminal_completed() -> None:
    running_status = analysis_status_for_branches(
        ["diy", "service"],
        completed=[],
        pending=["diy", "service"],
    )
    assert running_status["diy"] == "running"
    assert running_status["service"] == "pending"

    merged = merge_branch_result(
        {"title": "T", "analysisStatus": running_status},
        checkpoint_results="blob",
        user_query="q",
        parallel_results={
            "checkpoint_parallel_diy_result": "diy-ok",
            "checkpoint_parallel_service_result": "SKIPPED",
        },
        requested_branches=["diy", "service"],
        completed_branches=["diy"],
        pending_branches=["service"],
        in_progress=True,
    )
    assert merged["analysisStatus"]["diy"] == "completed"
    assert merged["analysisStatus"]["service"] == "running"

    final = merge_branch_result(
        merged,
        checkpoint_results="blob",
        user_query="q",
        parallel_results={
            "checkpoint_parallel_diy_result": "diy-ok",
            "checkpoint_parallel_service_result": "SKIPPED",
        },
        requested_branches=["diy", "service"],
        completed_branches=["diy", "service"],
        pending_branches=[],
        in_progress=False,
    )
    assert final["analysisStatus"]["diy"] == "completed"
    assert final["analysisStatus"]["service"] == "completed"
