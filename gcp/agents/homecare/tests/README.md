# Homecare agent unit tests

**Strategy & roadmap:** [docs/AGENT_TESTING_STRATEGY.md](../docs/AGENT_TESTING_STRATEGY.md) — audit, test pyramid, phased plan to align with industry-standard agent eval.

Tests live under `gcp/agents/homecare/tests/` and mirror `property_agent/` layout:

| Area | Test modules |
|------|----------------|
| Routing / pre-routing | `test_single_loop_routing.py`, `test_resolve_turn.py`, `test_chip_action.py`, `test_post_structured_analysis.py`, `test_pending_offer_extract.py`, `test_query_mode.py`, `test_conversational_*.py` |
| Checkpoint pipeline | `test_checkpoint_parallel_runner.py`, `test_session_diet.py` |
| Leaf agents | `test_diy_agent.py`, `test_coverage_agent.py`, … |
| Platform boundary | `test_platform_boundaries.py` (delegates to `gcp/agent_framework/tests/`) |

**Platform tests** for generic `agent_framework` code are in [`gcp/agent_framework/tests/`](../../agent_framework/tests/) (`test_boundaries.py`, `test_platform_execution.py`, etc.).

Run from `gcp/agents/homecare`:

```bash
make test
make routing-eval-ci   # deterministic routing eval + baseline gate (also in CI)
make contract-check    # contentJson schema + deterministic rubric (also in CI)
make trajectory-eval-ci   # executor tool trajectory + baseline gate (also in CI)
```
