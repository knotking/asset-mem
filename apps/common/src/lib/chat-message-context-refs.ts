import type { MessageContextRefs } from "../types";
import { ADD_CONTEXT_VISIBLE_CHIP_COUNT } from "./chat-context-limits";

export type MessageContextRefItem = {
  kind: "checkpoint" | "document" | "report";
  id: string;
  name: string;
};

export function listMessageContextRefItems(refs: MessageContextRefs): MessageContextRefItem[] {
  const items: MessageContextRefItem[] = [];
  for (const cp of refs.checkpoints ?? []) {
    items.push({
      kind: "checkpoint",
      id: cp.id,
      name: cp.name?.trim() || "Checkpoint",
    });
  }
  for (const doc of refs.documents ?? []) {
    items.push({
      kind: "document",
      id: doc.id,
      name: doc.name?.trim() || "Document",
    });
  }
  for (const report of refs.reports ?? []) {
    const revision = report.revision ?? 1;
    items.push({
      kind: "report",
      id: report.id,
      name: report.title?.trim()
        ? `${report.title.trim()} · v${revision}`
        : `Report · v${revision}`,
    });
  }
  return items;
}

export function splitMessageContextRefItems(
  refs: MessageContextRefs,
  visibleCount = ADD_CONTEXT_VISIBLE_CHIP_COUNT
): { visible: MessageContextRefItem[]; hiddenCount: number } {
  const all = listMessageContextRefItems(refs);
  return {
    visible: all.slice(0, visibleCount),
    hiddenCount: Math.max(0, all.length - visibleCount),
  };
}

/** Stable id-only key for comparing context across consecutive user messages. */
export function contextRefsFingerprint(refs: MessageContextRefs): string | null {
  const checkpointIds = (refs.checkpoints ?? []).map((cp) => cp.id).sort();
  const documentIds = (refs.documents ?? []).map((doc) => doc.id).sort();
  const reportIds = (refs.reports ?? []).map((r) => r.id).sort();
  if (checkpointIds.length === 0 && documentIds.length === 0 && reportIds.length === 0) {
    return null;
  }
  return `c:${checkpointIds.join(",")}|d:${documentIds.join(",")}|r:${reportIds.join(",")}`;
}

/** One-line label for collapsed context on a sent message. */
export function getContextRefsSummaryLabel(refs: MessageContextRefs): string {
  const items = listMessageContextRefItems(refs);
  if (items.length === 0) return "";
  if (items.length === 1) return items[0].name;
  return `${items[0].name} +${items.length - 1} more`;
}

/** Hide context when it matches the previous user message's contextRefs. */
export function buildSuppressRepeatedContextRefsByMessageId(
  messages: ReadonlyArray<{
    id: string;
    role: string;
    contextRefs?: MessageContextRefs;
  }>
): Map<string, boolean> {
  const suppressed = new Map<string, boolean>();
  let previousUserContextKey: string | null = null;

  for (const message of messages) {
    if (message.role !== "user") continue;
    const key = message.contextRefs ? contextRefsFingerprint(message.contextRefs) : null;
    if (key) {
      suppressed.set(message.id, key === previousUserContextKey);
      previousUserContextKey = key;
    } else {
      previousUserContextKey = null;
    }
  }

  return suppressed;
}
