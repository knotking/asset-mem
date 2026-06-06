/**
 * Suggested-action chips — mirrored from apps/common/src/lib/suggested-actions.ts (keep in sync).
 */

import type { StructuredResponseData } from "@/lib/types";

export type ChatIntentHint = "discuss_report" | "new_analysis" | "replay_report";

export type SuggestedAction = {
  label: string;
  userQuery: string;
  chatIntent?: ChatIntentHint;
};

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
  }));
}
