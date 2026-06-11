# Homecare agent unit tests

Tests live under `gcp/agents/homecare/tests/` and mirror `property_agent/` layout:

| Area | Test modules |
|------|----------------|
| Routing / pre-routing | `test_single_loop_routing.py`, `test_resolve_turn*.py`, `test_query_mode.py`, `test_conversational_*.py` |
| Checkpoint pipeline | `test_checkpoint_parallel_runner.py`, `test_session_diet.py` |
| Leaf agents | `test_diy_agent.py`, `test_coverage_agent.py`, … |
| Platform boundary | `test_platform_boundaries.py` (delegates to `gcp/agent_framework/tests/`) |

**Platform tests** for generic `agent_framework` code are in [`gcp/agent_framework/tests/`](../../agent_framework/tests/) (`test_boundaries.py`, `test_platform_execution.py`, etc.).

Run from `gcp/agents/homecare`:

```bash
make test
```
