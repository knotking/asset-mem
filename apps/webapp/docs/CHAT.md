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

**Tests:** Mirrored libs have Jest coverage under `apps/webapp/__tests__/` (ported from `apps/common` / `apps/mapp` where applicable). Run `npm run test` in `apps/webapp`.

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
| `src/lib/sort-messages.ts` | `apps/common/src/lib/sort-messages.ts` |
| `src/lib/executive-summary-display.ts` | `apps/common/src/lib/executive-summary-display.ts` |
| `src/lib/structured-accordion-defaults.ts` | `apps/common/src/lib/structured-accordion-defaults.ts` |
| `src/lib/suggested-actions.ts` | `apps/common/src/lib/suggested-actions.ts` |
| `src/lib/deletion/` | `apps/common/src/lib/deletion/` |
| `src/hooks/use-optimistic-deletion-overlay.ts` | `apps/common/src/hooks/use-optimistic-deletion-overlay.ts` |
| `src/hooks/use-notifications.ts` | `apps/common/src/hooks/use-notifications.ts` |
| `src/contexts/deletion-config-context.tsx` | `apps/common/src/contexts/deletion-config-context.tsx` |

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
| **Composer progress strip** | `CheckpointAnalysisProgressFooter` above context chips while branches/synthesis are in flight (`getInFlightCheckpointProgressFromMessages`); shows **Writing your summary…** during the server gap after optional branches finish and before `analysisStatus.synthesis` arrives |
| **Suggested-action chips** | Quick-reply buttons below accordions — hidden while `isTurnInFlight`; shown when the turn completes |
| **Structured accordion** | `displayParts.structuredData` set; inline **checkpoint summary card** (always visible) plus collapsible sections; title card **Open full report** opens a side sheet with all sections expanded |
| **Title gradient** | Structured title card shimmers via `shouldShowDisplayTitleGradient` during the client stream (stops once `analysis.title` is present and SSE closes; branch/synthesis progress uses the composer footer) |
| **Markdown bubble** | Displayable markdown, no structured UI |
| **Copy button** | Assistant messages — dual clipboard on web (`text/plain` WhatsApp-friendly + `text/html` with markdown links); mapp stays WhatsApp plain |

Thinking strip labels come from `useDebouncedThinkingStatus` → `getThinkingStatusFromSteps` (`src/lib/agent-display.ts`), with checkpoint branch progress from streaming `contentJson` when branches are in flight.

## Parent loading flag (`chat-list.tsx`)

`ChatList` passes `isTurnInFlight` when the message id matches `getActiveStreamingAssistantMessageId(messages, isStreamActive)`. The helper also treats the last assistant as in-flight on **passive clients** (other device/tab) when Firestore still has `agentSteps`, `agentLifecycle`, in-progress `analysisStatus`, or an empty assistant placeholder immediately after the user message (pre-content shell before the first lifecycle patch) — so webapp and mapp stay in sync without a local stream.

Pre-content loading UI still uses `!hasDisplayableContent && isTurnInFlight`.

Uses V2 fields — not raw `message.content` alone.

## Key files

| File | Role |
|------|------|
| `src/components/chat/chat-message.tsx` | Render markdown, accordion, thinking strip |
| `src/components/chat/structured-accordion-section-icon.tsx` | Circular muted icon badge for structured accordion triggers |
| `src/components/chat/structured-checkpoint-summary-card.tsx` | Inline always-visible checkpoint summary preview |
| `src/components/chat/checkpoint-summary-fields.tsx` | Label/value helpers for checkpoint summary sections |
| `src/components/chat/checkpoint-summary-content.tsx` | Shared checkpoint summary body (inline card + full report) |
| `src/lib/checkpoint-summary-display.ts` | Overall-condition first-letter formatting (local copy; sync with `@homeapp/common` for mapp) |
| `src/components/chat/structured-report-sheet.tsx` | Full-report side sheet for structured messages |
| `src/components/chat/diy-video-tutorials-section.tsx` | DIY video preview list + side sheet with embedded players |
| `src/components/chat/chat-list.tsx` | Scroll + `isLoading` for streaming placeholder |
| `src/app/home/properties/[propertyId]/chat/[sessionId]/page.tsx` | Send message, Firestore listener, SSE stream; strips `fromOnboardingChecklist` query param immediately on landing (preference write is fire-and-forget) so property tab navigations are not raced |
| `src/lib/message-copy-clipboard.ts` | Web dual-format clipboard (`text/plain` + `text/html` with StartFragment + div-per-line for Gmail) |
| `src/lib/message-copy-text.ts` | Plain-text export for copy/share (structured accordions + markdown) |
| `src/lib/message-content-parts.ts` | Read `contentMarkdown` / `contentJson` |
| `src/lib/message-display-parts.ts` | Structured vs markdown gating |
| `src/hooks/use-debounced-thinking-status.ts` | Debounced thinking strip text |
| `src/components/chat/composer-meta-section.tsx` | Context-mode composer collapse, summary pill, settings row |
| `src/lib/composer-collapse.ts` | Collapsed summary text (agent + optional agents + context counts) |
| `src/lib/settings-navigation.ts` | Origin-aware back from header settings shortcuts |

## Property chat composer (context mode)

`PropertyChatWithContext` uses `ComposerMetaSection` (via `ChatInput` when `onOpenAddContext` is set):

- **Expanded:** context chip strip, `CompactSettingsBar` (agent/location pills; location truncates on narrow widths), separate settings + collapse chevron buttons (avoids overlap when checkpoint shows `+N` optional agents).
- **Collapsed:** single summary pill (`Checkpoint +4 · 2 context`, etc.); tap pill opens chat settings popover; chevron expands chips/settings again.
- Send-block hints remain visible when collapsed.

Header shortcuts (usage, FAQ, settings) use `settings-navigation` return params so back restores the same property tab and chat session.

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
