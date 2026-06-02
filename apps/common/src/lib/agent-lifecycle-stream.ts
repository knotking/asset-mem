/** Persisted lifecycle status on Firestore assistant messages (proxy-written). */

import type { ThinkingStatus } from "./agent-display";

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
