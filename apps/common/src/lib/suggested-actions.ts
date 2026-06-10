import type { StructuredResponseData } from "../types";

export type ChatIntentHint = "discuss_report" | "new_analysis" | "replay_report";

export type ChipActionBranch = "coverage" | "diy" | "service" | "cost";

/** Structured chip action echoed back as chip_action for deterministic routing. */
export type ChipAction =
  | { type: "run_branch"; branch: ChipActionBranch }
  | { type: "discuss"; topic?: string }
  | { type: "replay_report" };

export type SuggestedAction = {
  label: string;
  userQuery: string;
  chatIntent?: ChatIntentHint;
  action?: ChipAction;
};

const CHIP_ACTION_BRANCHES: readonly string[] = ["coverage", "diy", "service", "cost"];

function parseChipAction(value: unknown): ChipAction | undefined {
  if (!value || typeof value !== "object") return undefined;
  const row = value as Record<string, unknown>;
  if (row.type === "run_branch" && typeof row.branch === "string" && CHIP_ACTION_BRANCHES.includes(row.branch)) {
    return { type: "run_branch", branch: row.branch as ChipActionBranch };
  }
  if (row.type === "discuss") {
    return { type: "discuss", topic: typeof row.topic === "string" ? row.topic : undefined };
  }
  if (row.type === "replay_report") {
    return { type: "replay_report" };
  }
  return undefined;
}

function isSuggestedAction(value: unknown): value is SuggestedAction {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.label === "string" &&
    row.label.trim().length > 0 &&
    typeof row.userQuery === "string" &&
    row.userQuery.trim().length > 0
  );
}

/** Read agent-emitted quick-reply chips from persisted contentJson. */
export function getSuggestedActionsFromContentJson(
  contentJson: StructuredResponseData | Record<string, unknown> | null | undefined
): SuggestedAction[] {
  if (!contentJson || typeof contentJson !== "object") return [];
  const raw = (contentJson as Record<string, unknown>).suggestedActions;
  if (!Array.isArray(raw)) return [];
  return raw.filter(isSuggestedAction).map((action) => ({
    label: action.label.trim(),
    userQuery: action.userQuery.trim(),
    chatIntent: action.chatIntent,
    action: parseChipAction((action as Record<string, unknown>).action),
  }));
}
