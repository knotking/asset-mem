import type { AgentStep } from '@homeapp/common/types';
import type { IMessage, BubbleProps } from 'react-native-gifted-chat';
import {
  giftedChatCreatedAtMillis,
  messageCreatedAtMillis,
} from '@/lib/gifted-chat-utils';

export interface GiftedChatBubbleCompareProps extends BubbleProps<IMessage> {
  sessionId?: string;
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
  a: { phase?: string; message?: string; ts?: string } | null | undefined,
  b: { phase?: string; message?: string; ts?: string } | null | undefined,
): boolean {
  if (a === b) return true;
  if (!a || !b) return !a && !b;
  return a.phase === b.phase && a.message === b.message && (a.ts ?? '') === (b.ts ?? '');
}

function effectiveCreatedAtMillis(
  customData: IMessage['customData'] | undefined,
  giftedCreatedAt: IMessage['createdAt'] | undefined
): number | undefined {
  const fromFirestore = messageCreatedAtMillis(customData?.firestoreMessage?.createdAt);
  if (fromFirestore !== undefined) return fromFirestore;
  return giftedChatCreatedAtMillis(giftedCreatedAt);
}

function contentJsonEqual(
  a: Record<string, unknown> | null | undefined,
  b: Record<string, unknown> | null | undefined
): boolean {
  if (a === b) return true;
  if (!a && !b) return true;
  if (!a || !b) return false;
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Compare GiftedChat bubble props to skip re-renders when message payload is unchanged. */
export function areGiftedChatBubblePropsEqual(
  prev: GiftedChatBubbleCompareProps,
  next: GiftedChatBubbleCompareProps
): boolean {
  if (prev.sessionId !== next.sessionId) return false;
  if (prev.position !== next.position) return false;

  const prevMsg = prev.currentMessage;
  const nextMsg = next.currentMessage;
  if (prevMsg === nextMsg) return true;
  if (!prevMsg || !nextMsg) return false;

  if (prevMsg._id !== nextMsg._id) return false;
  if (prevMsg.text !== nextMsg.text) return false;

  const prevCustom = prevMsg.customData;
  const nextCustom = nextMsg.customData;
  if (prevCustom?.originalContent !== nextCustom?.originalContent) return false;
  if (prevCustom?.role !== nextCustom?.role) return false;
  if (prevCustom?.primaryAgent !== nextCustom?.primaryAgent) return false;
  if (!agentStepsEqual(prevCustom?.agentSteps, nextCustom?.agentSteps)) return false;

  const prevFile = prevCustom?.file;
  const nextFile = nextCustom?.file;
  if (prevFile?.url !== nextFile?.url || prevFile?.name !== nextFile?.name) return false;

  const prevFirestore = prevCustom?.firestoreMessage;
  const nextFirestore = nextCustom?.firestoreMessage;
  if ((prevFirestore?.contentMarkdown ?? '') !== (nextFirestore?.contentMarkdown ?? '')) {
    return false;
  }
  if (!contentJsonEqual(prevFirestore?.contentJson, nextFirestore?.contentJson)) {
    return false;
  }
  if (!agentLifecycleEqual(prevFirestore?.agentLifecycle, nextFirestore?.agentLifecycle)) {
    return false;
  }

  if (
    effectiveCreatedAtMillis(prevCustom, prevMsg.createdAt) !==
    effectiveCreatedAtMillis(nextCustom, nextMsg.createdAt)
  ) {
    return false;
  }

  return true;
}
