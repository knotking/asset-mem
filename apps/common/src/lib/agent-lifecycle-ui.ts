/** Client rules for assistant loading / lifecycle strip (keep in sync across mapp + webapp). */

import type { AgentLifecycle } from "./agent-lifecycle-stream";
import {
  isBeforeModelLifecyclePhase,
  isPreBeforeModelLifecyclePhase,
  isProxyLifecyclePhase,
  thinkingStatusFromLifecycle,
} from "./agent-lifecycle-stream";
import type { ThinkingStatus } from "./agent-display";

export {
  isBeforeModelLifecyclePhase,
  isPreBeforeModelLifecyclePhase,
  isProxyLifecyclePhase,
  PHASE_ENGINE_BEFORE_MODEL,
  PRE_BEFORE_MODEL_LIFECYCLE_PHASES,
  PROXY_LIFECYCLE_PHASES,
} from "./agent-lifecycle-stream";

/** Delay before showing lifecycle/thinking strip on follow-up turns (avoids flash). */
export const FOLLOW_UP_LIFECYCLE_STRIP_DELAY_MS = 350;

export const INTRO_MESSAGE_ID = "intro-message";

export function shouldExcludeAssistantTurnMessage(messageId: string): boolean {
  return messageId === INTRO_MESSAGE_ID || messageId.startsWith("local-");
}

/** Assistant replies strictly before `currentMessageId` in chronological order. */
export function countPriorAssistantTurnsInSession(
  messages: ReadonlyArray<{ id: string; role: string }>,
  currentMessageId: string,
): number {
  let prior = 0;
  for (const m of messages) {
    if (m.id === currentMessageId) {
      break;
    }
    if (
      m.role === "assistant" &&
      !shouldExcludeAssistantTurnMessage(m.id)
    ) {
      prior += 1;
    }
  }
  return prior;
}

export type ResolveAssistantLoadingUiInput = {
  role: string;
  agentLifecycle?: AgentLifecycle | null;
  agentStepCount: number;
  hasDisplayableContent: boolean;
  isActiveLoading: boolean;
  priorAssistantTurnCount: number;
  /** From `useFollowUpLifecycleStripDelay` — always true on first assistant turn. */
  followUpStripReady: boolean;
};

export type AssistantLoadingUiState = {
  showTypingIndicator: boolean;
  showLifecycleStrip: boolean;
  showThinkingStrip: boolean;
  /** Pre-content lifecycle / pipeline strip. */
  showStatusStrip: boolean;
  lifecycleStatus: ThinkingStatus | null;
  /** Lifecycle strip header text (empty when copy suppressed). */
  lifecycleHeader: string;
  showLifecycleCopy: boolean;
  useProxyWaveIndicator: boolean;
  /** Bubble dots (bounce pre-lifecycle; wave until follow-up reaches before_model). */
  typingIndicatorVariant: "bounce" | "wave";
};

export function resolveAssistantLoadingUi(
  input: ResolveAssistantLoadingUiInput,
): AssistantLoadingUiState {
  const {
    role,
    agentLifecycle,
    agentStepCount,
    hasDisplayableContent,
    isActiveLoading,
    priorAssistantTurnCount,
    followUpStripReady,
  } = input;

  const empty: AssistantLoadingUiState = {
    showTypingIndicator: false,
    showLifecycleStrip: false,
    showThinkingStrip: false,
    showStatusStrip: false,
    lifecycleStatus: null,
    lifecycleHeader: "",
    showLifecycleCopy: false,
    useProxyWaveIndicator: false,
    typingIndicatorVariant: "bounce",
  };

  if (role !== "assistant" || !isActiveLoading) {
    return empty;
  }

  if (hasDisplayableContent) {
    return empty;
  }

  const phase = agentLifecycle?.phase;
  const isProxyPhase = isProxyLifecyclePhase(phase);
  const isFirstTurn = priorAssistantTurnCount === 0;
  const lifecycleStatus = thinkingStatusFromLifecycle(agentLifecycle);
  const hasAgentSteps = agentStepCount > 0;
  const hasLifecycleData = !!lifecycleStatus && !hasAgentSteps;

  const showLifecycleStrip =
    hasLifecycleData &&
    (isFirstTurn || (isBeforeModelLifecyclePhase(phase) && followUpStripReady));

  const showThinkingStrip = hasAgentSteps;
  const showStatusStrip = showLifecycleStrip || showThinkingStrip;
  const showTypingIndicator = !showStatusStrip;

  const showLifecycleCopy =
    showLifecycleStrip && (isFirstTurn || !isProxyPhase);
  const useProxyWaveIndicator =
    showLifecycleStrip && isProxyPhase && isFirstTurn;
  const lifecycleHeader = showLifecycleCopy
    ? (lifecycleStatus?.header ?? "")
    : "";
  const useWaveBubble =
    showTypingIndicator &&
    (isFirstTurn
      ? isProxyPhase
      : isPreBeforeModelLifecyclePhase(phase));
  const typingIndicatorVariant: "bounce" | "wave" = useWaveBubble
    ? "wave"
    : "bounce";

  return {
    showTypingIndicator,
    showLifecycleStrip,
    showThinkingStrip,
    showStatusStrip,
    lifecycleStatus: showLifecycleStrip ? lifecycleStatus : null,
    lifecycleHeader,
    showLifecycleCopy,
    useProxyWaveIndicator,
    typingIndicatorVariant,
  };
}
