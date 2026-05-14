"""
Checkpoint Analysis Agent

Orchestrates coverage, DIY, service, and cost agents to provide comprehensive
recommendations based on checkpoint data analysis.
"""

import asyncio
import json
import logging
import re
import time
from typing import Optional, List, Dict, Any, Tuple
from google.adk.agents import Agent, SequentialAgent
from google.adk.tools import ToolContext
from google.adk.tools.agent_tool import AgentTool
from pydantic import BaseModel, Field
from dotenv import load_dotenv
from ..coverage_agent.agent import coverage_agent
from ..diy_agent.agent import diy_agent
from ..diy_agent.orchestrator import run_diy_pipeline
from ..service_agent.agent import service_agent
from ..cost_agent.agent import cost_agent
from ...agent_inputs import CheckpointOptionalAgent
from ...model_config import GLOBAL_GEMINI_MODEL
from ..checkpoint_dual_format_guard import synthesis_after_model_callback

load_dotenv()

logger = logging.getLogger(__name__)


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
    property_address: Optional[str] = Field(default=None, description="Property address for location-based services")
    property_id: Optional[str] = Field(default=None, description="Property ID for reference")
    location_coordinates: Optional[Dict[str, float]] = Field(default=None, description="Location coordinates for service searches")
    location_radius: Optional[int] = Field(default=None, description="Search radius for local services")


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
    addr = (payload.get("property_address") or "").strip() or None
    uris = payload.get("context_doc_uris")
    return await run_diy_pipeline(
        diagnosis,
        property_address=addr,
        context_doc_uris=uris,
        checkpoint_retrieval_search_query=payload["checkpoint_retrieval_search_query"],
    )


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
    try:
        if name == "diy":
            result = await _run_checkpoint_diy_pipeline(payload)
        else:
            agent, _ = _BRANCH_AGENTS[name]
            result = await _invoke_optional_agent_async(agent, payload, tool_context)
        return _normalize_agent_result(result)
    except Exception:
        logger.exception("checkpoint optional branch failed: %s", name)
        return "SKIPPED"
    finally:
        logger.info(
            "checkpoint optional branch timing: branch=%s duration_ms=%d",
            name,
            int((time.monotonic() - branch_start) * 1000),
        )


def _serialize_and_store_parallel_results(
    tool_context: Optional[ToolContext], results: Dict[str, str]
) -> str:
    """Canonical JSON for optional branches; always persist to session when context exists."""
    out = json.dumps(results, ensure_ascii=False)
    if tool_context is not None:
        tool_context.state["checkpoint_parallel_results"] = out
    return out


async def run_checkpoint_optional_agents_parallel(
    checkpoint_results: str,
    user_query: str,
    checkpoint_optional_agents: List[CheckpointOptionalAgent],
    context_doc_uris: Optional[List[str]] = None,
    property_address: Optional[str] = None,
    property_id: Optional[str] = None,
    location_coordinates: Optional[Dict[str, float]] = None,
    location_radius: Optional[int] = None,
    search_query: Optional[str] = None,
    tool_context: ToolContext = None,
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
        return _serialize_and_store_parallel_results(tool_context, results)

    if tool_context is None:
        logger.error(
            "run_checkpoint_optional_agents_parallel missing tool_context; skipping optional branches"
        )
        return json.dumps(results, ensure_ascii=False)

    branch_user_query = resolve_branch_search_user_query(
        search_query, checkpoint_results, max_chars=400
    )
    if not (search_query or "").strip() and len(branch_user_query) + 40 < len(
        checkpoint_results or ""
    ):
        logger.info(
            "checkpoint optional branches: derived from checkpoint_results only query_len=%d checkpoint_results_len=%d",
            len(branch_user_query),
            len(checkpoint_results or ""),
        )

    payload: Dict[str, Any] = {
        # Passed to coverage/diy/service/cost as DocsInput.user_query; DIY YouTube/shopping ignore this
        # when ``checkpoint_retrieval_search_query`` is set (they use only the retrieval seed).
        "user_query": branch_user_query,
        "checkpoint_results": checkpoint_results,
        "checkpoint_retrieval_search_query": (search_query or "").strip(),
        "context_doc_uris": context_doc_uris,
        "property_address": property_address,
        "property_id": property_id,
        "location_coordinates": location_coordinates,
        "location_radius": location_radius,
    }

    branch_results = await asyncio.gather(
        *(
            _run_single_optional_agent_async(name, payload, tool_context)
            for name in requested
        ),
        return_exceptions=False,
    )
    for name, value in zip(requested, branch_results):
        _, key = _BRANCH_AGENTS[name]
        results[key] = value

    logger.info(
        "checkpoint optional runner timing: requested=%s total_duration_ms=%d",
        sorted(set(requested)),
        int((time.monotonic() - total_start) * 1000),
    )
    return _serialize_and_store_parallel_results(tool_context, results)


parallel_optional_runner_agent = Agent(
    name="checkpoint_optional_agents_parallel_runner",
    model=GLOBAL_GEMINI_MODEL,
    description="Runs requested optional checkpoint branches in parallel using Python orchestration.",
    instruction="""
Call run_checkpoint_optional_agents_parallel exactly once with the full input payload.
Return only the tool output without additional narration.
""",
    tools=[run_checkpoint_optional_agents_parallel],
    input_schema=CheckpointAnalysisInput,
    disallow_transfer_to_parent=True,
)

synthesis_agent = Agent(
    name="checkpoint_analysis_synthesis_agent",
    model=GLOBAL_GEMINI_MODEL,
    description="Synthesizes parallel checkpoint analysis results into final dual-format output.",
    instruction="""
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
""",
    input_schema=CheckpointAnalysisInput,
    after_model_callback=synthesis_after_model_callback,
)

checkpoint_analysis_workflow = SequentialAgent(
    name="checkpoint_analysis_agent",
    description="Runs optional checkpoint agents in parallel then synthesizes one stable response.",
    sub_agents=[parallel_optional_runner_agent, synthesis_agent],
)

# Use the workflow directly as the exported entrypoint to remove one extra
# LLM delegation hop from the checkpoint-analysis path.
checkpoint_analysis_agent = checkpoint_analysis_workflow

__all__ = ["checkpoint_analysis_agent", "CheckpointAnalysisInput"]
