import { useEffect, useRef, useState } from "react";
import type { AgentStep } from "../types";
import {
  COORDINATING_LABEL,
  DEFAULT_THINKING_LABEL,
  getThinkingStatusFromSteps,
  type ThinkingStatus,
  type ThinkingStatusOptions,
} from "../lib/agent-display";

const DEBOUNCE_MS = 400;

function statusKey(status: ThinkingStatus): string {
  return `${status.header}\u0000${status.preview ?? ""}`;
}

/**
 * Debounce thinking-strip text so rapid agent handoffs do not flicker labels.
 * Promotes to {@link COORDINATING_LABEL} immediately so "Working on it" never flashes first.
 */
export function useDebouncedThinkingStatus(
  steps: AgentStep[] | undefined | null,
  options?: ThinkingStatusOptions,
): ThinkingStatus {
  const next = getThinkingStatusFromSteps(steps, options);
  const nextKey = statusKey(next);
  const [debounced, setDebounced] = useState(next);
  const debouncedKeyRef = useRef(statusKey(debounced));

  useEffect(() => {
    if (nextKey === debouncedKeyRef.current) return;

    const promoteToCoordinating =
      next.header === COORDINATING_LABEL && debounced.header === DEFAULT_THINKING_LABEL;
    const delay = promoteToCoordinating ? 0 : DEBOUNCE_MS;

    const timer = setTimeout(() => {
      setDebounced(next);
      debouncedKeyRef.current = nextKey;
    }, delay);
    return () => clearTimeout(timer);
  }, [next, nextKey, debounced.header]);

  if (nextKey === debouncedKeyRef.current) {
    return next;
  }
  if (next.header === COORDINATING_LABEL && debounced.header === DEFAULT_THINKING_LABEL) {
    return next;
  }
  return debounced;
}
