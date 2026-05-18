"""
Checkpoint Analysis Agent

Orchestrates coverage, DIY, service, and cost agents to provide comprehensive
recommendations based on checkpoint data analysis.
"""

import ast
import asyncio
import json
import logging
import re
import time
from typing import Awaitable, Callable, Optional, List, Dict, Any, Tuple, AsyncGenerator
from google.adk.agents import Agent, BaseAgent, SequentialAgent
from google.adk.agents.context import Context
from google.adk.agents.invocation_context import InvocationContext
from google.adk.events.event import Event
from google.adk.tools import ToolContext
from typing_extensions import override
from google.adk.tools.agent_tool import AgentTool
from pydantic import BaseModel, Field
from dotenv import load_dotenv
from ..coverage_agent.agent import coverage_agent
from ..diy_agent.agent import diy_agent
from ..diy_agent.orchestrator import run_diy_pipeline
from ..service_agent.agent import service_agent
from ..cost_agent.agent import _cost_estimation_sync, cost_agent
from ...agent_inputs import CheckpointOptionalAgent
from ...model_config import GLOBAL_GEMINI_MODEL
from ...search_location_utils import legacy_search_location_from_payload
from ..checkpoint_dual_format_guard import (
    CHECKPOINT_ANALYSIS_PENDING_INPUT_STATE_KEY,
    CHECKPOINT_ANALYSIS_PROGRESS_STATE_KEY,
    CHECKPOINT_BRANCH_COMPLETED_STATE_KEY,
    CHECKPOINT_PROGRESS_EVENT_AUTHOR,
    bump_checkpoint_progress_emit_seq,
    build_checkpoint_analysis_pending_payload,
    build_phase0_checkpoint_dual_format,
    build_progressive_checkpoint_dual_format,
    ensure_checkpoint_analysis_pending_stashed,
    stash_checkpoint_dual_format_in_state,
    synthesis_after_model_callback,
)
from ..checkpoint_request_timing import (
    mark_synthesis_started,
    record_diy_ms,
    record_parallel_ms,
)

load_dotenv()

logger = logging.getLogger(__name__)

# Session state key: refined search_query from checkpoint retrieval (YouTube / shopping).
CHECKPOINT_RETRIEVAL_SEARCH_QUERY_STATE_KEY = "checkpoint_retrieval_search_query"

# Legacy prose keys emitted when checkpoint_agent passes a single ``request`` blob.
_LEGACY_ANALYSIS_FIELD_NAMES: Tuple[str, ...] = (
    "checkpoint_results",
    "user_query",
    "search_query",
    "checkpoint_optional_agents",
    "context_doc_uris",
    "property_address",
    "property_id",
    "search_location",
    "location_coordinates",
    "location_radius",
)
_LEGACY_FIELD_MARKER_RE = re.compile(
    r"(?:^|\n)(" + "|".join(re.escape(k) for k in _LEGACY_ANALYSIS_FIELD_NAMES) + r")\s*:\s*",
    re.IGNORECASE,
)
# checkpoint_agent sometimes emits one line: field: '...', user_query: '...', ...
_INLINE_FIELD_MARKER_RE = re.compile(
    r"(?:^|,\s*)(" + "|".join(re.escape(k) for k in _LEGACY_ANALYSIS_FIELD_NAMES) + r")\s*:\s*",
    re.IGNORECASE,
)


def _text_from_user_content(content: Any) -> str:
    if content is None:
        return ""
    parts = getattr(content, "parts", None) or []
    chunks: list[str] = []
    for part in parts:
        t = getattr(part, "text", None)
        if isinstance(t, str) and t.strip():
            chunks.append(t.strip())
    return "\n".join(chunks).strip()


def _search_query_from_analysis_json(text: str) -> str:
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        return ""
    if not isinstance(data, dict):
        return ""
    return (data.get("search_query") or "").strip()


def resolve_effective_search_query(
    search_query: Optional[str],
    tool_context: Optional[ToolContext],
) -> str:
    """Tool arg first, then session state (retrieval stash or workflow input)."""
    sq = (search_query or "").strip()
    if sq:
        return sq
    if tool_context is None:
        return ""
    st = tool_context.state.get(CHECKPOINT_RETRIEVAL_SEARCH_QUERY_STATE_KEY)
    if isinstance(st, str) and st.strip():
        return st.strip()
    return ""


