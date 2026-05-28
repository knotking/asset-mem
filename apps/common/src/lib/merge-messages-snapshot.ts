import type { AgentStep, Message } from '../types';

function messageCreatedAtMillis(createdAt: Message['createdAt'] | undefined): number | undefined {
  if (!createdAt) return undefined;
  if (createdAt instanceof Date) return createdAt.getTime();
  if (typeof createdAt.toDate === 'function') return createdAt.toDate().getTime();
  return undefined;
}

function agentStepsEqual(a?: AgentStep[], b?: AgentStep[]): boolean {
  if (a === b) return true;
  if (!a || !b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const left = a[i];
    const right = b[i];
    if (
      left.name !== right.name ||
      left.status !== right.status ||
      left.preview !== right.preview ||
      left.displayName !== right.displayName
    ) {
      return false;
    }
  }
  return true;
}

function contentJsonEqual(
  a: Message['contentJson'],
  b: Message['contentJson']
): boolean {
  if (a === b) return true;
  if (!a && !b) return true;
  if (!a || !b) return false;
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Shallow compare fields that affect chat UI and GiftedChat transform. */
export function areMessagesEqual(a: Message, b: Message): boolean {
  if (a === b) return true;
  if (a.id !== b.id || a.role !== b.role || a.content !== b.content) return false;
  if (a.primaryAgent !== b.primaryAgent) return false;
  if (messageCreatedAtMillis(a.createdAt) !== messageCreatedAtMillis(b.createdAt)) return false;
  if (!agentStepsEqual(a.agentSteps, b.agentSteps)) return false;
  if ((a.contentMarkdown ?? '') !== (b.contentMarkdown ?? '')) return false;
  if (!contentJsonEqual(a.contentJson, b.contentJson)) return false;

  const aFile = a.file;
  const bFile = b.file;
  if (aFile?.url !== bFile?.url || aFile?.name !== bFile?.name || aFile?.type !== bFile?.type) {
    return false;
  }

  return true;
}

/**
 * Merge a Firestore snapshot into the previous messages array.
 * Preserves object identity for unchanged messages to reduce downstream re-renders.
 *
 * @param prev Previous messages (oldest first)
 * @param loaded Messages from snapshot (oldest first)
 */
export function mergeMessagesFromSnapshot(prev: Message[], loaded: Message[]): Message[] {
  if (prev.length === 0) {
    return loaded;
  }

  const prevById = new Map(prev.map((msg) => [msg.id, msg]));
  const merged: Message[] = [];

  for (const msg of loaded) {
    const previous = prevById.get(msg.id);
    if (previous && areMessagesEqual(previous, msg)) {
      merged.push(previous);
    } else {
      merged.push(msg);
    }
  }

  return merged;
}
