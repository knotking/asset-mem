"""Checkpoint optional-branch orchestration metadata (registry SSOT)."""

from __future__ import annotations

from agent_framework.registry.orchestration import BranchToolSpec

CHECKPOINT_OPTIONAL_BRANCH_SPECS: tuple[BranchToolSpec, ...] = (
    BranchToolSpec(
        branch_id="coverage",
        writes_branch="coverageResult",
        parallel_result_key="checkpoint_parallel_coverage_result",
        parallel_group="checkpoint_optional",
    ),
    BranchToolSpec(
        branch_id="diy",
        writes_branch="diyResults",
        parallel_result_key="checkpoint_parallel_diy_result",
        parallel_group="checkpoint_optional",
    ),
    BranchToolSpec(
        branch_id="service",
        writes_branch="serviceResults",
        parallel_result_key="checkpoint_parallel_service_result",
        parallel_group="checkpoint_optional",
    ),
    BranchToolSpec(
        branch_id="cost",
        writes_branch="costEstimationResults",
        parallel_result_key="checkpoint_parallel_cost_result",
        parallel_group="checkpoint_optional",
    ),
)

_VALID_OPTIONAL_BRANCH_IDS = frozenset(
    spec.branch_id for spec in CHECKPOINT_OPTIONAL_BRANCH_SPECS
)
