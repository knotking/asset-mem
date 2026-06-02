import { useEffect, useState } from "react";
import { FOLLOW_UP_LIFECYCLE_STRIP_DELAY_MS } from "../lib/agent-lifecycle-ui";

/**
 * First assistant turn: strip can show immediately.
 * Follow-ups: wait before lifecycle/engine strip to avoid copy flash.
 */
export function useFollowUpLifecycleStripDelay(
  isActiveLoading: boolean,
  hasDisplayableContent: boolean,
  priorAssistantTurnCount: number,
  messageId: string,
): boolean {
  const isFirstTurn = priorAssistantTurnCount === 0;
  const [ready, setReady] = useState(isFirstTurn);

  useEffect(() => {
    if (isFirstTurn) {
      setReady(true);
      return;
    }
    if (!isActiveLoading || hasDisplayableContent) {
      setReady(false);
      return;
    }
    setReady(false);
    const timer = setTimeout(
      () => setReady(true),
      FOLLOW_UP_LIFECYCLE_STRIP_DELAY_MS,
    );
    return () => clearTimeout(timer);
  }, [
    isFirstTurn,
    isActiveLoading,
    hasDisplayableContent,
    messageId,
  ]);

  return ready;
}
