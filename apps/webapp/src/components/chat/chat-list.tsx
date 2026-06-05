
'use client';

import { useEffect, useRef, useMemo } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChatMessage } from '@/components/chat/chat-message';
import type { Message } from '@/lib/types';
import { assistantMessageHasDisplayableContent, getMessageDisplayParts } from '@/lib/message-display-parts';
import { countPriorAssistantTurnsInSession } from '@/lib/agent-lifecycle-ui';
import { AnimatePresence } from 'framer-motion';
import { AssetMemBrandIcon } from '@/components/brand/asset-mem-brand-icon';
import { Button } from '@/components/ui/button';
import {
  CHAT_SESSION_EMPTY_INTRO,
  getSuggestedPrompts,
} from '@/lib/feature-discovery';
import { buildSuppressRepeatedContextRefsByMessageId } from '@/lib/chat-message-context-refs';

type Props = {
  messages: Message[];
  isMessagesLoading: boolean;
  context?: 'property' | null;
  onSelectSuggestedPrompt?: (prompt: string) => void;
  isSendDisabled?: boolean;
};

function assistantHasNoDisplayableContentYet(message: Message): boolean {
  if (message.role !== 'assistant') return false;
  return !assistantMessageHasDisplayableContent(getMessageDisplayParts(message));
}

export function ChatList({
  messages,
  isMessagesLoading,
  context,
  onSelectSuggestedPrompt,
  isSendDisabled,
}: Props) {
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

  const suppressRepeatedContextRefsById = useMemo(
    () => buildSuppressRepeatedContextRefsByMessageId(messages),
    [messages]
  );

  const renderedMessages = useMemo(() => {
    return messages.map((message, index) => {
        // A message is considered loading if it's the last one, from the assistant, and has no content yet.
        const isLoading =
          index === messages.length - 1 &&
          message.role === 'assistant' &&
          assistantHasNoDisplayableContentYet(message);

        // Also check for the local-only placeholder ID
        const isPlaceholder = message.id.startsWith('local-');

        return (
            <ChatMessage 
                key={message.id} 
                message={message}
                isLoading={isLoading || (isPlaceholder && assistantHasNoDisplayableContentYet(message))}
                context={context}
                priorAssistantTurnCount={countPriorAssistantTurnsInSession(messages, message.id)}
                hideRepeatedContextRefs={suppressRepeatedContextRefsById.get(message.id) ?? false}
            />
        )
    });
  }, [messages, context, suppressRepeatedContextRefsById]);

  const welcomeMessageVisible = messages.length === 1 && messages[0].id === 'intro-message';

  const isEmpty = messages.length === 0 && !isMessagesLoading;
  const suggestedPrompts = getSuggestedPrompts();

  return (
    <ScrollArea className="h-full w-full" viewportRef={viewportRef}>
      {isEmpty ? (
        <div className="absolute inset-0 flex items-center justify-center p-4 sm:p-6">
          <div className="flex flex-col items-center text-center p-4 rounded-lg bg-card/80 max-w-md">
            <AssetMemBrandIcon size="lg" className="mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">{CHAT_SESSION_EMPTY_INTRO.title}</h3>
            <p className="text-sm text-muted-foreground max-w-sm mb-4">
              {CHAT_SESSION_EMPTY_INTRO.subtitle}
            </p>
            {onSelectSuggestedPrompt ? (
              <div className="flex w-full flex-col gap-2">
                {suggestedPrompts.map((prompt) => (
                  <Button
                    key={prompt}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-auto whitespace-normal px-3 py-2 text-left text-sm"
                    disabled={isSendDisabled}
                    onClick={() => onSelectSuggestedPrompt(prompt)}
                  >
                    {prompt}
                  </Button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4 p-4 sm:p-6">
          <AnimatePresence initial={false}>
            {renderedMessages}
          </AnimatePresence>
          {welcomeMessageVisible && (
            <div className="text-center text-sm text-muted-foreground py-4">
              Welcome! Ask me anything about your property.
            </div>
          )}
        </div>
      )}
    </ScrollArea>
  );
}
