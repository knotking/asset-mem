import type { Message } from '../types';
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