def _strip_checkpoint_title_noise(text: str) -> str:
    """Remove checkpoint titles, dates, and times from retrieval blobs before search seeding."""
    s = (text or "").strip()
    if not s:
        return ""
    s = re.sub(r"\r\n?", " ", s)
    # Narrative: Checkpoint 'Checkpoint • May 11 • 9:10 PM' (Garage):
    s = re.sub(r"Checkpoint\s+'[^']*'(?:\s*\([^)]*\))?\s*:\s*", " ", s, flags=re.I)
    s = re.sub(r'Checkpoint\s+"[^"]*"(?:\s*\([^)]*\))?\s*:\s*', " ", s, flags=re.I)
    s = re.sub(r"Checkpoint\s+Name\s*:\s*[^,\n]+", " ", s, flags=re.I)
    # Stray suffix if a prior pipeline merged DIY search text into checkpoint prose
    s = re.sub(r"\bDIY\s+tutorial\s+how\s+to\s+fix\b", " ", s, flags=re.I)
    s = re.sub(r"•+", " ", s)
    s = re.sub(r"\b\d{1,2}:\d{2}\s*(?:AM|PM)\b", " ", s, flags=re.I)
    s = re.sub(
        r"\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|"
        r"Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s+"
        r"\d{1,2}(?:st|nd|rd|th)?(?:,?\s*\d{4})?\b",
        " ",
        s,
        flags=re.I,
    )
    s = re.sub(r"\b\d{4}-\d{2}-\d{2}\b", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def optional_branch_search_user_query(checkpoint_results: str, *, max_chars: int = 280) -> str:
    """
    Short plain-text query for optional parallel agents (DIY / shopping / YouTube paths).

    Strips checkpoint names and timestamps, then reuses DIY checkpoint-field compaction
    when structured labels (Summary / Issues / Location) are present.
    """
    from ..diy_agent.orchestrator import _compact_diy_search_seed

    cleaned = _strip_checkpoint_title_noise(checkpoint_results)
    seed = _compact_diy_search_seed(cleaned)
    out = (seed or cleaned).strip()
    out = re.sub(r"\s+", " ", out)
    if len(out) > max_chars:
        cut = out[: max_chars + 1]
        out = cut.rsplit(" ", 1)[0].strip() if " " in cut else cut[:max_chars].strip()
    if not out:
        out = cleaned[:max_chars].strip() if cleaned else ""
    return out


def resolve_branch_search_user_query(
    search_query: Optional[str],
    checkpoint_results: str,
    *,
    max_chars: int = 400,
) -> str:
    """Use caller-provided search_query when set; otherwise compact checkpoint_results."""
    raw = (search_query or "").strip()
    if raw:
        out = re.sub(r"\s+", " ", raw).strip()
    else:
        out = optional_branch_search_user_query(checkpoint_results, max_chars=max_chars)
    if len(out) > max_chars:
        cut = out[: max_chars + 1]
        out = cut.rsplit(" ", 1)[0].strip() if " " in cut else cut[:max_chars].strip()
    return out


class CheckpointAnalysisInput(BaseModel):
    """Input schema for checkpoint analysis agent."""
    checkpoint_results: str = Field(description="The checkpoint retrieval results containing checkpoint data and analysis")
    user_query: str = Field(description="The original user query for context")
    search_query: Optional[str] = Field(
        default=None,
        description=(
            "Short search phrase for YouTube / shopping (from checkpoint retrieval: location + issues). "
            "Optional; when omitted, a compact phrase is derived from checkpoint_results."
        ),
    )
    checkpoint_optional_agents: List[CheckpointOptionalAgent] = Field(
        description="List of optional sub-agents to invoke: coverage, diy, service, cost"
    )
    context_doc_uris: Optional[List[str]] = Field(default=None, description="Context document URIs for coverage checks")
    property_address: Optional[str] = Field(
        default=None, description="Property record address (identity/context only)"
    )
    property_id: Optional[str] = Field(default=None, description="Property ID for reference")
    search_location: Optional[Dict[str, Any]] = Field(
        default=None, description="Unified market/geo for service, cost, DIY"
    )


def _coerce_legacy_analysis_field(key: str, value_str: str) -> Any:
    """Parse one legacy ``key: value`` field from checkpoint_agent request prose."""
    raw = (value_str or "").strip()
    if not raw:
        return None
    if key in (
        "checkpoint_optional_agents",
        "context_doc_uris",
        "location_coordinates",
        "search_location",
    ):
        try:
            return ast.literal_eval(raw)
        except (SyntaxError, ValueError):
            logger.debug(
                "checkpoint analysis parse: literal_eval failed for %s", key
            )
            return raw
    if key == "location_radius":
        try:
            return int(raw)
        except ValueError:
            return raw
    return raw


def parse_legacy_checkpoint_analysis_prose(text: str) -> Optional[Dict[str, Any]]:
    """
    Parse checkpoint_agent's legacy single-string tool arg:

        checkpoint_results: ...
        user_query: ...
        search_query: ...
    """
    raw = (text or "").strip()
    if not raw:
        return None
    if not _LEGACY_FIELD_MARKER_RE.search(raw):
        return None

    matches = list(_LEGACY_FIELD_MARKER_RE.finditer(raw))
    if not matches:
        return None

    out: Dict[str, Any] = {}
    for i, match in enumerate(matches):
        key = match.group(1).lower()
        start = match.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(raw)
        value_str = raw[start:end].strip()
        coerced = _coerce_legacy_analysis_field(key, value_str)
        if coerced is not None:
            out[key] = coerced

    if not out.get("checkpoint_results") and not out.get("user_query"):
        return None
    if not out.get("checkpoint_optional_agents"):
        return None
    return out


def _strip_inline_field_value(value_str: str) -> str:
    """Trim commas, trailing braces, and optional wrapping quotes from inline field values."""
    raw = (value_str or "").strip()
    while raw.endswith("}"):
        raw = raw[:-1].strip()
    while raw.endswith(","):
        raw = raw[:-1].strip()
    if len(raw) >= 2:
        if raw[0] == raw[-1] and raw[0] in ("'", '"'):
            return raw[1:-1].strip()
    return raw


def parse_inline_checkpoint_analysis_request(text: str) -> Optional[Dict[str, Any]]:
    """
    Parse single-line comma-separated tool args from checkpoint_agent, e.g.::

        checkpoint_results: '...', user_query: 'analyse my checkpoints',
        checkpoint_optional_agents: ['coverage', 'diy'], search_query: 'garage paint'
    """
    raw = (text or "").strip()
    if not raw:
        return None
    if not _INLINE_FIELD_MARKER_RE.search(raw):
        return None

    matches = list(_INLINE_FIELD_MARKER_RE.finditer(raw))
    if not matches:
        return None

    out: Dict[str, Any] = {}
    for i, match in enumerate(matches):
        key = match.group(1).lower()
        start = match.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(raw)
        value_str = _strip_inline_field_value(raw[start:end])
        coerced = _coerce_legacy_analysis_field(key, value_str)
        if coerced is not None:
            out[key] = coerced

    if not out.get("checkpoint_results") and not out.get("user_query"):
        return None
    if not out.get("checkpoint_optional_agents"):
        return None
    return out


def parse_checkpoint_analysis_payload(text: str) -> Optional[Dict[str, Any]]:
    """JSON object or legacy ``key: value`` prose → dict for CheckpointAnalysisInput."""
    raw = (text or "").strip()
    if not raw:
        return None

    if raw.startswith("{"):
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            data = None
        if isinstance(data, dict):
            return data

    legacy = parse_legacy_checkpoint_analysis_prose(raw)
    if legacy is not None:
        return legacy

    inline = parse_inline_checkpoint_analysis_request(raw)
    if inline is not None:
        return inline

    return None


def normalize_checkpoint_analysis_tool_args(
    args: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Normalize checkpoint_analysis_agent tool args to CheckpointAnalysisInput fields.

    Accepts structured args, legacy ``request`` prose, or a JSON string in ``request``.
    """
    if not isinstance(args, dict):
        raise TypeError("checkpoint_analysis_agent args must be a dict")

    structured_keys = {
        "checkpoint_results",
        "user_query",
        "checkpoint_optional_agents",
    }
    if structured_keys.issubset(args.keys()):
        return dict(args)

    merged: Dict[str, Any] = {
        k: v for k, v in args.items() if k != "request" and v is not None
    }
    request_blob = args.get("request")
    if isinstance(request_blob, str) and request_blob.strip():
        parsed = parse_checkpoint_analysis_payload(request_blob)
        if parsed:
            merged = {**parsed, **merged}
        elif "checkpoint_results" not in merged:
            merged["checkpoint_results"] = request_blob.strip()

    return merged


def _pending_checkpoint_analysis_input_from_state(
    ctx: InvocationContext,
) -> Optional[CheckpointAnalysisInput]:
    """Load analysis input stashed during checkpoint retrieval (doculink transfer path)."""
    tool_ctx = Context(invocation_context=ctx)
    ensure_checkpoint_analysis_pending_stashed(tool_ctx.state)
    raw = tool_ctx.state.get(CHECKPOINT_ANALYSIS_PENDING_INPUT_STATE_KEY)
    data: Optional[Dict[str, Any]] = None
    if isinstance(raw, str) and raw.strip():
        try:
            parsed = json.loads(raw)
            if isinstance(parsed, dict):
                data = parsed
        except json.JSONDecodeError:
            data = parse_checkpoint_analysis_payload(raw)
    elif isinstance(raw, dict):
        data = raw
    if data is None:
        data = build_checkpoint_analysis_pending_payload(tool_ctx.state)
    if data is None:
        return None
    try:
        return CheckpointAnalysisInput.model_validate(data)
    except Exception as exc:
        logger.warning(
            "checkpoint optional parallel: pending input validation failed: %s",
            exc,
        )
        return None


def _merge_routing_into_pending(
    routing: Dict[str, Any],
    pending: CheckpointAnalysisInput,
) -> Optional[CheckpointAnalysisInput]:
    """Overlay routing-only workflow JSON onto stashed pending analysis input."""
    merged = pending.model_dump()
    for key in (
        "user_query",
        "search_query",
        "checkpoint_optional_agents",
        "context_doc_uris",
        "property_address",
        "property_id",
        "search_location",
    ):
        if key in routing and routing[key] is not None:
            merged[key] = routing[key]
    try:
        return CheckpointAnalysisInput.model_validate(merged)
    except Exception as exc:
        logger.warning(
            "checkpoint optional parallel: routing merge validation failed: %s",
            exc,
        )
        return pending


def _parse_checkpoint_analysis_input(
    ctx: InvocationContext,
) -> Optional[CheckpointAnalysisInput]:
    """Parse workflow input (JSON or legacy prose) from the invocation user message."""
    text = _text_from_user_content(Context(invocation_context=ctx).user_content)
    pending = _pending_checkpoint_analysis_input_from_state(ctx)

    if text:
        data = parse_checkpoint_analysis_payload(text)
        if data is not None:
            try:
                return CheckpointAnalysisInput.model_validate(data)
            except Exception as exc:
                ck = data.get("checkpoint_results")
                if pending is not None and (
                    not isinstance(ck, str) or not ck.strip()
                ):
                    merged = _merge_routing_into_pending(data, pending)
                    if merged is not None:
                        logger.info(
                            "checkpoint optional parallel: merged routing JSON "
                            "with pending analysis input"
                        )
                        return merged
                logger.warning(
                    "checkpoint optional parallel: workflow input validation failed: %s",
                    exc,
                )
        else:
            logger.warning(
                "checkpoint optional parallel: workflow input is not valid JSON or legacy prose"
            )

    if pending is not None:
        logger.info(
            "checkpoint optional parallel: using pending analysis input from session state"
        )
    elif text:
        logger.warning("checkpoint optional parallel: missing workflow input text")
    return pending


def _stash_retrieval_search_query(tool_ctx: Context, inp: CheckpointAnalysisInput) -> None:
    sq = (inp.search_query or "").strip()
    if not sq:
        text = _text_from_user_content(tool_ctx.user_content)
        sq = _search_query_from_analysis_json(text)
    if sq:
        tool_ctx.state[CHECKPOINT_RETRIEVAL_SEARCH_QUERY_STATE_KEY] = sq
        logger.debug(
            "checkpoint optional parallel: stashed search_query len=%d",
            len(sq),
        )


BranchCompleteCallback = Callable[
    [str, Dict[str, str], str, ToolContext], Awaitable[None]
]


async def execute_checkpoint_optional_parallel(
    ctx: InvocationContext,
    *,
    on_branch_complete: Optional[BranchCompleteCallback] = None,
) -> Context:
    """Run optional branches in Python (no LLM). Returns context with session state updates."""
    tool_ctx = Context(invocation_context=ctx)
    inp = _parse_checkpoint_analysis_input(ctx)
    if inp is None:
        await run_checkpoint_optional_agents_parallel(
            checkpoint_results="",
            user_query="",
            checkpoint_optional_agents=[],
            tool_context=tool_ctx,
            on_branch_complete=on_branch_complete,
        )
        return tool_ctx

    _stash_retrieval_search_query(tool_ctx, inp)
    await run_checkpoint_optional_agents_parallel(
        checkpoint_results=inp.checkpoint_results,
        user_query=inp.user_query,
        checkpoint_optional_agents=inp.checkpoint_optional_agents,
        context_doc_uris=inp.context_doc_uris,
        property_address=inp.property_address,
        property_id=inp.property_id,
        search_location=inp.search_location,
        search_query=inp.search_query,
        tool_context=tool_ctx,
        on_branch_complete=on_branch_complete,
    )
    return tool_ctx


class CheckpointOptionalParallelAgent(BaseAgent):
    """Python-only parallel runner (replaces the prior LLM tool-caller hop)."""

    @override
    async def _run_async_impl(
        self, ctx: InvocationContext
    ) -> AsyncGenerator[Event, None]:
        from google.genai import types
        from google.adk.events.event import EventActions

        progress_queue: asyncio.Queue[Optional[Event]] = asyncio.Queue()
        tool_ctx_holder: List[Optional[ToolContext]] = [None]

        async def on_branch_complete(
            branch: str,
            results: Dict[str, str],
            body: str,
            tool_context: ToolContext,
        ) -> None:
            stash_checkpoint_dual_format_in_state(tool_context.state, body)
            if hasattr(tool_context.state, "__setitem__"):
                tool_context.state[CHECKPOINT_ANALYSIS_PROGRESS_STATE_KEY] = body
                bump_checkpoint_progress_emit_seq(tool_context.state)
            delta: Dict[str, Any] = {
                "checkpoint_parallel_results": json.dumps(
                    results, ensure_ascii=False
                ),
            }
            if branch:
                delta[CHECKPOINT_BRANCH_COMPLETED_STATE_KEY] = branch
            await progress_queue.put(
                Event(
                    invocation_id=ctx.invocation_id,
                    author=CHECKPOINT_PROGRESS_EVENT_AUTHOR,
                    branch=ctx.branch,
                    content=types.Content(
                        role="model", parts=[types.Part(text=body)]
                    ),
                    actions=EventActions(state_delta=delta),
                )
            )

        async def run_parallel() -> None:
            tool_ctx_holder[0] = await execute_checkpoint_optional_parallel(
                ctx, on_branch_complete=on_branch_complete
            )
            await progress_queue.put(None)

        runner_task = asyncio.create_task(run_parallel())
        try:
            while True:
                ev = await progress_queue.get()
                if ev is None:
                    break
                yield ev
        finally:
            await runner_task

        tool_ctx = tool_ctx_holder[0]
        if tool_ctx is not None and tool_ctx.state.has_delta():
            yield Event(
                invocation_id=ctx.invocation_id,
                author=self.name,
                branch=ctx.branch,
                actions=tool_ctx.actions,
            )


def _normalize_agent_result(result: Any) -> str:
    if result is None:
        return "SKIPPED"
    if isinstance(result, str):
        return result
    try:
        return json.dumps(result, ensure_ascii=False)
    except Exception:
        return str(result)


_BRANCH_AGENTS: Dict[str, Tuple[Agent, str]] = {
    "coverage": (coverage_agent, "checkpoint_parallel_coverage_result"),
    "diy": (diy_agent, "checkpoint_parallel_diy_result"),
    "service": (service_agent, "checkpoint_parallel_service_result"),
    "cost": (cost_agent, "checkpoint_parallel_cost_result"),
}


async def _run_checkpoint_diy_pipeline(payload: Dict[str, Any]) -> str:
    """Call the DIY orchestrator directly so parallel state is JSON (videos/products), not LLM prose."""
    branch_q = (payload.get("user_query") or "").strip()
    ck = (payload.get("checkpoint_results") or "").strip()
    if ck and branch_q:
        diagnosis = f"{branch_q}\n\nCheckpoint context:\n{ck[:6000]}"
    elif ck:
        diagnosis = ck[:8000]
    else:
        diagnosis = branch_q or "Property maintenance"
    uris = payload.get("context_doc_uris")
    seed = (payload.get("checkpoint_retrieval_search_query") or "").strip()
    sl = legacy_search_location_from_payload(payload)
    return await run_diy_pipeline(
        diagnosis,
        property_address=(payload.get("property_address") or "").strip() or None,
        search_location=sl,
        context_doc_uris=uris,
        checkpoint_retrieval_search_query=seed or None,
    )


def _checkpoint_cost_diagnosis(payload: Dict[str, Any]) -> str:
    """Diagnosis for checkpoint cost tools: retrieval seed, else branch query, else compact blob."""
    seed = (payload.get("checkpoint_retrieval_search_query") or "").strip()
    if seed:
        return seed
    branch_q = (payload.get("user_query") or "").strip()
    if branch_q:
        return branch_q
    ck = (payload.get("checkpoint_results") or "").strip()
    if ck:
        return optional_branch_search_user_query(ck)
    return "Property maintenance"


def _build_checkpoint_cost_query(payload: Dict[str, Any]) -> str:
    """JSON query for cost tools: diagnosis + market location from search_location."""
    from ...search_location_utils import market_label

    diagnosis = _checkpoint_cost_diagnosis(payload)
    body: Dict[str, Any] = {"diagnosis": diagnosis}
    sl = legacy_search_location_from_payload(payload)
    pa = (payload.get("property_address") or "").strip() or None
    label = market_label(sl, property_address=pa)
    if label:
        body["market_location"] = label
    if pa:
        body["property_address"] = pa
    if sl is not None:
        body["search_location"] = sl.model_dump()
    return json.dumps(body, ensure_ascii=False)


async def _run_checkpoint_cost_pipeline(payload: Dict[str, Any]) -> str:
    """Run full cost estimation in a worker thread (no cost_agent LLM), mirroring the DIY direct path."""
    query = _build_checkpoint_cost_query(payload)
    return await asyncio.to_thread(_cost_estimation_sync, query)


async def _invoke_optional_agent_async(
    agent: Agent, payload: Dict[str, Any], tool_context: ToolContext
) -> Any:
    """Drive a sub-agent through AgentTool on the caller's event loop.

    AgentTool wires the child Runner up to live async objects on
    tool_context._invocation_context (credential_service, plugin_manager,
    ForwardingArtifactService). Those are pinned to the parent event loop,
    so we MUST stay on the same loop instead of dispatching to threads +
    asyncio.run() — that would attach those objects to a fresh loop and
    fail with cross-loop RuntimeErrors mid-stream.

    skip_summarization=True: default AgentTool summarization drops structured
    payloads (e.g. DIY JSON with youtubeSearch / recommendedProducts); the
    synthesis step needs the raw branch tool output.
    """
    agent_tool = AgentTool(agent, skip_summarization=True)
    return await agent_tool.run_async(args=payload, tool_context=tool_context)


async def _run_single_optional_agent_async(
    name: str,
    payload: Dict[str, Any],
    tool_context: ToolContext,
) -> str:
    branch_start = time.monotonic()
    branch_failed = False
    try:
        if name == "diy":
            result = await _run_checkpoint_diy_pipeline(payload)
        elif name == "cost":
            result = await _run_checkpoint_cost_pipeline(payload)
        else:
            agent, _ = _BRANCH_AGENTS[name]
            result = await _invoke_optional_agent_async(agent, payload, tool_context)
        return _normalize_agent_result(result)
    except Exception:
        branch_failed = True
        logger.exception("checkpoint optional branch failed: %s", name)
        return "SKIPPED"
    finally:
        branch_ms = int((time.monotonic() - branch_start) * 1000)
        if name == "diy" and tool_context is not None:
            record_diy_ms(tool_context.state, branch_ms)
        logger.info(
            "checkpoint optional branch timing: branch=%s duration_ms=%d failed=%s",
            name,
            branch_ms,
            branch_failed,
        )


def _serialize_and_store_parallel_results(
    tool_context: Optional[ToolContext], results: Dict[str, str]
) -> str:
    """Canonical JSON for optional branches; always persist to session when context exists."""
    out = json.dumps(results, ensure_ascii=False)
    if tool_context is not None:
        tool_context.state["checkpoint_parallel_results"] = out
    return out


async def _emit_progressive_update(
    *,
    branch: str,
    results: Dict[str, str],
    checkpoint_results: str,
    user_query: str,
    requested: List[str],
    completed: List[str],
    pending: List[str],
    tool_context: ToolContext,
    on_branch_complete: Optional[BranchCompleteCallback],
) -> None:
    body = build_progressive_checkpoint_dual_format(
        checkpoint_results=checkpoint_results,
        user_query=user_query,
        parallel_results=results,
        requested_branches=requested,
        completed_branches=completed,
        pending_branches=pending,
        in_progress=bool(pending),
    )
    if on_branch_complete is not None:
        await on_branch_complete(branch, results, body, tool_context)


async def run_checkpoint_optional_agents_parallel(
    checkpoint_results: str,
    user_query: str,
    checkpoint_optional_agents: List[CheckpointOptionalAgent],
    context_doc_uris: Optional[List[str]] = None,
    property_address: Optional[str] = None,
    property_id: Optional[str] = None,
    search_location: Optional[Dict[str, Any]] = None,
    search_query: Optional[str] = None,
    tool_context: ToolContext = None,
    on_branch_complete: Optional[BranchCompleteCallback] = None,
) -> str:
    """Run requested optional agents concurrently on the active event loop."""
    total_start = time.monotonic()
    if tool_context and hasattr(tool_context, "_invocation_context") and hasattr(tool_context._invocation_context, "session"):
        tool_context.state["user_id"] = tool_context._invocation_context.session.user_id

    results: Dict[str, str] = {
        "checkpoint_parallel_coverage_result": "SKIPPED",
        "checkpoint_parallel_diy_result": "SKIPPED",
        "checkpoint_parallel_service_result": "SKIPPED",
        "checkpoint_parallel_cost_result": "SKIPPED",
    }

    requested = [n for n in (checkpoint_optional_agents or []) if n in _BRANCH_AGENTS]
    if not requested:
        logger.info(
            "checkpoint optional parallel: skip duration_ms=%d reason=no_valid_branches",
            int((time.monotonic() - total_start) * 1000),
        )
        return _serialize_and_store_parallel_results(tool_context, results)

    if tool_context is None:
        logger.error(
            "run_checkpoint_optional_agents_parallel missing tool_context; skipping optional branches"
        )
        return json.dumps(results, ensure_ascii=False)

    search_query = resolve_effective_search_query(search_query, tool_context)
    branch_user_query = resolve_branch_search_user_query(
        search_query or None, checkpoint_results, max_chars=400
    )
    logger.info(
        "checkpoint optional parallel: start branches=%s checkpoint_blob_len=%d "
        "retrieval_search_query_len=%d branch_user_query_len=%d",
        sorted(set(requested)),
        len(checkpoint_results or ""),
        len(search_query),
        len(branch_user_query),
    )
    if not search_query and len(branch_user_query) + 40 < len(
        checkpoint_results or ""
    ):
        logger.debug(
            "checkpoint optional branches: derived from checkpoint_results only query_len=%d checkpoint_results_len=%d",
            len(branch_user_query),
            len(checkpoint_results or ""),
        )

    payload: Dict[str, Any] = {
        # Passed to coverage/diy/service/cost as DocsInput.user_query; DIY YouTube/shopping use
        # ``checkpoint_retrieval_search_query`` as the API query stem when set (orchestrator adds DIY tails).
        "user_query": branch_user_query,
        "checkpoint_results": checkpoint_results,
        "checkpoint_retrieval_search_query": search_query,
        "context_doc_uris": context_doc_uris,
        "property_address": property_address,
        "property_id": property_id,
        "search_location": search_location,
    }

    completed: List[str] = []
    pending: List[str] = list(requested)
    phase0 = build_phase0_checkpoint_dual_format(
        checkpoint_results=checkpoint_results,
        user_query=user_query,
        requested_branches=requested,
    )
    if on_branch_complete is not None:
        await on_branch_complete("", results, phase0, tool_context)
    else:
        stash_checkpoint_dual_format_in_state(tool_context.state, phase0)

    async def _run_named_branch(name: str) -> Tuple[str, str]:
        value = await _run_single_optional_agent_async(name, payload, tool_context)
        return name, value

    branch_tasks = {
        asyncio.create_task(_run_named_branch(name)): name for name in requested
    }
    for finished in asyncio.as_completed(branch_tasks.keys()):
        name, value = await finished
        _, key = _BRANCH_AGENTS[name]
        results[key] = value
        if name in pending:
            pending.remove(name)
        completed.append(name)
        _serialize_and_store_parallel_results(tool_context, results)
        await _emit_progressive_update(
            branch=name,
            results=results,
            checkpoint_results=checkpoint_results,
            user_query=user_query,
            requested=requested,
            completed=list(completed),
            pending=list(pending),
            tool_context=tool_context,
            on_branch_complete=on_branch_complete,
        )

    parallel_ms = int((time.monotonic() - total_start) * 1000)
    if tool_context is not None:
        record_parallel_ms(tool_context.state, parallel_ms)
        mark_synthesis_started(tool_context.state)
    logger.info(
        "checkpoint optional parallel: done requested=%s wall_ms=%d branch_user_query_len=%d",
        sorted(set(requested)),
        parallel_ms,
        len(branch_user_query),
    )
    return _serialize_and_store_parallel_results(tool_context, results)


_CHECKPOINT_SYNTHESIS_INSTRUCTION = """
You are the final checkpoint analysis synthesizer.

Inputs:
- checkpoint_results
- user_query
- checkpoint_optional_agents
- checkpoint_parallel_results (JSON string with keys:
  checkpoint_parallel_coverage_result, checkpoint_parallel_diy_result,
  checkpoint_parallel_service_result, checkpoint_parallel_cost_result)

Your task:
1) Summarize checkpoint findings from checkpoint_results.
2) Parse checkpoint_parallel_results JSON once; treat missing/invalid values as SKIPPED.
3) Build strict dual format output:
   - Markdown first (start with # Title)
   - Then a ```json code block with an "analysis" object
4) Include sections only for requested optional agents.
5) Ignore branch values that are SKIPPED.
6) Never mention internal branch/tool execution details.

The JSON must include:
- analysis.title
- analysis.checkpointSummary (always, OBJECT type)
- analysis.coverageResult only if coverage requested and result exists
- analysis.diyResults only if diy requested and result exists
- analysis.serviceResults only if service requested and result exists
- analysis.costEstimationResults only if cost requested and result exists

CRITICAL SCHEMA CONTRACT FOR WEBAPP/MAPP:
- Return BOTH:
  1) Markdown text first
  2) A ```json block second
- The JSON root must be:
  {
    "analysis": { ... }
  }
- NEVER return strings for structured sections.
- NEVER set analysis.checkpointSummary to a string.
- NEVER set analysis.serviceResults to a string.
- NEVER set analysis.diyResults to a string.
- NEVER set analysis.coverageResult to a string.
- NEVER set analysis.costEstimationResults to a string.

Branch array preservation (CRITICAL — do not summarize structured lists):
- Parse checkpoint_parallel_results once. For each requested optional branch, copy structured arrays verbatim from the branch payload into analysis JSON (same length and entries). Use markdown only for narrative; never drop branch items to shorten JSON.
- checkpoint_parallel_service_result → analysis.serviceResults.localPros.serpAPIResults and googleSearchResults: copy exactly from the branch serviceResults object. Do not pick a subset of providers.
- checkpoint_parallel_diy_result → analysis.diyResults: use the inner "diyResults" object; copy youtubeSearch.videos and recommendedProducts.products exactly (full arrays from the branch). Do not shorten these arrays in synthesis.

DIY branch merge rule (checkpoint_parallel_diy_result):
- The DIY tool may return JSON shaped as { "hire_professional_recommended": <boolean>, "diyResults": { ... } }.
- Always set analysis.diyResults to the INNER "diyResults" object only (must contain diySteps, youtubeSearch, recommendedProducts as today).
- For youtubeSearch.videos and recommendedProducts.products: copy those arrays exactly from the DIY tool's diyResults. If either array is empty or missing there, output [] for that array—never substitute placeholder videos (e.g. youtube.com/results search URLs), "N/A" links, generic "Hardware store" rows, or invented prices.
- You may copy hire_professional_recommended into analysis.diyResults as optional boolean "hireProfessionalRecommended" for clients; omit if false.
- Preserve diyCostEstimates inside analysis.diyResults when present (optional object).

Required checkpointSummary shape (always present, object):
{
  "checkpointsAnalyzed": <number>,
  "issuesDetected": <string[]>,
  "overallCondition": <string>,
  "locations": <string[]>,
  "queryType": <"single" | "comparison" | "trend" | "location-specific"> (optional),
  "dateRange": <string> (optional)
}

If an optional section is requested but data is sparse, return an object with empty/default nested fields instead of a string.

Expected optional section shapes:

coverageResult (object):
{
  "warrantyInfo": <string>,
  "insuranceInfo": <string>
}

diyResults (object):
{
  "diySteps": {
    "summary": <string>,
    "steps": [{"stepNumber": <number>, "description": <string>}]
  },
  "youtubeSearch": {
    "videos": [{"title": <string>, "url": <string>, "description": <string>}]
  },
  "recommendedProducts": {
    "products": [
      {
        "item_name": <string|null>,
        "image_url": <string|null>,
        "vendor": <string|null>,
        "reviews": <string|null>,
        "store_url": <string|null>
      }
    ]
  }

serviceResults (object):
{
  "localPros": {
    "serpAPIResults": <array>,
    "googleSearchResults": <array>
  }
}

costEstimationResults (object):
{
  "costEstimates": {
    "repair_type": <string>,
    "DIY": {
      "cost_range": <string>,
      "includes": <string[]>,
      "savings": <string>,
      "complexity": <string>
    },
    "Service": {
      "cost_range": <string>,
      "includes": <string[]>,
      "benefits": <string>,
      "complexity": <string>
    },
    "comparison": {
      "diy_savings": <string>,
      "professional_benefits": <string>,
      "considerations": <string>
    }
  }
}

Final validation before returning:
1) `analysis` exists and is an object.
2) `analysis.title` is a non-empty string.
3) `analysis.checkpointSummary` is an object (not string) with:
   - checkpointsAnalyzed (number)
   - issuesDetected (array)
   - overallCondition (string)
   - locations (array)
