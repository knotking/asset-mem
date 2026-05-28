"""Tool branch orchestration contracts and execution-plan builder."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable, Sequence


class OrchestrationCycleError(ValueError):
    """Raised when branch ``depends_on`` edges form a cycle or reference unknown ids."""


@dataclass(frozen=True)
class BranchToolSpec:
    """Declarative branch entry for composite tool orchestration.

    ``branch_id`` is the runtime branch name (e.g. ``coverage``).
    ``writes_branch`` is the structured analysis key merged by the assembler
    (e.g. ``coverageResult``).
    ``parallel_result_key`` is the interim parallel-results state key.
    Branches sharing a ``parallel_group`` run concurrently in the same wave when
    their ``depends_on`` prerequisites are satisfied. Branches with different
    groups at the same readiness level run in separate sequential waves.
    """

    branch_id: str
    writes_branch: str
    parallel_result_key: str
    parallel_group: str = "default"
    depends_on: tuple[str, ...] = ()


@dataclass(frozen=True)
class ExecutionWave:
    """One orchestration wave: ``branch_ids`` may run concurrently."""

    branch_ids: tuple[str, ...]


def branch_specs_for_ids(
    branch_specs: Sequence[BranchToolSpec],
    requested: Iterable[str],
) -> tuple[BranchToolSpec, ...]:
    """Return specs for ``requested`` branch ids, preserving request order."""
    by_id = {spec.branch_id: spec for spec in branch_specs}
    return tuple(by_id[bid] for bid in requested if bid in by_id)


def build_execution_plan(
    branch_specs: Iterable[BranchToolSpec],
) -> tuple[ExecutionWave, ...]:
    """Build ordered execution waves respecting ``depends_on`` and ``parallel_group``.

    Within each topological readiness batch, branches are partitioned by
    ``parallel_group``. Each group becomes one wave; groups run sequentially
    even when they share the same dependency layer.
    """
    specs_list = list(branch_specs)
    by_id = {spec.branch_id: spec for spec in specs_list}
    if len(by_id) != len(specs_list):
        raise ValueError("duplicate branch_id in branch_specs")

    for spec in specs_list:
        unknown = [dep for dep in spec.depends_on if dep not in by_id]
        if unknown:
            raise ValueError(
                f"branch {spec.branch_id!r} depends on unknown ids: {unknown}"
            )

    spec_order = [spec.branch_id for spec in specs_list]
    pending = set(by_id.keys())
    completed: set[str] = set()
    waves: list[ExecutionWave] = []

    while pending:
        ready = [
            branch_id
            for branch_id in spec_order
            if branch_id in pending
            and all(dep in completed for dep in by_id[branch_id].depends_on)
        ]
        if not ready:
            raise OrchestrationCycleError(
                "cannot schedule remaining branches; check depends_on for cycles"
            )

        groups: dict[str, list[str]] = {}
        group_order: list[str] = []
        for branch_id in ready:
            group = by_id[branch_id].parallel_group
            if group not in groups:
                groups[group] = []
                group_order.append(group)
            groups[group].append(branch_id)

        for group in group_order:
            wave_ids = tuple(sorted(groups[group]))
            waves.append(ExecutionWave(branch_ids=wave_ids))
            for branch_id in wave_ids:
                pending.remove(branch_id)
                completed.add(branch_id)

    return tuple(waves)
