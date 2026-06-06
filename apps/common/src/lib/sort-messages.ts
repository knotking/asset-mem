import type { Message } from '../types';
import { assistantMessageHasDisplayableContent } from './assistant-message-display';
import {
  hasPostContentPipelineWork,
  resolveStructuredAnalysis,
} from './checkpoint-branch-progress';
import { getTimestampValue } from './session-timestamps';

const ROLE_SORT_ORDER: Record<string, number> = { user: 0, assistant: 1 };

/**
 * Oldest-first order for chat threads. When createdAt ties (common right after
 * send), user messages always sort before the assistant placeholder.
 */
export function sortMessagesChronologically(messages: Message[]): Message[] {
  if (messages.length <= 1) return messages;

  const indexed = messages.map((msg, index) => ({ msg, index }));
  indexed.sort((a, b) => {
    const timeDelta =
      getTimestampValue(a.msg.createdAt) - getTimestampValue(b.msg.createdAt);
    if (timeDelta !== 0) return timeDelta;

    const roleDelta =
      (ROLE_SORT_ORDER[a.msg.role] ?? 2) - (ROLE_SORT_ORDER[b.msg.role] ?? 2);
    if (roleDelta !== 0) return roleDelta;

    return a.index - b.index;
  });

  return indexed.map(({ msg }) => msg);
}

/** True when a user message appears earlier in the thread (same array order). */
export function hasUserMessageBefore(
  messages: ReadonlyArray<Pick<Message, 'role'>>,
  messageIndex: number,
): boolean {
  for (let i = 0; i < messageIndex; i += 1) {
    if (messages[i].role === 'user') return true;
  }
  return false;
}

/** True when Firestore shows an assistant turn still loading (cross-client observer). */
export function isAssistantTurnObservedInFlight(message: Message): boolean {
  if (message.role !== 'assistant') return false;

  const analysis = resolveStructuredAnalysis(message.contentJson);
  if (hasPostContentPipelineWork(analysis, message.agentSteps)) {
    return true;
  }

  if (!assistantMessageHasDisplayableContent(message)) {
    return (message.agentSteps?.length ?? 0) > 0 || !!message.agentLifecycle;
  }

  return false;
}

/**
 * Passive observer: empty assistant placeholder immediately after the user send,
 * before the first agentLifecycle / agentSteps Firestore patch lands.
 */
export function isPassivePreContentAssistantShell(
  messages: ReadonlyArray<Pick<Message, "role">>,
  assistantIndex: number,
  message: Message
): boolean {
  if (message.role !== "assistant") return false;
  if (assistantMessageHasDisplayableContent(message)) return false;
  return assistantIndex > 0 && messages[assistantIndex - 1]?.role === "user";
}

/**
 * In-flight assistant message for loading UI.
 * Local sender: last assistant after user while the client stream is open.
 * Remote observer: same message when Firestore still shows pipeline / pre-content work.
 */
export function getActiveStreamingAssistantMessageId(
  messages: ReadonlyArray<Message>,
  isLocalStreamActive: boolean,
): string | null {
  if (isLocalStreamActive) {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i].role !== 'assistant') continue;
      if (!hasUserMessageBefore(messages, i)) return null;
      return messages[i].id;
    }
    return null;
  }

  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i].role !== 'assistant') continue;
    if (!hasUserMessageBefore(messages, i)) return null;
    const assistant = messages[i];
    if (isAssistantTurnObservedInFlight(assistant)) return assistant.id;
    if (isPassivePreContentAssistantShell(messages, i, assistant)) {
      return assistant.id;
    }
    return null;
  }
  return null;
}
