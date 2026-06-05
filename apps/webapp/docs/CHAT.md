# Webapp chat UI — Orchestrator V2 message contract

How the Next.js webapp renders Firestore chat messages after the Orchestrator V2 cutover (`contentMarkdown` + `contentJson`). Aligned with mapp; see `apps/mapp/docs/CHAT_IMPLEMENTATION.md` for mobile-specific GiftedChat details.

## Message fields

The proxy persists assistant output as separate Firestore fields (not fenced JSON inside `content`):

| Field | Purpose |
|-------|---------|
| `contentMarkdown` | Prose for markdown rendering |
| `contentJson` | Structured accordion payload (`analysis.*`) |
| `contentSchemaVersion` | Schema version (expect `2` for new messages) |
| `agentSteps` | In-flight tool/agent rows for the thinking strip |
| `agentLifecycle` | Early-turn lifecycle strip (`phase`, `message`); cleared when `agentSteps` arrive |
| `content` | Legacy fallback; resolver reads `contentMarkdown` first |

User messages set both `content` and `contentMarkdown` on send (`chat/[sessionId]/page.tsx`).

## Local lib copies (App Hosting)

Webapp does **not** import `@homeapp/common` at runtime. Keep these in sync with common/mapp:

**Guardrails:** ESLint `no-restricted-imports`, `npm run check:no-common`, CI workflow `test-webapp.yaml`.

| Module | Sync with |
|--------|-----------|
| `src/lib/message-content-parts.ts` | `apps/common/src/lib/message-content-parts.ts` |
| `src/lib/message-display-parts.ts` | `apps/mapp/lib/chat-content-parse.ts` |
| `src/lib/agent-display.ts` | `apps/common/src/lib/agent-display.ts` |
| `src/lib/agent-lifecycle.ts` | `apps/common/src/lib/agent-lifecycle-stream.ts` |
| `src/lib/agent-lifecycle-ui.ts` | `apps/common/src/lib/agent-lifecycle-ui.ts` |
| `src/hooks/use-follow-up-lifecycle-strip-delay.ts` | `apps/common/src/hooks/use-follow-up-lifecycle-strip-delay.ts` |
| `src/hooks/use-assistant-loading-ui.ts` | `apps/common/src/hooks/use-assistant-loading-ui.ts` |
| `src/lib/checkpoint-branch-progress.ts` | `apps/common/src/lib/checkpoint-branch-progress.ts` |
| `src/lib/plan-limit-errors.ts` | `apps/common/src/lib/document-analysis-errors.ts` |
| `src/lib/home-onboarding.ts` | `apps/common/src/lib/home-onboarding.ts` |

## Display resolution flow

```
Firestore message
      ↓
resolveMessageContentParts(message)     → markdown, contentJson
      ↓
getMessageDisplayParts(message)         → structuredData | markdown
      ↓
assistantMessageHasDisplayableContent   → hasDisplayableContent (assistant)
```

**Rules:**

1. If `contentJson` has **visible sections** (`structuredDataHasVisibleSections`), render `StructuredResponse` accordion — structured wins over markdown (including dual-format messages).
2. Empty streaming shells (e.g. title-only `contentJson`) are **not** displayable; thinking strip stays visible.
3. Otherwise render markdown from `contentMarkdown` (fallback: `content`).

## UI states (`chat-message.tsx`)

| State | When |
|-------|------|
| **Lifecycle strip** (`AssistantProgressStrip`) | Assistant, `!hasDisplayableContent`, `agentLifecycle` set, no `agentSteps` yet |
| **Thinking strip** (`AssistantProgressStrip`) | Assistant, `!hasDisplayableContent`, `agentSteps.length > 0` |
| **Loading dots** | `isLoading` from parent **and** no displayable content **and** no thinking strip |
| **Structured accordion** | `displayParts.structuredData` set |
| **Markdown bubble** | Displayable markdown, no structured UI |
| **Copy button** | Markdown-only assistant responses |

Thinking strip labels come from `useDebouncedThinkingStatus` → `getThinkingStatusFromSteps` (`src/lib/agent-display.ts`), with checkpoint branch progress from streaming `contentJson` when branches are in flight.

## Parent loading flag (`chat-list.tsx`)

`ChatList` passes `isLoading` to the last assistant message when:

```typescript
assistantHasNoDisplayableContentYet(message)
// ≡ !assistantMessageHasDisplayableContent(getMessageDisplayParts(message))
```

Uses V2 fields — not raw `message.content` alone.

## Key files

| File | Role |
|------|------|
| `src/components/chat/chat-message.tsx` | Render markdown, accordion, thinking strip |
| `src/components/chat/chat-list.tsx` | Scroll + `isLoading` for streaming placeholder |
| `src/app/home/properties/[propertyId]/chat/[sessionId]/page.tsx` | Send message, Firestore listener, SSE stream; strips `fromOnboardingChecklist` query param immediately on landing (preference write is fire-and-forget) so property tab navigations are not raced |
| `src/lib/message-content-parts.ts` | Read `contentMarkdown` / `contentJson` |
| `src/lib/message-display-parts.ts` | Structured vs markdown gating |
| `src/hooks/use-debounced-thinking-status.ts` | Debounced thinking strip text |

## Removed / obsolete

- **No** JSON-in-markdown parsing in the render hot path.
- **`AgentStatus` card** removed — replaced by inline `AssistantProgressStrip` in `chat-message.tsx`.
- **`chat/context-documents-panel.tsx`** removed — use `components/properties/context-documents-panel.tsx`.

## Testing

Manual smoke on staging:

1. Docs chat — markdown prose streams, then final message.
2. Checkpoint analysis — thinking strip during tools; accordion when `contentJson` sections populate.
3. Dual-format message — accordion only (not duplicate markdown prose).

Cross-client parity: compare the same Firestore message in webapp and mapp.
