import type {
  AnalysisOptionalAgent,
  CheckpointOptionalAgent,
  PrimaryAgent,
} from "../types";
import { getPrimaryAgentLabel } from "./primary-agent-display";

export function buildCollapsedComposerSummary({
  primaryAgent,
  selectedOptionalAgents,
  selectedCheckpointOptionalAgents,
  readyContextCount,
  pendingContextCount,
  hasQueuedSend,
}: {
  primaryAgent: PrimaryAgent;
  selectedOptionalAgents: AnalysisOptionalAgent[];
  selectedCheckpointOptionalAgents: CheckpointOptionalAgent[];
  readyContextCount: number;
  pendingContextCount: number;
  hasQueuedSend: boolean;
}): string {
  const parts = [getPrimaryAgentLabel(primaryAgent)];

  const optionalCount =
    primaryAgent === "analysis"
      ? selectedOptionalAgents.length
      : primaryAgent === "checkpoint"
        ? selectedCheckpointOptionalAgents.length
        : 0;
  if (optionalCount > 0) {
    parts[0] = `${parts[0]} +${optionalCount}`;
  }

  if (hasQueuedSend) {
    parts.push("queued message");
  } else {
    const contextTotal = readyContextCount + pendingContextCount;
    if (contextTotal > 0) {
      parts.push(
        pendingContextCount > 0 && readyContextCount === 0
          ? `${pendingContextCount} pending`
          : `${contextTotal} attached`,
      );
    }
  }

  return parts.join(" · ");
}
