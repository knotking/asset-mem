
'use client';

import { useEffect, useRef, useMemo } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChatMessage } from '@/components/chat/chat-message';
import type { Message } from '@/lib/types';
import { AnimatePresence } from 'framer-motion';
import { Bot } from 'lucide-react';

type Props = {
  messages: Message[];
  isMessagesLoading: boolean;
  context?: 'property' | 'document' | null;
};

function assistantHasNoVisibleTextYet(message: Message): boolean {
  if (message.role !== 'assistant') return false;
  const c = message.content;
  if (c == null) return true;
  if (typeof c !== 'string') return true;
  return c.trim().length === 0;
}

export function ChatList({ messages, isMessagesLoading, context }: Props) {
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (viewport) {
      // Use requestAnimationFrame to wait for the next paint, ensuring
      // the new message has been rendered and the scrollHeight is updated.
      requestAnimationFrame(() => {
        viewport.scrollTop = viewport.scrollHeight;
      });
    }
  }, [messages]);

  const renderedMessages = useMemo(() => {
    return messages.map((message, index) => {
        // A message is considered loading if it's the last one, from the assistant, and has no content yet.
        const isLoading =
          index === messages.length - 1 &&
          message.role === 'assistant' &&
          assistantHasNoVisibleTextYet(message);

        // Also check for the local-only placeholder ID
        const isPlaceholder = message.id.startsWith('local-');

        return (
            <ChatMessage 
                key={message.id} 
                message={message}
                isLoading={isLoading || (isPlaceholder && assistantHasNoVisibleTextYet(message))}
                context={context}
            />
        )
    });
  }, [messages, context]);

  const welcomeMessageVisible = messages.length === 1 && messages[0].id === 'intro-message';

  const isEmpty = messages.length === 0 && !isMessagesLoading;

  return (
    <ScrollArea className="h-full w-full" ref={scrollAreaRef} viewportRef={viewportRef}>
      {isEmpty ? (
        <div className="absolute inset-0 flex items-center justify-center p-4 sm:p-6">
          <div className="flex flex-col items-center text-center p-4 rounded-lg bg-card/80">
            <Bot className="h-7 w-7 text-primary" />
            <p className="text-muted-foreground">Ask questions about this property's documents, services, and history.</p>
          </div>
        </div>
      ) : (
        <div className="p-4 sm:p-6">
          <div className="flex flex-col gap-4">
            <AnimatePresence>
                {renderedMessages}
            </AnimatePresence>
          </div>
        </div>
      )}
    </ScrollArea>
  );
}

    

    