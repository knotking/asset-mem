# Checkpoint analysis pipeline

## Overview

Checkpoint analysis runs **inside** `run_checkpoint_pipeline` (`checkpoint/pipeline.py`). It coordinates retrieval results with optional leaf agents (coverage, DIY, service, cost), assembles structured UI data in code, and runs a narrow synthesis LLM for markdown prose only.

Canonical contract: [`property_agent/ARCHITECTURE.md`](../../../property_agent/ARCHITECTURE.md).

## Purpose

When users request actionable recommendations from checkpoints, the pipeline:

- Parses retrieval output into issues and checkpoint summaries
- Runs optional branches in parallel via `checkpoint/analysis/parallel_runner.py`
- Assembles `contentJson` deterministically (`checkpoint/analysis/assembler.py`)
- Synthesizes summary markdown with an issue-specific H1 title (no "Executive Summary" prefix; no fenced JSON in model output)
- Emits incremental `state_delta` patches for the proxy to merge into Firestore messages

## Architecture

```
run_checkpoint_pipeline (FunctionTool)
├── composite_hooks.py           # CompositePipelineHooks + branch orchestration
├── checkpoint/retrieval/        # vector search → checkpoint_results
├── parallel_runner.py           # per-branch workers (delegates orchestration to hooks)
├── assembler.py                 # contentJson (StructuredResponseData shape)
└── synthesis                    # contentMarkdown only
```

Leaf agents under `property_agent/agents/` (coverage, diy, service, cost, shopping) are invoked by the parallel runner — not as separate root orchestrator routes.

## Input context

The pipeline reads session / tool context set by resolve and the orchestrator:

- `checkpoint_results` — retrieval blob
- `user_query`, `property_id`, `checkpoint_ids`
- `checkpoint_optional_agents` — subset of `["coverage", "diy", "service", "cost"]`
- `context_doc_uris`, `property_address`, `search_location` — branch inputs

## Workflow

1. **Retrieval** (upstream in pipeline) — Firestore vector search over selected checkpoints
2. **Parallel branches** — `parallel_runner.py` runs enabled branches concurrently; each no-ops if its key is absent from `checkpoint_optional_agents`
3. **Assemble** — code merges branch payloads into `analysis` with `analysisStatus` per branch
4. **Synthesize** — LLM produces markdown summary; JSON comes from step 3, not model fences
5. **Emit** — `apply_tool_context_state_delta` patches `contentJson`, `contentMarkdown`, `agentSteps`, `analysisRunId`

## Output contract (V2)

Serving path output is **not** a dual-format string (markdown + ```json fence). The proxy persists separate fields on the chat message:

| Field | Source |
| ----- | ------ |
| `contentJson` | Assembler (`analysis`, `analysisStatus`, branch results) |
| `contentMarkdown` | Synthesis LLM |
| `analysisRunId` | Pipeline idempotency key |
| `agentSteps` | Branch progress ticker |

Clients render via `@homeapp/common` `resolveMessageContentParts` — accordions from `contentJson`, prose from `contentMarkdown`. Do **not** parse fenced JSON from `message.content` or use `properties/{id}/analysis/current` for chat UI.

## ADK dev streaming

`HomecareRunner` + `checkpoint/progress_stream.py` enqueue progress **text** events while the pipeline runs (author `checkpoint_analysis_progress`). Production/proxy path uses Reasoning Engine `state_delta` events merged by `message_content_persist`.

## Related modules

| Module | Role |
| ------ | ---- |
| `parallel_runner.py` | Platform parallel runner bindings |
| `assembler.py` | Deterministic `contentJson` assembly |
| `search_query.py` | Optional query refinement for retrieval |
| `checkpoint_parse.py` | Parse workflow input JSON + session stash |
