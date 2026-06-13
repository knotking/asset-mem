# Homecare agent unit tests

Tests live under `gcp/agents/homecare/tests/` and mirror `property_agent/` layout:

| Area | Test modules |
|------|----------------|
| Routing / pre-routing | `test_single_loop_routing.py`, `test_resolve_turn.py`, `test_chip_action.py`, `test_post_structured_analysis.py`, `test_pending_offer_extract.py`, `test_query_mode.py`, `test_conversational_*.py` |
| Checkpoint pipeline | `test_checkpoint_parallel_runner.py`, `test_session_diet.py` |
| Leaf agents | `test_diy_agent.py`, `test_coverage_agent.py`, … |
| Platform boundary | `test_platform_boundaries.py` (delegates to `agent-platform` core tests) |

**Platform tests** for generic `agent_platform` code live in the sibling **`agent-platform`** repo (`packages/core/tests/`, `packages/adk/tests/`). `make test` runs homecare + platform unit tests.

Run from `gcp/agents/homecare`:

```bash
make test
```
