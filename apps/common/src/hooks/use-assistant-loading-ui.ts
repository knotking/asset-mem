import { useMemo } from "react";
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
      }),
    [
      role,
      agentLifecycle,
      agentStepCount,
      hasDisplayableContent,
      isActiveLoading,
      priorAssistantTurnCount,
      followUpStripReady,
    ],
  );
}
