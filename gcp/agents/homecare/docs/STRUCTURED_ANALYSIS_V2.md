# Structured analysis (V2)

> **Superseded:** This document is archived. The canonical V2 serving-path spec is
> [`ORCHESTRATOR_V2_PLAN.md`](./ORCHESTRATOR_V2_PLAN.md).

## Summary

- **Chat SSOT:** Firestore message fields `contentMarkdown` (prose) and `contentJson` (structured `analysis` object).
- **Pipeline:** Root orchestrator calls `run_checkpoint_pipeline` → retrieval → optional branches → assembler → `state_delta` patches.
- **Clients:** `resolveMessageContentParts`; no `properties/{id}/analysis/current` for chat rendering.
- **Proxy:** `message_content_persist` merges `state_delta` into the assistant message document.

See the orchestrator plan for routing, session memory, compaction, and dead-code notes.
