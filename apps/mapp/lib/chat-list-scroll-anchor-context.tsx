import React, { createContext, useCallback, useContext, useMemo, useRef } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import type { IMessage } from 'react-native-gifted-chat';
import type { AnimatedList } from 'react-native-gifted-chat/lib/MessageContainer/types';

type ChatListScrollAnchorContextValue = {
  registerScrollOffset: (offset: number) => void;
  /** Positive delta moves chat content down on screen (inverted list scroll offset increases). */
  compensateScrollForScreenDelta: (deltaScreenY: number, options?: { animated?: boolean }) => void;
};

const ChatListScrollAnchorContext = createContext<ChatListScrollAnchorContextValue | null>(
  null
);

export function ChatListScrollAnchorProvider({
  messageListRef,
  children,
}: {
  messageListRef: React.RefObject<AnimatedList<IMessage> | null>;
  children: React.ReactNode;
}) {
  const scrollOffsetRef = useRef(0);

  const registerScrollOffset = useCallback((offset: number) => {
    scrollOffsetRef.current = offset;
  }, []);

  const compensateScrollForScreenDelta = useCallback(
    (deltaScreenY: number, options?: { animated?: boolean }) => {
      if (Math.abs(deltaScreenY) < 1) return;
      const animated = options?.animated ?? true;
      requestAnimationFrame(() => {
        const nextOffset = Math.max(0, scrollOffsetRef.current + deltaScreenY);
        scrollOffsetRef.current = nextOffset;
        messageListRef.current?.scrollToOffset({ offset: nextOffset, animated });
      });
    },
    [messageListRef]
  );

  const value = useMemo(
    () => ({ registerScrollOffset, compensateScrollForScreenDelta }),
    [registerScrollOffset, compensateScrollForScreenDelta]
  );

  return (
    <ChatListScrollAnchorContext.Provider value={value}>
      {children}
    </ChatListScrollAnchorContext.Provider>
  );
}

export function useChatListScrollAnchor() {
  return useContext(ChatListScrollAnchorContext);
}

/** Pass to GiftedChat `handleOnScroll` so accordion expand/collapse can compensate offset. */
export function useChatListScrollOnScrollHandler() {
  const ctx = useChatListScrollAnchor();
  return useCallback(
    (event: { contentOffset: { y: number } }) => {
      ctx?.registerScrollOffset(event.contentOffset.y);
    },
    [ctx]
  );
}

/**
 * Batches layout height deltas and compensates once after layout settles — avoids
 * multi-frame accordion animation jank from per-item onLayout.
 */
export function useChatListScrollAnchorLayout(enabled = true) {
  const chatScrollAnchor = useChatListScrollAnchor();
  const prevHeightRef = useRef(0);
  const initialLayoutRef = useRef(true);
  const pendingDeltaRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  const flush = useCallback(() => {
    rafRef.current = null;
    const delta = pendingDeltaRef.current;
    pendingDeltaRef.current = 0;
    if (Math.abs(delta) < 1 || !chatScrollAnchor) {
      return;
    }
    chatScrollAnchor.compensateScrollForScreenDelta(delta, { animated: true });
  }, [chatScrollAnchor]);

  return useCallback(
    (event: LayoutChangeEvent) => {
      if (!enabled || !chatScrollAnchor) {
        return;
      }

      const height = event.nativeEvent.layout.height;
      const delta = height - prevHeightRef.current;
      prevHeightRef.current = height;

      if (initialLayoutRef.current) {
        initialLayoutRef.current = false;
        return;
      }

      if (Math.abs(delta) < 1) {
        return;
      }

      pendingDeltaRef.current += delta;
      if (rafRef.current != null) {
        return;
      }

      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = requestAnimationFrame(flush);
      });
    },
    [enabled, chatScrollAnchor, flush]
  );
}
