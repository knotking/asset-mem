/**
 * Mirrors `apps/common/src/lib/agent-lifecycle-stream.ts` for Firebase App Hosting:
 * the webapp does not depend on `@asset-mem/common`. Keep both files in sync.
 */

import type { ThinkingStatus } from "@/lib/agent-display";

export type { ThinkingStatus };

/** Keep in sync with `gcp/common/lifecycle/events.py` phase strings. */
export const LIFECYCLE_PHASE_MESSAGES: Record<string, string> = {
  "proxy.request_accepted": "On it...",
  "proxy.engine_invoke": "Setting things up...",
  "engine.turn_started": "Reviewing details...",
  "engine.runner_exec": "Working on it...",
  "engine.before_model": "Planning next moves...",
};

/** Subset stored on `users/{uid}/chats/{chatId}/messages/{id}.agentLifecycle`. */
export type AgentLifecycle = {
  phase: string;
  message: string;
  ts?: string;
};

/** Proxy-only phases (handoff); UI uses wave dots and optional copy on first turn. */
export const PROXY_LIFECYCLE_PHASES = new Set<string>([
  "proxy.request_accepted",
  "proxy.engine_invoke",
]);

export function isProxyLifecyclePhase(phase: string | undefined | null): boolean {
  return !!phase && PROXY_LIFECYCLE_PHASES.has(phase);
}

export const PHASE_ENGINE_BEFORE_MODEL = "engine.before_model";

/** Monotonic ordering for lifecycle UI (late out-of-order persist must not regress). */
export const LIFECYCLE_PHASE_RANK: Record<string, number> = {
  "proxy.request_accepted": 10,
  "proxy.engine_invoke": 20,
  "engine.turn_started": 30,
  "engine.runner_exec": 40,
  "engine.before_model": 50,
};

export function lifecyclePhaseRank(phase: string | undefined | null): number {
  if (!phase) {
    return -1;
  }
  return LIFECYCLE_PHASE_RANK[phase] ?? 0;
}

/** Higher-ranked phase wins (e.g. keep `before_model` when `runner_exec` arrives late). */
export function maxLifecyclePhase(
  a: string | undefined | null,
  b: string | undefined | null,
): string | null {
  if (!a) {
    return b ?? null;
  }
  if (!b) {
    return a;
  }
  return lifecyclePhaseRank(a) >= lifecyclePhaseRank(b) ? a : b;
}

/** Follow-up bubble wave through proxy + early engine; strip starts at `before_model`. */
export const PRE_BEFORE_MODEL_LIFECYCLE_PHASES = new Set<string>([
  ...PROXY_LIFECYCLE_PHASES,
  "engine.turn_started",
  "engine.runner_exec",
]);

export function isPreBeforeModelLifecyclePhase(
  phase: string | undefined | null,
): boolean {
  return !!phase && PRE_BEFORE_MODEL_LIFECYCLE_PHASES.has(phase);
}

export function isBeforeModelLifecyclePhase(
  phase: string | undefined | null,
): boolean {
  return phase === PHASE_ENGINE_BEFORE_MODEL;
}

/** Map persisted lifecycle to thinking-strip header (no timing in UI). */
export function thinkingStatusFromLifecycle(
  lifecycle: AgentLifecycle | null | undefined,
): ThinkingStatus | null {
  if (!lifecycle) {
    return null;
  }
  const header =
    (typeof lifecycle.message === "string" && lifecycle.message.trim()) ||
    LIFECYCLE_PHASE_MESSAGES[lifecycle.phase] ||
    lifecycle.phase;
  return { header, preview: null };
}