4) Any included optional section is an object, never string.
5) JSON is valid and parseable.
"""


def _build_checkpoint_analysis_workflow(
    *,
    workflow_name: str,
    parallel_agent_name: str,
    synthesis_agent_name: str,
    workflow_description: str,
) -> Tuple[SequentialAgent, CheckpointOptionalParallelAgent, Agent]:
    """Build a fresh parallel+synthesis workflow (ADK forbids sharing sub-agents)."""
    parallel = CheckpointOptionalParallelAgent(
        name=parallel_agent_name,
        description="Runs requested optional checkpoint branches in parallel using Python orchestration.",
    )
    synthesis = Agent(
        name=synthesis_agent_name,
        model=GLOBAL_GEMINI_MODEL,
        description="Synthesizes parallel checkpoint analysis results into final dual-format output.",
        instruction=_CHECKPOINT_SYNTHESIS_INSTRUCTION,
        input_schema=CheckpointAnalysisInput,
        after_model_callback=synthesis_after_model_callback,
    )
    workflow = SequentialAgent(
        name=workflow_name,
        description=workflow_description,
        sub_agents=[parallel, synthesis],
    )
    return workflow, parallel, synthesis


checkpoint_analysis_workflow, checkpoint_optional_parallel_agent, synthesis_agent = (
    _build_checkpoint_analysis_workflow(
        workflow_name="checkpoint_analysis_agent",
        parallel_agent_name="checkpoint_optional_agents_parallel_runner",
        synthesis_agent_name="checkpoint_analysis_synthesis_agent",
        workflow_description=(
            "Runs optional checkpoint agents in parallel then synthesizes one stable response."
        ),
    )
)

checkpoint_progress_agent, _, _ = _build_checkpoint_analysis_workflow(
    workflow_name="checkpoint_progress_agent",
    parallel_agent_name="checkpoint_progress_parallel_runner",
    synthesis_agent_name="checkpoint_progress_synthesis_agent",
    workflow_description=(
        "Runs optional checkpoint analysis with progressive updates; "
        "invoked via doculink transfer after checkpoint retrieval."
    ),
)

# Use the workflow directly as the exported entrypoint to remove one extra
# LLM delegation hop from the checkpoint-analysis path.
checkpoint_analysis_agent = checkpoint_analysis_workflow

__all__ = [
    "checkpoint_analysis_agent",
    "checkpoint_progress_agent",
    "CheckpointAnalysisInput",
    "CheckpointOptionalParallelAgent",
    "checkpoint_optional_parallel_agent",
    "execute_checkpoint_optional_parallel",
    "normalize_checkpoint_analysis_tool_args",
    "parse_checkpoint_analysis_payload",
    "parse_inline_checkpoint_analysis_request",
    "parse_legacy_checkpoint_analysis_prose",
    "run_checkpoint_optional_agents_parallel",
]
