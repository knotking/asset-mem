import React, { createContext, useCallback, useContext, useMemo, useRef } from 'react';
import type { IMessage } from 'react-native-gifted-chat';
import type { AnimatedList } from 'react-native-gifted-chat/lib/MessageContainer/types';

type ChatListScrollAnchorContextValue = {
  registerScrollOffset: (offset: number) => void;
  /** Positive delta moves chat content down on screen (inverted list scroll offset increases). */
  compensateScrollForScreenDelta: (deltaScreenY: number) => void;
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
    (deltaScreenY: number) => {
      if (Math.abs(deltaScreenY) < 1) return;
      requestAnimationFrame(() => {
        const nextOffset = Math.max(0, scrollOffsetRef.current + deltaScreenY);
        messageListRef.current?.scrollToOffset({ offset: nextOffset, animated: false });
        scrollOffsetRef.current = nextOffset;
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
