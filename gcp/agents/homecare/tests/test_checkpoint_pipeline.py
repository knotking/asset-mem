"""Unit tests for single-loop checkpoint pipeline (synthesis + tool return)."""

from __future__ import annotations

import asyncio
from types import SimpleNamespace

import pytest

from property_agent.checkpoint import pipeline as cp


def _minimal_tool_context():
    state: dict = {}
    session = SimpleNamespace(user_id="test-user", state=state)
    invocation_context = SimpleNamespace(session=session)
    return SimpleNamespace(_invocation_context=invocation_context, state=state)


@pytest.mark.asyncio
async def test_run_synthesis_markdown_calls_synthesis_runner(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls: dict = {}

    async def _fake_synthesize(analysis, *, checkpoint_results, user_query):
        calls["analysis"] = analysis
        calls["checkpoint_results"] = checkpoint_results
        calls["user_query"] = user_query
        return "# Executive summary\n\nGarage door needs paint repair."

    monkeypatch.setattr(cp, "synthesize_checkpoint_markdown", _fake_synthesize)

    ctx = _minimal_tool_context()
    analysis = {"title": "Checkpoint analysis", "checkpointSummary": {}}
    out = await cp._run_synthesis_markdown(
        analysis=analysis,
        user_query="analyse my checkpoints",
        tool_context=ctx,
        checkpoint_results="Issues: paint chipping",
    )

    assert calls["user_query"] == "analyse my checkpoints"
    assert calls["checkpoint_results"] == "Issues: paint chipping"
    assert calls["analysis"] == analysis
    assert out.startswith("# Executive summary")
    timing = ctx.state.get("checkpoint_request_timing") or {}
    assert timing.get("synthesis_ms") is not None


@pytest.mark.asyncio
async def test_run_synthesis_markdown_falls_back_to_render_markdown(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def _boom(*_a, **_k):
        raise RuntimeError("synthesis unavailable")

    monkeypatch.setattr(cp, "synthesize_checkpoint_markdown", _boom)

    ctx = _minimal_tool_context()
    analysis = {
        "title": "Checkpoint analysis",
        "checkpointSummary": {
            "checkpointsAnalyzed": 1,
            "issuesDetected": ["leak"],
            "locations": ["Garage"],
            "overallCondition": "fair",
        },
    }
    out = await cp._run_synthesis_markdown(
        analysis=analysis,
        user_query="analyse",
        tool_context=ctx,
        checkpoint_results="Issues: leak",
    )

    assert "# Checkpoint analysis" in out
    assert "leak" in out


@pytest.mark.asyncio
async def test_pipeline_inits_progress_queue_on_tool_invocation_context(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    inited: list[object] = []

    def _track_init(inv):
        inited.append(inv)
        from property_agent.checkpoint.progress_stream import init_checkpoint_progress_queue

        return init_checkpoint_progress_queue(inv)

    monkeypatch.setattr(cp, "checkpoint_progress_streaming_enabled", lambda: True)
    monkeypatch.setattr(cp, "init_checkpoint_progress_queue", _track_init)
    monkeypatch.setattr(
        "property_agent.checkpoint.composite_hooks.ask_checkpoints_retrieval",
        lambda **_: {"checkpoints": []},
    )

    ctx = _minimal_tool_context()
    await cp.run_checkpoint_pipeline(
        user_query="analyse",
        property_id="prop-1",
        tool_context=ctx,
    )

    assert inited == [ctx._invocation_context]


@pytest.mark.asyncio
async def test_pipeline_emits_single_initial_progress_when_branches_run(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Composite pipeline emits one Progress 0/N snapshot before branches run."""
    emit_calls: list[str] = []

    async def _track_emit(tool_context, *, session_event_text, state_delta, branch=None):
        emit_calls.append(session_event_text)

    async def _fake_branch(*_args, **_kwargs):
        return "ok"

    async def _fake_synthesis(analysis, *, checkpoint_results, user_query):
        return "# Done"

    monkeypatch.setattr(cp, "checkpoint_progress_streaming_enabled", lambda: True)
    monkeypatch.setattr(
        "property_agent.checkpoint.composite_hooks.emit_checkpoint_progress_event",
        _track_emit,
    )
    monkeypatch.setattr(
        "property_agent.checkpoint.composite_hooks.ask_checkpoints_retrieval",
        lambda **_: {"checkpoints": [{"id": "c1", "issues": []}], "search_query": "q"},
    )
    monkeypatch.setattr(
        "property_agent.checkpoint.composite_hooks.run_checkpoint_optional_branch",
        _fake_branch,
    )
    monkeypatch.setattr(
        "property_agent.checkpoint.composite_hooks.synthesize_checkpoint_markdown",
        _fake_synthesis,
    )
    monkeypatch.setattr(
        "property_agent.checkpoint.composite_hooks.start_checkpoint_branch_prefetch_tasks",
        lambda *_args, **_kwargs: None,
    )

    ctx = _minimal_tool_context()
    ctx.state["checkpoint_optional_agents"] = ["coverage", "diy", "cost", "service"]

    await cp.run_checkpoint_pipeline(
        user_query="analyse",
        property_id="prop-1",
        tool_context=ctx,
    )

    progress_zero = [t for t in emit_calls if "Progress 0/" in t]
    assert len(progress_zero) == 1


def test_run_checkpoint_pipeline_returns_markdown_not_status_stub(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Tool result should be user-visible markdown (ADK web), not a one-line status."""

    async def _fake_pipeline(**_kwargs):
        return "# Checkpoint analysis\n\n## Summary\nDone."

    monkeypatch.setattr(cp, "run_checkpoint_pipeline", _fake_pipeline)
    result = asyncio.run(
        cp.run_checkpoint_pipeline(
            user_query="analyse",
            property_id="prop-1",
            tool_context=_minimal_tool_context(),
        )
    )
    assert result.startswith("# Checkpoint analysis")
    assert "Completed checkpoint analysis for" not in result
