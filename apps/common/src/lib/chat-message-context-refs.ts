import type { MessageContextRefs } from "../types";
import { ADD_CONTEXT_VISIBLE_CHIP_COUNT } from "./chat-context-limits";

export type MessageContextRefItem = {
  kind: "checkpoint" | "document";
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
