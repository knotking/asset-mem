import { useEffect, useMemo, useState } from "react";
import { maxLifecyclePhase } from "../lib/agent-lifecycle-stream";
import {
  resolveAssistantLoadingUi,
  type ResolveAssistantLoadingUiInput,
} from "../lib/agent-lifecycle-ui";
import { useFollowUpLifecycleStripDelay } from "./use-follow-up-lifecycle-strip-delay";

export type UseAssistantLoadingUiInput = Omit<
  ResolveAssistantLoadingUiInput,
  "followUpStripReady"
> & {
  messageId: string;
};

export function useAssistantLoadingUi({
  messageId,
  role,
  agentLifecycle,
  agentStepCount,
  hasDisplayableContent,
  isActiveLoading,
  priorAssistantTurnCount,
}: UseAssistantLoadingUiInput) {
  const followUpStripReady = useFollowUpLifecycleStripDelay(
    isActiveLoading,
    hasDisplayableContent,
    priorAssistantTurnCount,
    messageId,
  );

  const [peakLifecyclePhase, setPeakLifecyclePhase] = useState<string | null>(
    null,
  );

  useEffect(() => {
    setPeakLifecyclePhase(null);
  }, [messageId]);

  useEffect(() => {
    if (!isActiveLoading) {
      setPeakLifecyclePhase(null);
      return;
    }
    const phase = agentLifecycle?.phase;
    if (!phase) {
      return;
    }
    setPeakLifecyclePhase((prev) => maxLifecyclePhase(prev, phase));
  }, [isActiveLoading, agentLifecycle?.phase]);

  return useMemo(
    () =>
      resolveAssistantLoadingUi({
        role,
        agentLifecycle,
        agentStepCount,
        hasDisplayableContent,
        isActiveLoading,
        priorAssistantTurnCount,
        followUpStripReady,
        peakLifecyclePhase,
      }),
    [
      role,
      agentLifecycle,
      agentStepCount,
      hasDisplayableContent,
      isActiveLoading,
      priorAssistantTurnCount,
      followUpStripReady,
      peakLifecyclePhase,
    ],
  );
}
