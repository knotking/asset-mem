/** Persisted lifecycle on Firestore assistant messages — keep phases aligned with proxy. */

export const LIFECYCLE_PHASE_MESSAGES: Record<string, string> = {
  "proxy.request_accepted": "On it...",
  "proxy.engine_invoke": "Setting things up...",
  "engine.turn_started": "Reviewing details...",
  "engine.runner_exec": "Working on it...",
  "engine.before_model": "Planning next moves...",
};

export type AgentLifecycle = {
  phase: string;
  message: string;
  ts?: string;
};

export function thinkingStatusFromLifecycle(
  lifecycle: AgentLifecycle | null | undefined,
): { header: string; preview?: string | null } | null {
  if (!lifecycle) {
    return null;
  }
  const header =
    (typeof lifecycle.message === "string" && lifecycle.message.trim()) ||
    LIFECYCLE_PHASE_MESSAGES[lifecycle.phase] ||
    lifecycle.phase;
  return { header, preview: null };
}
