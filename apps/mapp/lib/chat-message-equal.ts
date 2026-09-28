import type { AgentStep, Message } from '@asset-mem/common/types';
import { messageCreatedAtMillis } from '@/lib/gifted-chat-utils';

export interface ChatMessageCompareProps {
  message: Message;
  sessionId?: string;
  priorAssistantTurnCount?: number;
  isActiveLoading?: boolean;
  hideRepeatedContextRefs?: boolean;
  isSendDisabled?: boolean;
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

function agentLifecycleEqual(
  a: Message['agentLifecycle'],
  b: Message['agentLifecycle'],
): boolean {
  if (a === b) return true;
  if (!a || !b) return !a && !b;
  return a.phase === b.phase && a.message === b.message && (a.ts ?? '') === (b.ts ?? '');
}

function contentJsonEqual(
  a: Message['contentJson'],
  b: Message['contentJson'],
): boolean {
  if (a === b) return true;
  if (!a && !b) return true;
  if (!a || !b) return false;
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Compare ChatMessage props to skip re-renders when the Firestore message is unchanged. */
export function areChatMessagePropsEqual(
  prev: ChatMessageCompareProps,
  next: ChatMessageCompareProps
): boolean {
  if (prev.sessionId !== next.sessionId) return false;
  if (prev.priorAssistantTurnCount !== next.priorAssistantTurnCount) return false;
  if (prev.isActiveLoading !== next.isActiveLoading) return false;
  if (prev.hideRepeatedContextRefs !== next.hideRepeatedContextRefs) return false;
  if (prev.isSendDisabled !== next.isSendDisabled) return false;

  const prevMsg = prev.message;
  const nextMsg = next.message;
  if (prevMsg === nextMsg) return true;

  if (prevMsg.id !== nextMsg.id) return false;
  if (prevMsg.role !== nextMsg.role) return false;
  if (prevMsg.content !== nextMsg.content) return false;
  if (prevMsg.primaryAgent !== nextMsg.primaryAgent) return false;
  if (!agentStepsEqual(prevMsg.agentSteps, nextMsg.agentSteps)) return false;
  if (!agentLifecycleEqual(prevMsg.agentLifecycle, nextMsg.agentLifecycle)) return false;
  if ((prevMsg.contentMarkdown ?? '') !== (nextMsg.contentMarkdown ?? '')) return false;
  if (!contentJsonEqual(prevMsg.contentJson, nextMsg.contentJson)) return false;

  const prevFile = prevMsg.file;
  const nextFile = nextMsg.file;
  if (prevFile?.url !== nextFile?.url || prevFile?.name !== nextFile?.name) return false;

  if (
    messageCreatedAtMillis(prevMsg.createdAt) !==
    messageCreatedAtMillis(nextMsg.createdAt)
  ) {
    return false;
  }

  return true;
}
