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
